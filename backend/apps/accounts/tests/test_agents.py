"""Tests de la gestion du personnel par le superviseur.

Deux garanties comptent : un superviseur ne gère que son poste, et personne
ne peut se désactiver soi-même — un poste sans superviseur actif ne pourrait
plus créer de comptes.
"""

import pytest
from rest_framework.test import APIClient

from apps.accounts.audit import ActeAdministration, JournalAudit
from apps.accounts.models import PosteSante, Role, Utilisateur

pytestmark = pytest.mark.django_db

MOT_DE_PASSE = "motdepasse-de-test-123"
SOLIDE = "Ndondol-2026-Suvac"


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def superviseur(db, poste):
    return Utilisateur.objects.create_user(
        username="fatou.gueye",
        password=MOT_DE_PASSE,
        first_name="Fatou",
        last_name="Guèye",
        role=Role.SUPERVISEUR,
        poste=poste,
    )


@pytest.fixture
def administrateur(db):
    return Utilisateur.objects.create_user(
        username="admin", password=MOT_DE_PASSE, role=Role.ADMINISTRATEUR
    )


@pytest.fixture
def autre_poste(db):
    return PosteSante.objects.create(nom="Poste de Joal", district="Mbour", region="Thiès")


def connecter(client, utilisateur):
    client.force_authenticate(utilisateur)


# --- Périmètre ---------------------------------------------------------------


def test_le_superviseur_ne_voit_que_son_poste(client, superviseur, poste, autre_poste):
    Utilisateur.objects.create_user(
        username="ailleurs", password=MOT_DE_PASSE, role=Role.AGENT, poste=autre_poste
    )
    connecter(client, superviseur)

    reponse = client.get("/api/agents/")

    identifiants = {ligne["username"] for ligne in reponse.data["results"]}
    assert "fatou.gueye" in identifiants
    assert "ailleurs" not in identifiants


def test_l_administrateur_voit_tous_les_postes(client, administrateur, superviseur, autre_poste):
    Utilisateur.objects.create_user(
        username="ailleurs", password=MOT_DE_PASSE, role=Role.AGENT, poste=autre_poste
    )
    connecter(client, administrateur)

    reponse = client.get("/api/agents/")

    identifiants = {ligne["username"] for ligne in reponse.data["results"]}
    assert {"fatou.gueye", "ailleurs"} <= identifiants


def test_un_agent_n_accede_pas_a_la_gestion(client, agent):
    connecter(client, agent)
    assert client.get("/api/agents/").status_code == 403


def test_les_beneficiaires_n_apparaissent_pas(client, superviseur, poste):
    """Les comptes de mères se gèrent depuis leur fiche, pas ici."""
    Utilisateur.objects.create_user(
        username="khady.ndiaye", password=MOT_DE_PASSE, role=Role.BENEFICIAIRE
    )
    connecter(client, superviseur)

    reponse = client.get("/api/agents/")

    identifiants = {ligne["username"] for ligne in reponse.data["results"]}
    assert "khady.ndiaye" not in identifiants


# --- Création ----------------------------------------------------------------


def test_le_superviseur_cree_un_agent(client, superviseur, poste):
    connecter(client, superviseur)

    reponse = client.post(
        "/api/agents/",
        {
            "username": "moussa.sow",
            "first_name": "Moussa",
            "last_name": "Sow",
            "role": "agent",
            "mot_de_passe": SOLIDE,
        },
        format="json",
    )

    assert reponse.status_code == 201
    cree = Utilisateur.objects.get(username="moussa.sow")
    assert cree.poste == poste
    assert cree.role == Role.AGENT


def test_un_compte_cree_doit_changer_son_mot_de_passe(client, superviseur):
    """Un mot de passe transmis par un tiers n'est pas un secret."""
    connecter(client, superviseur)

    client.post(
        "/api/agents/",
        {
            "username": "moussa.sow",
            "first_name": "Moussa",
            "last_name": "Sow",
            "role": "agent",
            "mot_de_passe": SOLIDE,
        },
        format="json",
    )

    assert Utilisateur.objects.get(username="moussa.sow").doit_changer_mot_de_passe


def test_le_superviseur_ne_cree_que_dans_son_poste(client, superviseur, poste, autre_poste):
    """Le poste demandé est ignoré : c'est celui du superviseur qui compte."""
    connecter(client, superviseur)

    client.post(
        "/api/agents/",
        {
            "username": "moussa.sow",
            "first_name": "Moussa",
            "last_name": "Sow",
            "role": "agent",
            "mot_de_passe": SOLIDE,
            "poste_id": str(autre_poste.identifiant_public),
        },
        format="json",
    )

    assert Utilisateur.objects.get(username="moussa.sow").poste == poste


def test_un_identifiant_deja_pris_est_refuse(client, superviseur, agent):
    connecter(client, superviseur)

    reponse = client.post(
        "/api/agents/",
        {
            "username": "awa.ndiaye",
            "first_name": "Awa",
            "last_name": "Ndiaye",
            "role": "agent",
            "mot_de_passe": SOLIDE,
        },
        format="json",
    )

    assert reponse.status_code == 400


def test_un_mot_de_passe_faible_est_refuse(client, superviseur):
    connecter(client, superviseur)

    reponse = client.post(
        "/api/agents/",
        {
            "username": "moussa.sow",
            "first_name": "Moussa",
            "last_name": "Sow",
            "role": "agent",
            "mot_de_passe": "12345678",
        },
        format="json",
    )

    assert reponse.status_code == 400


def test_on_ne_cree_pas_d_administrateur_par_cette_voie(client, superviseur):
    """Le rôle d'administrateur se donne en base ou par l'interface Django."""
    connecter(client, superviseur)

    reponse = client.post(
        "/api/agents/",
        {
            "username": "pirate",
            "first_name": "P",
            "last_name": "P",
            "role": "admin",
            "mot_de_passe": SOLIDE,
        },
        format="json",
    )

    assert reponse.status_code == 400


# --- Réinitialisation --------------------------------------------------------


def test_le_superviseur_reinitialise_un_mot_de_passe_oublie(client, superviseur, agent):
    connecter(client, superviseur)

    reponse = client.post(
        f"/api/agents/{agent.identifiant_public}/reinitialiser/",
        {"mot_de_passe": SOLIDE},
        format="json",
    )

    assert reponse.status_code == 204
    agent.refresh_from_db()
    assert agent.check_password(SOLIDE)
    assert agent.doit_changer_mot_de_passe


def test_on_ne_reinitialise_pas_son_propre_mot_de_passe(client, superviseur):
    connecter(client, superviseur)

    reponse = client.post(
        f"/api/agents/{superviseur.identifiant_public}/reinitialiser/",
        {"mot_de_passe": SOLIDE},
        format="json",
    )

    assert reponse.status_code == 400


# --- Activation --------------------------------------------------------------


def test_desactiver_un_compte_le_conserve(client, superviseur, agent):
    """Les actes enregistrés gardent leur auteur (RG-10)."""
    connecter(client, superviseur)

    reponse = client.post(f"/api/agents/{agent.identifiant_public}/basculer-activation/")

    assert reponse.status_code == 200
    agent.refresh_from_db()
    assert not agent.is_active
    assert Utilisateur.objects.filter(pk=agent.pk).exists()


def test_reactiver_un_compte(client, superviseur, agent):
    agent.is_active = False
    agent.save()

    connecter(client, superviseur)
    client.post(f"/api/agents/{agent.identifiant_public}/basculer-activation/")

    agent.refresh_from_db()
    assert agent.is_active


def test_on_ne_desactive_pas_son_propre_compte(client, superviseur):
    """Un poste sans superviseur actif ne pourrait plus créer de comptes."""
    connecter(client, superviseur)

    reponse = client.post(f"/api/agents/{superviseur.identifiant_public}/basculer-activation/")

    assert reponse.status_code == 400


# --- Transfert ---------------------------------------------------------------


def test_transferer_un_agent(client, superviseur, agent, autre_poste):
    connecter(client, superviseur)

    reponse = client.post(
        f"/api/agents/{agent.identifiant_public}/transferer/",
        {"poste_id": str(autre_poste.identifiant_public)},
        format="json",
    )

    assert reponse.status_code == 200
    agent.refresh_from_db()
    assert agent.poste == autre_poste


def test_un_agent_transfere_sort_du_perimetre(client, superviseur, agent, autre_poste):
    connecter(client, superviseur)
    client.post(
        f"/api/agents/{agent.identifiant_public}/transferer/",
        {"poste_id": str(autre_poste.identifiant_public)},
        format="json",
    )

    reponse = client.get("/api/agents/")

    identifiants = {ligne["username"] for ligne in reponse.data["results"]}
    assert "awa.ndiaye" not in identifiants


# --- Journal d'audit ---------------------------------------------------------


def test_une_creation_est_journalisee(client, superviseur):
    connecter(client, superviseur)

    client.post(
        "/api/agents/",
        {
            "username": "moussa.sow",
            "first_name": "Moussa",
            "last_name": "Sow",
            "role": "agent",
            "mot_de_passe": SOLIDE,
        },
        format="json",
    )

    acte = JournalAudit.objects.get(acte=ActeAdministration.CREATION_COMPTE)
    assert acte.auteur_identifiant == "fatou.gueye"
    assert acte.cible_identifiant == "moussa.sow"


def test_une_reinitialisation_est_journalisee(client, superviseur, agent):
    connecter(client, superviseur)
    client.post(
        f"/api/agents/{agent.identifiant_public}/reinitialiser/",
        {"mot_de_passe": SOLIDE},
        format="json",
    )

    assert JournalAudit.objects.filter(
        acte=ActeAdministration.REINITIALISATION, cible_identifiant="awa.ndiaye"
    ).exists()


def test_un_transfert_conserve_le_poste_d_origine_dans_la_trace(
    client, superviseur, agent, autre_poste
):
    connecter(client, superviseur)
    client.post(
        f"/api/agents/{agent.identifiant_public}/transferer/",
        {"poste_id": str(autre_poste.identifiant_public)},
        format="json",
    )

    acte = JournalAudit.objects.get(acte=ActeAdministration.TRANSFERT)
    assert "Poste de Joal" in acte.detail


def test_le_journal_est_reserve_a_l_administrateur(client, superviseur):
    """Un superviseur ne doit pas pouvoir vérifier ce que ses pairs ont fait."""
    connecter(client, superviseur)
    assert client.get("/api/audit/").status_code == 403


def test_l_administrateur_consulte_le_journal(client, administrateur, superviseur):
    connecter(client, administrateur)
    assert client.get("/api/audit/").status_code == 200


# --- Mot de passe obligatoire ------------------------------------------------


def test_un_compte_a_changer_ne_peut_rien_faire(client, superviseur):
    """Sans cette règle, un agent travaillerait avec le mot de passe que son
    superviseur connaît."""
    connecter(client, superviseur)
    client.post(
        "/api/agents/",
        {
            "username": "moussa.sow",
            "first_name": "Moussa",
            "last_name": "Sow",
            "role": "agent",
            "mot_de_passe": SOLIDE,
        },
        format="json",
    )

    nouveau = Utilisateur.objects.get(username="moussa.sow")
    client.force_authenticate(nouveau)

    assert client.get("/api/meres/").status_code == 403


def test_un_compte_a_changer_peut_changer_son_mot_de_passe(client, superviseur):
    connecter(client, superviseur)
    client.post(
        "/api/agents/",
        {
            "username": "moussa.sow",
            "first_name": "Moussa",
            "last_name": "Sow",
            "role": "agent",
            "mot_de_passe": SOLIDE,
        },
        format="json",
    )

    nouveau = Utilisateur.objects.get(username="moussa.sow")
    client.force_authenticate(nouveau)

    reponse = client.post(
        "/api/auth/mot-de-passe/",
        {"ancien_mot_de_passe": SOLIDE, "nouveau_mot_de_passe": "Thies-2026-Sante"},
        format="json",
    )

    assert reponse.status_code == 200
    nouveau.refresh_from_db()
    assert not nouveau.doit_changer_mot_de_passe


def test_apres_le_changement_l_acces_est_rendu(client, superviseur):
    connecter(client, superviseur)
    client.post(
        "/api/agents/",
        {
            "username": "moussa.sow",
            "first_name": "Moussa",
            "last_name": "Sow",
            "role": "agent",
            "mot_de_passe": SOLIDE,
        },
        format="json",
    )

    nouveau = Utilisateur.objects.get(username="moussa.sow")
    client.force_authenticate(nouveau)
    client.post(
        "/api/auth/mot-de-passe/",
        {"ancien_mot_de_passe": SOLIDE, "nouveau_mot_de_passe": "Thies-2026-Sante"},
        format="json",
    )

    nouveau.refresh_from_db()
    client.force_authenticate(nouveau)

    assert client.get("/api/meres/").status_code == 200


def test_changer_son_mot_de_passe_invalide_les_anciennes_sessions(client, superviseur):
    """Si le mot de passe est changé parce qu'il était compromis, une
    session ouverte ailleurs doit tomber."""
    connexion = client.post(
        "/api/auth/connexion/",
        {"username": "fatou.gueye", "password": MOT_DE_PASSE},
        format="json",
    )
    ancien_refresh = connexion.data["refresh"]

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {connexion.data['access']}")
    client.post(
        "/api/auth/mot-de-passe/",
        {"ancien_mot_de_passe": MOT_DE_PASSE, "nouveau_mot_de_passe": SOLIDE},
        format="json",
    )

    client.credentials()
    reponse = client.post("/api/auth/rafraichir/", {"refresh": ancien_refresh}, format="json")

    assert reponse.status_code == 401


def test_le_changement_renvoie_de_nouveaux_jetons(client, superviseur):
    """Sans cela, l'utilisateur serait déconnecté par le geste même qui
    sécurise son compte."""
    connexion = client.post(
        "/api/auth/connexion/",
        {"username": "fatou.gueye", "password": MOT_DE_PASSE},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {connexion.data['access']}")

    reponse = client.post(
        "/api/auth/mot-de-passe/",
        {"ancien_mot_de_passe": MOT_DE_PASSE, "nouveau_mot_de_passe": SOLIDE},
        format="json",
    )

    assert reponse.status_code == 200
    assert "access" in reponse.data
    assert "refresh" in reponse.data


def test_une_reinitialisation_coupe_les_sessions_de_l_agent(client, superviseur, agent):
    connexion = client.post(
        "/api/auth/connexion/",
        {"username": "awa.ndiaye", "password": MOT_DE_PASSE},
        format="json",
    )
    ancien_refresh = connexion.data["refresh"]

    connecter(client, superviseur)
    client.post(
        f"/api/agents/{agent.identifiant_public}/reinitialiser/",
        {"mot_de_passe": SOLIDE},
        format="json",
    )

    client.credentials()
    client.force_authenticate(None)
    reponse = client.post("/api/auth/rafraichir/", {"refresh": ancien_refresh}, format="json")

    assert reponse.status_code == 401


def test_desactiver_un_compte_coupe_ses_sessions(client, superviseur, agent):
    connexion = client.post(
        "/api/auth/connexion/",
        {"username": "awa.ndiaye", "password": MOT_DE_PASSE},
        format="json",
    )
    ancien_refresh = connexion.data["refresh"]

    connecter(client, superviseur)
    client.post(f"/api/agents/{agent.identifiant_public}/basculer-activation/")

    client.credentials()
    client.force_authenticate(None)
    reponse = client.post("/api/auth/rafraichir/", {"refresh": ancien_refresh}, format="json")

    assert reponse.status_code == 401
