"""Tests de l'API des bénéficiaires : cloisonnement, consentement, validation."""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import PosteSante, Role, Utilisateur
from apps.beneficiaires.models import CanalRappel, Consentement, Enfant, Mere

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def autre_poste(db):
    return PosteSante.objects.create(nom="Poste de Joal", district="Mbour", region="Thiès")


@pytest.fixture
def autre_agent(db, autre_poste):
    return Utilisateur.objects.create_user(
        username="ibrahima.sow",
        password="motdepasse-de-test-123",
        role=Role.AGENT,
        poste=autre_poste,
    )


@pytest.fixture
def superviseur(db, poste):
    return Utilisateur.objects.create_user(
        username="modou.fall",
        password="motdepasse-de-test-123",
        role=Role.SUPERVISEUR,
        poste=poste,
    )


@pytest.fixture
def mere(poste):
    return Mere.objects.create(
        prenom="Awa",
        nom="Ndiaye",
        telephone="+221771234567",
        poste=poste,
        village="Ngaparou",
    )


@pytest.fixture
def mere_ailleurs(autre_poste):
    return Mere.objects.create(prenom="Fatou", nom="Sarr", poste=autre_poste)


def connecter(client, username):
    reponse = client.post(
        "/api/auth/connexion/",
        {"username": username, "password": "motdepasse-de-test-123"},
        format="json",
    )
    assert reponse.status_code == 200
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {reponse.data['access']}")


# --- EF-10 : enregistrement d'une mère --------------------------------------


def test_creer_une_mere(client, agent):
    connecter(client, "awa.ndiaye")
    reponse = client.post(
        "/api/meres/",
        {
            "prenom": "Bineta",
            "nom": "Diop",
            "telephone": "+221770000001",
            "langue": "wo",
            "village": "Somone",
        },
        format="json",
    )

    assert reponse.status_code == 201
    assert reponse.data["nom_complet"] == "Bineta Diop"
    assert not reponse.data["accepte_les_rappels"]


def test_le_poste_est_celui_de_l_agent_pas_celui_envoye(client, agent, autre_poste):
    """EF-03 à l'écriture : le client ne choisit pas le poste."""
    connecter(client, "awa.ndiaye")
    reponse = client.post(
        "/api/meres/",
        {
            "prenom": "Bineta",
            "nom": "Diop",
            "poste": str(autre_poste.identifiant_public),
        },
        format="json",
    )

    assert reponse.status_code == 201
    creee = Mere.objects.get(identifiant_public=reponse.data["id"])
    assert creee.poste == agent.poste


def test_telephone_invalide_refuse(client, agent):
    connecter(client, "awa.ndiaye")
    reponse = client.post(
        "/api/meres/",
        {"prenom": "Bineta", "nom": "Diop", "telephone": "pas-un-numero"},
        format="json",
    )
    assert reponse.status_code == 400


# --- EF-03 : cloisonnement en lecture ---------------------------------------


def test_l_agent_ne_voit_que_les_meres_de_son_poste(client, agent, mere, mere_ailleurs):
    connecter(client, "awa.ndiaye")
    reponse = client.get("/api/meres/")

    noms = [m["nom_complet"] for m in reponse.data["results"]]
    assert "Awa Ndiaye" in noms
    assert "Fatou Sarr" not in noms


def test_acceder_a_une_mere_d_un_autre_poste_renvoie_404(client, agent, mere_ailleurs):
    """404 et non 403 : un 403 confirmerait l'existence de la ressource."""
    connecter(client, "awa.ndiaye")
    reponse = client.get(f"/api/meres/{mere_ailleurs.identifiant_public}/")
    assert reponse.status_code == 404


def test_le_superviseur_voit_les_meres_de_son_poste(client, superviseur, mere):
    connecter(client, "modou.fall")
    reponse = client.get("/api/meres/")
    assert reponse.data["count"] == 1


def test_le_superviseur_ne_peut_pas_creer(client, superviseur):
    """Le superviseur consulte, il n'administre pas."""
    connecter(client, "modou.fall")
    reponse = client.post("/api/meres/", {"prenom": "Bineta", "nom": "Diop"}, format="json")
    assert reponse.status_code == 403


# --- EF-14 : recherche ------------------------------------------------------


def test_rechercher_par_nom(client, agent, mere):
    connecter(client, "awa.ndiaye")
    reponse = client.get("/api/meres/?search=Ndiaye")
    assert reponse.data["count"] == 1


def test_rechercher_par_telephone(client, agent, mere):
    connecter(client, "awa.ndiaye")
    reponse = client.get("/api/meres/?search=771234567")
    assert reponse.data["count"] == 1


def test_la_recherche_reste_cloisonnee(client, agent, mere_ailleurs):
    """Le filtre par poste s'applique avant la recherche."""
    connecter(client, "awa.ndiaye")
    reponse = client.get("/api/meres/?search=Sarr")
    assert reponse.data["count"] == 0


# --- ENF-21 : consentement --------------------------------------------------


def test_enregistrer_un_consentement(client, agent, mere):
    connecter(client, "awa.ndiaye")
    reponse = client.post(
        f"/api/meres/{mere.identifiant_public}/consentement/",
        {"canal": CanalRappel.WHATSAPP},
        format="json",
    )

    assert reponse.status_code == 201
    assert reponse.data["actif"]
    mere.refresh_from_db()
    assert mere.accepte_les_rappels


def test_le_consentement_trace_qui_l_a_recueilli(client, agent, mere):
    connecter(client, "awa.ndiaye")
    client.post(
        f"/api/meres/{mere.identifiant_public}/consentement/",
        {"canal": CanalRappel.WHATSAPP},
        format="json",
    )

    consentement = mere.consentements.first()
    assert consentement.recueilli_par == agent
    assert consentement.accorde_le is not None


def test_revoquer_le_consentement(client, agent, mere):
    connecter(client, "awa.ndiaye")
    client.post(
        f"/api/meres/{mere.identifiant_public}/consentement/",
        {"canal": CanalRappel.WHATSAPP},
        format="json",
    )
    reponse = client.post(f"/api/meres/{mere.identifiant_public}/revoquer-consentement/")

    assert reponse.status_code == 204
    mere.refresh_from_db()
    assert not mere.accepte_les_rappels


def test_revoquer_sans_consentement_ne_casse_rien(client, agent, mere):
    connecter(client, "awa.ndiaye")
    reponse = client.post(f"/api/meres/{mere.identifiant_public}/revoquer-consentement/")
    assert reponse.status_code == 204


def test_l_historique_est_visible_sur_la_fiche(client, agent, mere):
    connecter(client, "awa.ndiaye")
    ancien = Consentement.objects.create(
        mere=mere,
        canal=CanalRappel.SMS,
        accorde_le=timezone.now() - timedelta(days=30),
        recueilli_par=agent,
    )
    ancien.revoquer()
    Consentement.objects.create(mere=mere, canal=CanalRappel.WHATSAPP, recueilli_par=agent)

    reponse = client.get(f"/api/meres/{mere.identifiant_public}/")
    assert len(reponse.data["consentements"]) == 2


def test_consentir_pour_une_mere_d_un_autre_poste_echoue(client, agent, mere_ailleurs):
    connecter(client, "awa.ndiaye")
    reponse = client.post(
        f"/api/meres/{mere_ailleurs.identifiant_public}/consentement/",
        {"canal": CanalRappel.WHATSAPP},
        format="json",
    )
    assert reponse.status_code == 404


# --- EF-12 : enfants --------------------------------------------------------


def test_creer_un_enfant(client, agent, mere):
    connecter(client, "awa.ndiaye")
    reponse = client.post(
        "/api/enfants/",
        {
            "mere_id": str(mere.identifiant_public),
            "prenom": "Moussa",
            "nom": "Ndiaye",
            "date_naissance": "2026-01-15",
            "sexe": "M",
        },
        format="json",
    )

    assert reponse.status_code == 201
    assert reponse.data["nom_complet"] == "Moussa Ndiaye"
    assert reponse.data["mere"]["nom_complet"] == "Awa Ndiaye"


def test_l_enfant_herite_du_poste_de_sa_mere(client, agent, mere):
    connecter(client, "awa.ndiaye")
    reponse = client.post(
        "/api/enfants/",
        {
            "mere_id": str(mere.identifiant_public),
            "prenom": "Moussa",
            "date_naissance": "2026-01-15",
            "sexe": "M",
        },
        format="json",
    )

    enfant = Enfant.objects.get(identifiant_public=reponse.data["id"])
    assert enfant.poste == mere.poste


def test_rattacher_un_enfant_a_une_mere_d_un_autre_poste_echoue(client, agent, mere_ailleurs):
    """Sans ce contrôle, un agent pourrait écrire dans un autre poste."""
    connecter(client, "awa.ndiaye")
    reponse = client.post(
        "/api/enfants/",
        {
            "mere_id": str(mere_ailleurs.identifiant_public),
            "prenom": "Moussa",
            "date_naissance": "2026-01-15",
            "sexe": "M",
        },
        format="json",
    )

    assert reponse.status_code == 400
    assert "mere_id" in reponse.data


def test_enfant_sans_nom_est_accepte(client, agent, mere):
    """Le nom est souvent donné au baptême, après le BCG."""
    connecter(client, "awa.ndiaye")
    reponse = client.post(
        "/api/enfants/",
        {
            "mere_id": str(mere.identifiant_public),
            "prenom": "",
            "date_naissance": str(timezone.localdate()),
            "sexe": "F",
        },
        format="json",
    )

    assert reponse.status_code == 201
    assert "Awa Ndiaye" in reponse.data["nom_complet"]


def test_prematurite_signalee(client, agent, mere):
    connecter(client, "awa.ndiaye")
    reponse = client.post(
        "/api/enfants/",
        {
            "mere_id": str(mere.identifiant_public),
            "prenom": "Sokhna",
            "date_naissance": "2026-01-15",
            "sexe": "F",
            "semaines_gestation": 33,
        },
        format="json",
    )

    assert reponse.status_code == 201
    assert reponse.data["est_premature"]


# --- EF-11 : grossesses -----------------------------------------------------


def test_creer_une_grossesse(client, agent, mere):
    connecter(client, "awa.ndiaye")
    reponse = client.post(
        "/api/grossesses/",
        {
            "mere_id": str(mere.identifiant_public),
            "rang": 1,
            "date_reference": "2026-03-01",
            "terme_estime": "2026-10-15",
        },
        format="json",
    )

    assert reponse.status_code == 201
    assert reponse.data["statut"] == "en_cours"


def test_terme_avant_le_premier_contact_refuse(client, agent, mere):
    connecter(client, "awa.ndiaye")
    reponse = client.post(
        "/api/grossesses/",
        {
            "mere_id": str(mere.identifiant_public),
            "rang": 1,
            "date_reference": "2026-06-01",
            "terme_estime": "2026-05-01",
        },
        format="json",
    )

    assert reponse.status_code == 400
    assert "terme_estime" in reponse.data


# --- RG-10 : suppression logique --------------------------------------------


def test_la_suppression_est_logique(client, agent, mere):
    connecter(client, "awa.ndiaye")
    reponse = client.delete(f"/api/meres/{mere.identifiant_public}/")

    assert reponse.status_code == 204
    assert Mere.objects.count() == 0
    assert Mere.tous.count() == 1


# --- Jetons -----------------------------------------------------------------


def test_rafraichir_le_jeton(client, agent):
    """Vérifie que la liste noire des jetons est bien migrée."""
    connexion = client.post(
        "/api/auth/connexion/",
        {"username": "awa.ndiaye", "password": "motdepasse-de-test-123"},
        format="json",
    )
    reponse = client.post(
        "/api/auth/rafraichir/",
        {"refresh": connexion.data["refresh"]},
        format="json",
    )

    assert reponse.status_code == 200
    assert "access" in reponse.data


def test_un_jeton_de_rafraichissement_ne_sert_qu_une_fois(client, agent):
    """ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION."""
    connexion = client.post(
        "/api/auth/connexion/",
        {"username": "awa.ndiaye", "password": "motdepasse-de-test-123"},
        format="json",
    )
    ancien = connexion.data["refresh"]

    client.post("/api/auth/rafraichir/", {"refresh": ancien}, format="json")
    seconde = client.post("/api/auth/rafraichir/", {"refresh": ancien}, format="json")

    assert seconde.status_code == 401
