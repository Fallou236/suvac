"""Fixtures partagées par toute la suite de tests."""

import pytest

from apps.accounts.models import PosteSante, Role, Utilisateur


@pytest.fixture
def poste(db):
    return PosteSante.objects.create(nom="Poste de Ngaparou", district="Mbour", region="Thies")


@pytest.fixture
def agent(db, poste):
    return Utilisateur.objects.create_user(
        username="awa.ndiaye",
        password="motdepasse-de-test-123",
        first_name="Awa",
        last_name="Ndiaye",
        role=Role.AGENT,
        poste=poste,
    )
