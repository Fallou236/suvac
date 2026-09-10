"""Tests de l'authentification et du contrôle d'accès."""

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import PosteSante, Role, Utilisateur

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def autre_poste(db):
    return PosteSante.objects.create(nom="Poste de Joal", district="Mbour", region="Thiès")


@pytest.fixture
def superviseur(db, poste):
    return Utilisateur.objects.create_user(
        username="modou.fall",
        password="motdepasse-de-test-123",
        role=Role.SUPERVISEUR,
        poste=poste,
    )


def connecter(client, username, mot_de_passe="motdepasse-de-test-123"):
    reponse = client.post(
        "/api/auth/connexion/",
        {"username": username, "password": mot_de_passe},
        format="json",
    )
    assert reponse.status_code == 200
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {reponse.data['access']}")
    return reponse


# --- EF-01 : authentification -----------------------------------------------


def test_connexion_renvoie_les_jetons_et_le_profil(client, agent):
    reponse = connecter(client, "awa.ndiaye")

    assert "access" in reponse.data
    assert "refresh" in reponse.data
    assert reponse.data["utilisateur"]["role"] == Role.AGENT
    assert reponse.data["utilisateur"]["poste"]["nom"] == "Poste de Ngaparou"


def test_mauvais_mot_de_passe_refuse(client, agent):
    reponse = client.post(
        "/api/auth/connexion/",
        {"username": "awa.ndiaye", "password": "faux"},
        format="json",
    )
    assert reponse.status_code == 401


def test_profil_exige_une_authentification(client):
    assert client.get("/api/auth/profil/").status_code == 401


def test_profil_de_l_utilisateur_connecte(client, agent):
    connecter(client, "awa.ndiaye")
    reponse = client.get("/api/auth/profil/")

    assert reponse.status_code == 200
    assert reponse.data["username"] == "awa.ndiaye"
    assert reponse.data["nom_complet"] == "Awa Ndiaye"


def test_l_identifiant_expose_est_un_uuid(client, agent):
    connecter(client, "awa.ndiaye")
    reponse = client.get("/api/auth/profil/")

    assert reponse.data["id"] == str(agent.identifiant_public)
    assert reponse.data["id"] != str(agent.pk)


def test_modifier_son_profil(client, agent):
    connecter(client, "awa.ndiaye")
    reponse = client.patch("/api/auth/profil/", {"langue": "wo"}, format="json")

    assert reponse.status_code == 200
    agent.refresh_from_db()
    assert agent.langue == "wo"


def test_le_role_n_est_pas_modifiable_par_l_utilisateur(client, agent):
    connecter(client, "awa.ndiaye")
    client.patch("/api/auth/profil/", {"role": Role.ADMINISTRATEUR}, format="json")

    agent.refresh_from_db()
    assert agent.role == Role.AGENT


# --- EF-05 : mot de passe ---------------------------------------------------


def test_changer_son_mot_de_passe(client, agent):
    connecter(client, "awa.ndiaye")
    reponse = client.post(
        "/api/auth/mot-de-passe/",
        {
            "ancien_mot_de_passe": "motdepasse-de-test-123",
            "nouveau_mot_de_passe": "nouveau-motdepasse-solide-456",
        },
        format="json",
    )

    assert reponse.status_code == 204
    agent.refresh_from_db()
    assert agent.check_password("nouveau-motdepasse-solide-456")


def test_ancien_mot_de_passe_incorrect_refuse(client, agent):
    connecter(client, "awa.ndiaye")
    reponse = client.post(
        "/api/auth/mot-de-passe/",
        {"ancien_mot_de_passe": "faux", "nouveau_mot_de_passe": "peu-importe-123456"},
        format="json",
    )
    assert reponse.status_code == 400


def test_mot_de_passe_trop_faible_refuse(client, agent):
    connecter(client, "awa.ndiaye")
    reponse = client.post(
        "/api/auth/mot-de-passe/",
        {
            "ancien_mot_de_passe": "motdepasse-de-test-123",
            "nouveau_mot_de_passe": "1234",
        },
        format="json",
    )
    assert reponse.status_code == 400


# --- EF-03 : cloisonnement par poste ----------------------------------------


def test_l_agent_ne_voit_que_son_poste(client, agent, autre_poste):
    connecter(client, "awa.ndiaye")
    reponse = client.get("/api/postes/")

    noms = [poste["nom"] for poste in reponse.data["results"]]
    assert noms == ["Poste de Ngaparou"]
    assert "Poste de Joal" not in noms


def test_le_superviseur_voit_tous_les_postes(client, superviseur, autre_poste):
    connecter(client, "modou.fall")
    reponse = client.get("/api/postes/")

    assert reponse.data["count"] == 2


def test_l_agent_ne_peut_pas_consulter_un_autre_poste(client, agent, autre_poste):
    connecter(client, "awa.ndiaye")
    reponse = client.get(f"/api/postes/{autre_poste.identifiant_public}/")

    assert reponse.status_code == 404


# --- Documentation ----------------------------------------------------------


def test_le_schema_openapi_est_genere(client, agent):
    connecter(client, "awa.ndiaye")
    reponse = client.get("/api/schema/")
    assert reponse.status_code == 200
