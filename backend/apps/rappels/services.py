"""Orchestration des rappels : qui prévenir, quand, et par quel canal.

Ce module décide ; les canaux exécutent. Toute la logique de consentement,
de regroupement et de choix de canal vit ici, ce qui la rend testable sans
réseau.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.beneficiaires.models import CanalRappel as CanalConsentement
from apps.beneficiaires.models import Mere
from apps.suivi.models import Echeance, StatutEcheance

from .canaux import canal_pour
from .canaux.base import MessageSortant
from .composition import composer
from .models import CanalRappel, Rappel, StatutRappel, TypeRappel

journal = logging.getLogger("suvac.rappels")

# Jours avant l'échéance où un premier rappel part.
PREAVIS_JOURS = 3

# Au-delà, on cesse de relancer : au bout de trois relances sans effet,
# le problème n'est plus l'information mais l'accès au poste.
RELANCES_MAXIMUM = 3

CORRESPONDANCE_CANAUX = {
    CanalConsentement.WHATSAPP: CanalRappel.WHATSAPP,
    CanalConsentement.SMS: CanalRappel.SMS,
    CanalConsentement.APPLICATION: CanalRappel.APPLICATION,
}


@dataclass(frozen=True, slots=True)
class Bilan:
    """Ce qu'un balayage a produit."""

    planifies: int = 0
    ignores_sans_consentement: int = 0
    ignores_sans_telephone: int = 0
    deja_planifies: int = 0

    def __str__(self) -> str:
        return (
            f"{self.planifies} planifiés, "
            f"{self.ignores_sans_consentement} sans consentement, "
            f"{self.ignores_sans_telephone} sans téléphone, "
            f"{self.deja_planifies} déjà planifiés"
        )


def planifier_les_rappels(jour: date | None = None) -> Bilan:
    """Crée les rappels dus pour la journée.

    Trois cas déclenchent un rappel : une échéance arrive dans trois jours,
    une échéance tombe aujourd'hui, une échéance est en retard. Les rappels
    ne sont pas envoyés ici — seulement planifiés, ce qui permet de les
    relire avant envoi et de rejouer le balayage sans effet de bord.
    """
    jour = jour or timezone.localdate()

    planifies = 0
    sans_consentement = 0
    sans_telephone = 0
    deja = 0

    for type_rappel, echeances in _echeances_par_type(jour).items():
        par_mere = _grouper_par_mere(echeances)

        for mere, liste in par_mere.items():
            consentement = mere.consentement_actif
            if consentement is None:
                # EF-47 : aucun rappel sans consentement actif.
                sans_consentement += 1
                continue

            canal = CORRESPONDANCE_CANAUX.get(consentement.canal, CanalRappel.APPLICATION)

            if canal in {CanalRappel.WHATSAPP, CanalRappel.SMS} and not mere.telephone:
                sans_telephone += 1
                continue

            if _creer_rappel(mere, liste, type_rappel, canal, jour):
                planifies += 1
            else:
                deja += 1

    bilan = Bilan(planifies, sans_consentement, sans_telephone, deja)
    journal.info("Balayage du %s : %s", jour, bilan)
    return bilan


def _echeances_par_type(jour: date) -> dict[str, list[Echeance]]:
    """Range les échéances selon le type de rappel qu'elles appellent."""
    base = Echeance.objects.select_related(
        "vaccin",
        "enfant",
        "enfant__mere",
        "enfant__poste",
        "grossesse",
        "grossesse__mere",
        "grossesse__mere__poste",
    )

    return {
        TypeRappel.AVANT_ECHEANCE: list(
            base.filter(
                statut=StatutEcheance.A_VENIR,
                date_cible=jour + timedelta(days=PREAVIS_JOURS),
            )
        ),
        TypeRappel.JOUR_MEME: list(
            base.filter(
                statut__in=[StatutEcheance.DUE, StatutEcheance.A_VENIR],
                date_cible=jour,
            )
        ),
        TypeRappel.RELANCE: list(base.filter(statut=StatutEcheance.EN_RETARD)),
    }


def _grouper_par_mere(echeances: list[Echeance]) -> dict[Mere, list[Echeance]]:
    """RG-09 : un seul message par mère, quel que soit le nombre de doses."""
    groupes: dict[Mere, list[Echeance]] = defaultdict(list)

    for echeance in echeances:
        mere = echeance.enfant.mere if echeance.enfant_id else echeance.grossesse.mere
        groupes[mere].append(echeance)

    return groupes


def _creer_rappel(
    mere: Mere,
    echeances: list[Echeance],
    type_rappel: str,
    canal: str,
    jour: date,
) -> bool:
    """Crée le rappel, ou renonce s'il existe déjà.

    La contrainte d'unicité en base est la garantie réelle : deux balayages
    concurrents ne produiront jamais deux messages pour la même mère le même
    jour.
    """
    premiere = echeances[0]
    pour_elle_meme = premiere.grossesse_id is not None

    if pour_elle_meme:
        nom = mere.nom_complet
        poste = mere.poste.nom if mere.poste else ""
    else:
        nom = premiere.enfant.nom_complet
        poste = premiere.enfant.poste.nom if premiere.enfant.poste else ""

    message = composer(
        echeances=echeances,
        type_rappel=type_rappel,
        langue=mere.langue,
        nom_beneficiaire=nom,
        nom_poste=poste,
        pour_elle_meme=pour_elle_meme,
    )

    try:
        with transaction.atomic():
            rappel = Rappel.objects.create(
                mere=mere,
                type=type_rappel,
                canal=canal,
                langue=message.langue,
                texte=message.texte,
                planifie_pour=jour,
            )
            rappel.echeances.set(echeances)
            return True
    except IntegrityError:
        return False


def envoyer_les_rappels(jour: date | None = None, limite: int = 500) -> dict[str, int]:
    """Envoie les rappels planifiés et non encore partis.

    Les rappels destinés à l'application ne sont pas envoyés : la mère les
    lit dans son espace, ils restent en attente jusqu'à sa connexion.
    """
    jour = jour or timezone.localdate()

    a_envoyer = (
        Rappel.objects.filter(
            planifie_pour__lte=jour,
            statut__in=[StatutRappel.EN_ATTENTE, StatutRappel.ECHEC],
        )
        .exclude(canal=CanalRappel.APPLICATION)
        .filter(tentatives__lt=RELANCES_MAXIMUM)
        .select_related("mere")
        .order_by("planifie_pour")[:limite]
    )

    envoyes = 0
    echecs = 0

    for rappel in a_envoyer:
        if envoyer_un_rappel(rappel):
            envoyes += 1
        else:
            echecs += 1

    journal.info("Envoi du %s : %d partis, %d en échec", jour, envoyes, echecs)
    return {"envoyes": envoyes, "echecs": echecs}


def envoyer_un_rappel(rappel: Rappel) -> bool:
    """Tente l'envoi d'un rappel et enregistre ce qui s'est passé."""
    canal = canal_pour(rappel.canal)

    if not canal.disponible():
        rappel.marquer_echec(f"Canal {rappel.canal} indisponible.")
        return False

    resultat = canal.envoyer(
        MessageSortant(
            destinataire=rappel.mere.telephone,
            texte=rappel.texte,
            langue=rappel.langue,
        )
    )

    if resultat.reussi:
        rappel.marquer_envoye(resultat.identifiant_externe)
        return True

    rappel.marquer_echec(resultat.erreur, definitif=resultat.definitif)
    return False


def rappels_en_attente(mere: Mere) -> list[Rappel]:
    """Rappels que la mère n'a pas encore lus dans l'application."""
    return list(
        mere.rappels.filter(
            statut__in=[
                StatutRappel.EN_ATTENTE,
                StatutRappel.ENVOYE,
                StatutRappel.REMIS,
            ]
        ).order_by("-planifie_pour")
    )
