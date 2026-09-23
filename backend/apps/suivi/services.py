"""Orchestration du suivi vaccinal.

Ce module est la couche d'application : il traduit les décisions du moteur de
calendrier en écritures dans la base. Aucune règle métier ne s'y trouve — le
moteur reste seul juge des dates et des validations.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, timedelta

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import PosteSante, Utilisateur
from apps.beneficiaires.models import Enfant, Grossesse
from apps.domaine import calendrier as moteur
from apps.vaccination.models import Cible, Vaccin
from apps.vaccination.services import charger_schema, regle_pour

from .models import DoseAdministree, Echeance, StatutEcheance

CORRESPONDANCE_STATUTS = {
    moteur.Statut.A_VENIR: StatutEcheance.A_VENIR,
    moteur.Statut.DUE: StatutEcheance.DUE,
    moteur.Statut.EN_RETARD: StatutEcheance.EN_RETARD,
    moteur.Statut.PERIMEE: StatutEcheance.PERIMEE,
    moteur.Statut.ADMINISTREE: StatutEcheance.ADMINISTREE,
    moteur.Statut.ANNULEE: StatutEcheance.ANNULEE,
}


class AdministrationRefusee(Exception):
    """Une dose ne respecte pas les règles du schéma vaccinal."""

    def __init__(self, violations: list[moteur.Violation]):
        self.violations = violations
        super().__init__(", ".join(v.value for v in violations))


@dataclass(frozen=True, slots=True)
class Contexte:
    """Ce dont le moteur a besoin pour un bénéficiaire donné."""

    date_reference: date
    cible: str
    doses: dict[moteur.CleDose, date]
    annulees: frozenset[moteur.CleDose]


def contexte_beneficiaire(beneficiaire: Enfant | Grossesse) -> Contexte:
    if isinstance(beneficiaire, Enfant):
        reference, cible, filtre = (
            beneficiaire.date_naissance,
            Cible.ENFANT,
            {"enfant": beneficiaire},
        )
    else:
        reference, cible, filtre = (
            beneficiaire.date_reference,
            Cible.MERE,
            {"grossesse": beneficiaire},
        )

    echeances = Echeance.objects.filter(**filtre).select_related("vaccin")

    doses: dict[moteur.CleDose, date] = {}
    annulees: set[moteur.CleDose] = set()
    for echeance in echeances:
        cle = (echeance.vaccin.code, echeance.rang)
        if echeance.statut == StatutEcheance.ANNULEE:
            annulees.add(cle)
            continue
        dose = echeance.doses.filter(remplacee_par__isnull=True).first()
        if dose:
            doses[cle] = dose.date_administration

    return Contexte(reference, cible, doses, frozenset(annulees))


@transaction.atomic
def generer_echeances(beneficiaire: Enfant | Grossesse, aujourdhui: date | None = None) -> int:
    """Crée ou met à jour les échéances d'un bénéficiaire (EF-20, EF-21).

    Idempotente : une échéance existante est mise à jour, jamais dupliquée.
    Relancer après une dose ou un changement de schéma est donc sans risque.
    """
    aujourdhui = aujourdhui or timezone.localdate()
    contexte = contexte_beneficiaire(beneficiaire)
    schema = charger_schema(contexte.cible)

    if not schema:
        return 0

    calendrier = moteur.generer_calendrier(
        date_reference=contexte.date_reference,
        regles=schema,
        doses=contexte.doses,
        annulees=contexte.annulees,
        aujourdhui=aujourdhui,
    )

    vaccins = {
        v.code: v for v in Vaccin.objects.filter(code__in={e.code_vaccin for e in calendrier})
    }
    filtre = (
        {"enfant": beneficiaire}
        if isinstance(beneficiaire, Enfant)
        else {"grossesse": beneficiaire}
    )

    touchees = 0
    for prevue in calendrier:
        Echeance.objects.update_or_create(
            vaccin=vaccins[prevue.code_vaccin],
            rang=prevue.rang,
            **filtre,
            defaults={
                "date_ouverture": prevue.date_ouverture,
                "date_cible": prevue.date_cible,
                "date_limite": prevue.date_limite,
                "statut": CORRESPONDANCE_STATUTS[prevue.statut],
            },
        )
        touchees += 1

    return touchees


@transaction.atomic
def enregistrer_dose(
    *,
    echeance: Echeance,
    date_administration: date,
    agent: Utilisateur,
    poste: PosteSante | None = None,
    numero_lot: str = "",
    cle_idempotence: uuid.UUID | None = None,
    aujourdhui: date | None = None,
) -> DoseAdministree:
    """Enregistre un acte vaccinal (EF-30, EF-31).

    Lève `AdministrationRefusee` si le moteur rejette la date. Rejoue sans
    effet si la clé d'idempotence est déjà connue (EF-54).
    """
    aujourdhui = aujourdhui or timezone.localdate()

    if cle_idempotence:
        existante = DoseAdministree.objects.filter(cle_idempotence=cle_idempotence).first()
        if existante:
            return existante

    beneficiaire = echeance.beneficiaire
    contexte = contexte_beneficiaire(beneficiaire)
    schema = charger_schema(contexte.cible)
    regle = regle_pour(schema, echeance.vaccin.code, echeance.rang)

    if regle is None:
        raise AdministrationRefusee([moteur.Violation.DOSE_PRECEDENTE_MANQUANTE])

    violations = moteur.valider_administration(
        regle=regle,
        date_reference=contexte.date_reference,
        date_administration=date_administration,
        date_dose_precedente=contexte.doses.get((echeance.vaccin.code, echeance.rang - 1)),
        deja_administree=(echeance.vaccin.code, echeance.rang) in contexte.doses,
        aujourdhui=aujourdhui,
    )
    if violations:
        raise AdministrationRefusee(violations)

    dose = DoseAdministree.objects.create(
        echeance=echeance,
        date_administration=date_administration,
        numero_lot=numero_lot,
        agent=agent,
        poste=poste or echeance.poste,
        cle_idempotence=cle_idempotence or uuid.uuid4(),
    )

    # RG-04 : la dose vient de bouger, les suivantes doivent être recalculées.
    generer_echeances(beneficiaire, aujourdhui=aujourdhui)

    return dose


def rafraichir_statuts(aujourdhui: date | None = None) -> int:
    """Réévalue les statuts en attente (RG-05).

    Une échéance due hier peut être en retard aujourd'hui, et une échéance
    en retard peut devenir périmée, sans qu'aucune écriture n'ait eu lieu.
    """
    aujourdhui = aujourdhui or timezone.localdate()
    modifiees = 0

    # Toute échéance non administrée ni annulée peut changer de statut,
    # y compris une périmée : un recalcul rétroactif ou une correction de
    # date limite doit pouvoir la réactiver.
    en_attente = Echeance.objects.exclude(
        statut__in=[StatutEcheance.ADMINISTREE, StatutEcheance.ANNULEE]
    )

    for echeance in en_attente.iterator(chunk_size=500):
        if aujourdhui < echeance.date_cible:
            nouveau = StatutEcheance.A_VENIR
        elif echeance.date_limite is None:
            # Sans fenêtre définie, l'échéance reste indéfiniment administrable.
            nouveau = StatutEcheance.DUE
        elif aujourdhui > echeance.date_limite:
            nouveau = StatutEcheance.PERIMEE
        else:
            # Le seuil suit la fenêtre propre au vaccin plutôt qu'un délai fixe.
            fenetre = (echeance.date_limite - echeance.date_cible).days
            seuil = echeance.date_cible + timedelta(days=max(1, fenetre // 3))
            nouveau = StatutEcheance.DUE if aujourdhui <= seuil else StatutEcheance.EN_RETARD

        if nouveau != echeance.statut:
            echeance.statut = nouveau
            echeance.save(update_fields=["statut", "modifie_le"])
            modifiees += 1

    return modifiees
