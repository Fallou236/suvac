"""Tests de la passerelle entre le référentiel en base et le moteur."""

from datetime import date

import pytest

from apps.domaine.calendrier import Statut, generer_calendrier
from apps.vaccination.models import Cible
from apps.vaccination.services import charger_schema, regle_pour

pytestmark = pytest.mark.django_db


@pytest.fixture
def schema_charge():
    from django.core.management import call_command

    call_command("charger_schema_pev", verbosity=0)


def test_le_schema_enfant_est_charge(schema_charge):
    schema = charger_schema(Cible.ENFANT)

    codes = {regle.code_vaccin for regle in schema}
    assert {"BCG", "VPO", "PENTA", "PNEUMO", "ROTA", "VPI", "RR", "VAA"} <= codes
    assert len(schema) == 17


def test_le_schema_mere_est_distinct(schema_charge):
    schema = charger_schema(Cible.MERE)

    assert len(schema) == 5
    assert all(regle.code_vaccin == "TD" for regle in schema)
    assert {regle.rang for regle in schema} == {1, 2, 3, 4, 5}


def test_le_chargement_est_idempotent(schema_charge):
    from django.core.management import call_command

    from apps.vaccination.models import RegleVaccinale, Vaccin

    avant_vaccins = Vaccin.objects.count()
    avant_regles = RegleVaccinale.objects.count()

    call_command("charger_schema_pev", verbosity=0)

    assert Vaccin.objects.count() == avant_vaccins
    assert RegleVaccinale.objects.count() == avant_regles


def test_une_regle_desactivee_disparait_du_schema(schema_charge):
    from apps.vaccination.models import RegleVaccinale, Vaccin

    rota = Vaccin.objects.get(code="ROTA")
    RegleVaccinale.objects.filter(vaccin=rota).update(actif=False)

    codes = {regle.code_vaccin for regle in charger_schema(Cible.ENFANT)}
    assert "ROTA" not in codes


def test_un_vaccin_desactive_disparait_du_schema(schema_charge):
    from apps.vaccination.models import Vaccin

    Vaccin.objects.filter(code="VAA").update(actif=False)

    codes = {regle.code_vaccin for regle in charger_schema(Cible.ENFANT)}
    assert "VAA" not in codes


def test_le_moteur_consomme_le_schema_charge(schema_charge):
    """Le test d'intégration qui compte : base et moteur bout en bout."""
    naissance = date(2026, 1, 1)
    schema = charger_schema(Cible.ENFANT)

    calendrier = generer_calendrier(
        date_reference=naissance, regles=schema, aujourdhui=naissance
    )

    par_cle = {(e.code_vaccin, e.rang): e for e in calendrier}

    assert par_cle[("BCG", 1)].date_cible == naissance
    assert par_cle[("PENTA", 1)].date_cible == date(2026, 2, 12)  # 42 jours
    assert par_cle[("PENTA", 2)].date_cible == date(2026, 3, 12)  # 70 jours
    assert par_cle[("PENTA", 3)].date_cible == date(2026, 4, 9)   # 98 jours
    assert par_cle[("BCG", 1)].statut is Statut.DUE
    assert par_cle[("RR", 1)].statut is Statut.A_VENIR


def test_regle_pour_retrouve_une_regle(schema_charge):
    schema = charger_schema(Cible.ENFANT)

    penta2 = regle_pour(schema, "PENTA", 2)
    assert penta2 is not None
    assert penta2.intervalle_min_jours == 28

    assert regle_pour(schema, "PENTA", 9) is None
    assert regle_pour(schema, "INCONNU", 1) is None


def test_une_regle_incoherente_est_refusee_par_la_base(schema_charge):
    from django.db import IntegrityError

    from apps.vaccination.models import RegleVaccinale, Vaccin

    with pytest.raises(IntegrityError):
        RegleVaccinale.objects.create(
            vaccin=Vaccin.objects.get(code="BCG"),
            cible=Cible.ENFANT, rang=9,
            age_min_jours=100, age_cible_jours=50,  # minimum après la cible
        )