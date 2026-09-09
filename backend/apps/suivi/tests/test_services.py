"""Tests d'intégration : moteur, référentiel et base de bout en bout."""

import uuid
from datetime import date

import pytest
from django.core.management import call_command

from apps.beneficiaires.models import Enfant, Grossesse, Mere, Sexe
from apps.domaine.calendrier import Violation
from apps.suivi.models import DoseAdministree, Echeance, MotifAnnulation, StatutEcheance
from apps.suivi.services import (
    AdministrationRefusee,
    enregistrer_dose,
    generer_echeances,
    rafraichir_statuts,
)

pytestmark = pytest.mark.django_db

NAISSANCE = date(2026, 1, 1)


@pytest.fixture
def schema():
    call_command("charger_schema_pev", verbosity=0)


@pytest.fixture
def mere(poste):
    return Mere.objects.create(prenom="Awa", nom="Ndiaye", poste=poste)


@pytest.fixture
def enfant(schema, mere, poste):
    """Le schéma est chargé AVANT la création : le signal peut travailler."""
    return Enfant.objects.create(
        mere=mere,
        prenom="Moussa",
        date_naissance=NAISSANCE,
        sexe=Sexe.MASCULIN,
        poste=poste,
    )


def echeance_de(enfant, code, rang) -> Echeance:
    return Echeance.objects.get(enfant=enfant, vaccin__code=code, rang=rang)


# --- EF-20 : génération automatique ----------------------------------------


def test_le_calendrier_est_cree_a_l_enregistrement(enfant):
    assert Echeance.objects.filter(enfant=enfant).count() == 17


def test_les_dates_suivent_le_schema(enfant):
    assert echeance_de(enfant, "BCG", 1).date_cible == NAISSANCE
    assert echeance_de(enfant, "PENTA", 1).date_cible == date(2026, 2, 12)
    assert echeance_de(enfant, "PENTA", 2).date_cible == date(2026, 3, 12)
    assert echeance_de(enfant, "PENTA", 3).date_cible == date(2026, 4, 9)


def test_la_generation_est_idempotente(enfant):
    avant = Echeance.objects.filter(enfant=enfant).count()
    generer_echeances(enfant, aujourdhui=NAISSANCE)
    generer_echeances(enfant, aujourdhui=NAISSANCE)
    assert Echeance.objects.filter(enfant=enfant).count() == avant


def test_sans_schema_aucune_echeance(mere, poste):
    """Garde-fou : une base sans référentiel ne fait pas planter la création."""
    orphelin = Enfant.objects.create(
        mere=mere,
        prenom="Fatou",
        date_naissance=NAISSANCE,
        sexe=Sexe.FEMININ,
        poste=poste,
    )
    assert Echeance.objects.filter(enfant=orphelin).count() == 0


# --- EF-21 : calendrier de la mère ------------------------------------------


def test_la_grossesse_recoit_son_calendrier_antitetanique(schema, mere):
    grossesse = Grossesse.objects.create(mere=mere, rang=1, date_reference=date(2026, 3, 1))
    echeances = Echeance.objects.filter(grossesse=grossesse)

    assert echeances.count() == 5
    assert all(e.vaccin.code == "TD" for e in echeances)
    assert echeances.get(rang=1).date_cible == date(2026, 3, 1)
    assert echeances.get(rang=2).date_cible == date(2026, 3, 29)


# --- EF-30 : enregistrement d'une dose --------------------------------------


def test_enregistrer_une_dose_conforme(enfant, agent):
    echeance = echeance_de(enfant, "PENTA", 1)
    dose = enregistrer_dose(
        echeance=echeance,
        date_administration=date(2026, 2, 12),
        agent=agent,
        numero_lot="LOT-2026-A",
        aujourdhui=date(2026, 2, 12),
    )

    assert dose.numero_lot == "LOT-2026-A"
    echeance.refresh_from_db()
    assert echeance.statut == StatutEcheance.ADMINISTREE


def test_dose_trop_precoce_est_refusee(enfant, agent):
    echeance = echeance_de(enfant, "PENTA", 1)

    with pytest.raises(AdministrationRefusee) as erreur:
        enregistrer_dose(
            echeance=echeance,
            date_administration=date(2026, 1, 20),
            agent=agent,
            aujourdhui=date(2026, 1, 20),
        )

    assert Violation.AGE_MINIMAL_NON_ATTEINT in erreur.value.violations
    assert DoseAdministree.objects.count() == 0


def test_intervalle_minimal_non_respecte_est_refuse(enfant, agent):
    enregistrer_dose(
        echeance=echeance_de(enfant, "PENTA", 1),
        date_administration=date(2026, 2, 12),
        agent=agent,
        aujourdhui=date(2026, 2, 12),
    )

    with pytest.raises(AdministrationRefusee) as erreur:
        enregistrer_dose(
            echeance=echeance_de(enfant, "PENTA", 2),
            date_administration=date(2026, 2, 26),  # 14 jours au lieu de 28
            agent=agent,
            aujourdhui=date(2026, 2, 26),
        )

    assert Violation.INTERVALLE_MINIMAL_NON_RESPECTE in erreur.value.violations


def test_dose_future_est_refusee(enfant, agent):
    with pytest.raises(AdministrationRefusee) as erreur:
        enregistrer_dose(
            echeance=echeance_de(enfant, "BCG", 1),
            date_administration=date(2026, 6, 1),
            agent=agent,
            aujourdhui=date(2026, 5, 1),
        )

    assert Violation.DATE_FUTURE in erreur.value.violations


# --- RG-04 : re-planification -----------------------------------------------


def test_une_dose_en_retard_decale_les_suivantes(enfant, agent):
    enregistrer_dose(
        echeance=echeance_de(enfant, "PENTA", 1),
        date_administration=date(2026, 2, 12),
        agent=agent,
        aujourdhui=date(2026, 2, 12),
    )
    # Penta-2 rattrapée le 2 avril au lieu du 12 mars.
    enregistrer_dose(
        echeance=echeance_de(enfant, "PENTA", 2),
        date_administration=date(2026, 4, 2),
        agent=agent,
        aujourdhui=date(2026, 4, 2),
    )

    penta3 = echeance_de(enfant, "PENTA", 3)
    assert penta3.date_cible == date(2026, 4, 30)  # 2 avril + 28 jours


# --- EF-54 : idempotence de la synchronisation ------------------------------


def test_rejouer_la_meme_cle_ne_cree_pas_de_doublon(enfant, agent):
    cle = uuid.uuid4()
    echeance = echeance_de(enfant, "PENTA", 1)

    premiere = enregistrer_dose(
        echeance=echeance,
        date_administration=date(2026, 2, 12),
        agent=agent,
        cle_idempotence=cle,
        aujourdhui=date(2026, 2, 12),
    )
    seconde = enregistrer_dose(
        echeance=echeance,
        date_administration=date(2026, 2, 12),
        agent=agent,
        cle_idempotence=cle,
        aujourdhui=date(2026, 2, 12),
    )

    assert premiere.pk == seconde.pk
    assert DoseAdministree.objects.count() == 1


def test_deux_cles_distinctes_creent_deux_doses(enfant, agent):
    """Sans clé partagée, rien ne protège du doublon — c'est bien la clé qui agit."""
    enregistrer_dose(
        echeance=echeance_de(enfant, "BCG", 1),
        date_administration=NAISSANCE,
        agent=agent,
        cle_idempotence=uuid.uuid4(),
        aujourdhui=NAISSANCE,
    )
    echeance_penta = echeance_de(enfant, "PENTA", 1)
    enregistrer_dose(
        echeance=echeance_penta,
        date_administration=date(2026, 2, 12),
        agent=agent,
        cle_idempotence=uuid.uuid4(),
        aujourdhui=date(2026, 2, 12),
    )

    assert DoseAdministree.objects.count() == 2


# --- RG-05 : rafraîchissement des statuts -----------------------------------


def test_une_echeance_devient_due_puis_en_retard(enfant):
    generer_echeances(enfant, aujourdhui=date(2026, 2, 11))
    assert echeance_de(enfant, "PENTA", 1).statut == StatutEcheance.A_VENIR

    rafraichir_statuts(aujourdhui=date(2026, 2, 12))
    assert echeance_de(enfant, "PENTA", 1).statut == StatutEcheance.DUE

    rafraichir_statuts(aujourdhui=date(2027, 6, 1))
    assert echeance_de(enfant, "PENTA", 1).statut == StatutEcheance.EN_RETARD


def test_le_rafraichissement_ignore_les_doses_administrees(enfant, agent):
    enregistrer_dose(
        echeance=echeance_de(enfant, "BCG", 1),
        date_administration=NAISSANCE,
        agent=agent,
        aujourdhui=NAISSANCE,
    )
    rafraichir_statuts(aujourdhui=date(2028, 1, 1))

    assert echeance_de(enfant, "BCG", 1).statut == StatutEcheance.ADMINISTREE


def test_le_rafraichissement_compte_les_modifications(enfant):
    generer_echeances(enfant, aujourdhui=NAISSANCE)
    modifiees = rafraichir_statuts(aujourdhui=date(2027, 1, 1))
    assert modifiees > 0


# --- EF-27 et RG-08 : annulation --------------------------------------------


def test_annuler_une_echeance(enfant):
    echeance = echeance_de(enfant, "ROTA", 1)
    echeance.annuler(MotifAnnulation.CONTRE_INDICATION, "Allergie documentée")

    echeance.refresh_from_db()
    assert echeance.statut == StatutEcheance.ANNULEE


def test_une_echeance_annulee_le_reste_apres_regeneration(enfant):
    echeance_de(enfant, "ROTA", 1).annuler(MotifAnnulation.REFUS)
    generer_echeances(enfant, aujourdhui=date(2027, 1, 1))

    assert echeance_de(enfant, "ROTA", 1).statut == StatutEcheance.ANNULEE


def test_une_dose_administree_ne_peut_etre_annulee(enfant, agent):
    from django.core.exceptions import ValidationError

    echeance = echeance_de(enfant, "BCG", 1)
    enregistrer_dose(
        echeance=echeance,
        date_administration=NAISSANCE,
        agent=agent,
        aujourdhui=NAISSANCE,
    )
    echeance.refresh_from_db()

    with pytest.raises(ValidationError):
        echeance.annuler(MotifAnnulation.AUTRE)


# --- Retard -----------------------------------------------------------------


def test_retard_en_jours(enfant):
    penta1 = echeance_de(enfant, "PENTA", 1)
    assert penta1.date_limite is not None
    assert penta1.retard_en_jours(a_la_date=penta1.date_limite) == 0
    assert penta1.retard_en_jours(a_la_date=date(2027, 1, 1)) > 0
