"""Tests du référentiel des vaccins exposé aux utilisateurs."""

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.accounts.models import Role, Utilisateur

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def referentiel():
    call_command("charger_schema_pev", verbosity=0)
    call_command("charger_descriptions", verbosity=0)


def connecter(client, utilisateur):
    client.force_authenticate(utilisateur)


def test_une_mere_consulte_les_fiches(client, referentiel):
    mere = Utilisateur.objects.create_user(
        username="rokh.ba", password="x" * 12, role=Role.BENEFICIAIRE
    )
    connecter(client, mere)

    reponse = client.get("/api/vaccins/")

    assert reponse.status_code == 200
    codes = {fiche["code"] for fiche in reponse.data}
    assert {"BCG", "PENTA", "TD"} <= codes


def test_chaque_fiche_dit_contre_quoi_elle_protege(client, referentiel, agent):
    connecter(client, agent)
    reponse = client.get("/api/vaccins/BCG/")

    assert reponse.data["protege_contre"] == "la tuberculose"
    assert reponse.data["description"]


def test_les_fiches_exigent_une_connexion(client, referentiel):
    assert client.get("/api/vaccins/").status_code == 401


def test_charger_les_descriptions_est_idempotent(referentiel):
    """Relancer la commande ne duplique rien et ne casse rien."""
    from apps.vaccination.models import Vaccin

    call_command("charger_descriptions", verbosity=0)
    assert Vaccin.objects.get(code="BCG").protege_contre == "la tuberculose"
