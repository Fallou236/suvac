"""Tests de la gestion des postes de santé.

Deux règles structurent ces tests : créer un poste relève du district,
corriger le sien relève du poste. Et personne ne ferme un poste dont le
personnel travaille encore.
"""

import pytest
from rest_framework.test import APIClient

from apps.accounts.audit import ActeAdministration, JournalAudit
from apps.accounts.models import PosteSante, Role, Utilisateur

pytestmark = pytest.mark.django_db

MOT_DE_PASSE = "motdepasse-de-test-123"


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def superviseur(db, poste):
    return Utilisateur.objects.create_user(
        username="fatou.gueye",
        password=MOT_DE_PASSE,
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


# --- Consultation ------------------------------------------------------------


def test_tout_le_personnel_consulte_la_liste(client, agent, poste):
    """Un agent a besoin de la liste : elle alimente les formulaires."""
    connecter(client, agent)
    assert client.get("/api/postes/").status_code == 200


def test_la_liste_compte_le_personnel_et_les_beneficiaires(client, superviseur, poste, agent):
    """Le nombre d'agents dit si un poste peut être fermé."""
    connecter(client, superviseur)
    reponse = client.get("/api/postes/")

    ligne = next(p for p in reponse.data["results"] if p["nom"] == poste.nom)
    assert ligne["nombre_agents"] == 2


def test_filtrer_les_postes_actifs(client, superviseur, poste, autre_poste):
    autre_poste.actif = False
    autre_poste.save()

    connecter(client, superviseur)
    reponse = client.get("/api/postes/?actifs=true")

    noms = {p["nom"] for p in reponse.data["results"]}
    assert "Poste de Joal" not in noms


# --- Création ----------------------------------------------------------------


def test_l_administrateur_cree_un_poste(client, administrateur):
    connecter(client, administrateur)

    reponse = client.post(
        "/api/postes/",
        {"nom": "Poste de Khombole", "district": "Thiès", "region": "Thiès"},
        format="json",
    )

    assert reponse.status_code == 201
    assert PosteSante.objects.filter(nom="Poste de Khombole").exists()


def test_le_superviseur_ne_cree_pas_de_poste(client, superviseur):
    """Ouvrir un poste est une décision de district."""
    connecter(client, superviseur)

    reponse = client.post(
        "/api/postes/",
        {"nom": "Poste de Khombole", "district": "Thiès", "region": "Thiès"},
        format="json",
    )

    assert reponse.status_code == 403


def test_un_nom_deja_pris_dans_le_district_est_refuse(client, administrateur, poste):
    connecter(client, administrateur)

    reponse = client.post(
        "/api/postes/",
        {"nom": poste.nom, "district": poste.district, "region": poste.region},
        format="json",
    )

    assert reponse.status_code == 400


def test_le_meme_nom_dans_un_autre_district_est_accepte(client, administrateur, poste):
    """Deux villages homonymes existent dans des districts différents."""
    connecter(client, administrateur)

    reponse = client.post(
        "/api/postes/",
        {"nom": poste.nom, "district": "Autre district", "region": "Thiès"},
        format="json",
    )

    assert reponse.status_code == 201


# --- Modification ------------------------------------------------------------


def test_le_superviseur_corrige_son_propre_poste(client, superviseur, poste):
    """Une faute de frappe ne devrait pas demander une sollicitation du
    district."""
    connecter(client, superviseur)

    reponse = client.patch(
        f"/api/postes/{poste.identifiant_public}/",
        {"telephone": "+221339000001"},
        format="json",
    )

    assert reponse.status_code == 200
    poste.refresh_from_db()
    assert poste.telephone == "+221339000001"


def test_le_superviseur_ne_modifie_pas_un_autre_poste(client, superviseur, autre_poste):
    connecter(client, superviseur)

    reponse = client.patch(
        f"/api/postes/{autre_poste.identifiant_public}/",
        {"nom": "Détourné"},
        format="json",
    )

    assert reponse.status_code == 403


def test_l_administrateur_modifie_n_importe_quel_poste(client, administrateur, autre_poste):
    connecter(client, administrateur)

    reponse = client.patch(
        f"/api/postes/{autre_poste.identifiant_public}/",
        {"nom": "Poste de Joal-Fadiouth"},
        format="json",
    )

    assert reponse.status_code == 200


def test_un_agent_ne_modifie_aucun_poste(client, agent, poste):
    connecter(client, agent)

    reponse = client.patch(
        f"/api/postes/{poste.identifiant_public}/",
        {"telephone": "+221339000001"},
        format="json",
    )

    assert reponse.status_code == 403


def test_la_localisation_est_modifiable(client, superviseur, poste):
    connecter(client, superviseur)

    reponse = client.patch(
        f"/api/postes/{poste.identifiant_public}/",
        {"latitude": "14.789000", "longitude": "-16.926000"},
        format="json",
    )

    assert reponse.status_code == 200
    poste.refresh_from_db()
    assert poste.latitude is not None


# --- Fermeture ---------------------------------------------------------------


def test_un_poste_avec_du_personnel_ne_se_ferme_pas(client, administrateur, poste, agent):
    """Fermer laisserait ses agents sans rattachement, avec des données
    devenues inaccessibles."""
    connecter(client, administrateur)

    reponse = client.post(f"/api/postes/{poste.identifiant_public}/basculer-activation/")

    assert reponse.status_code == 400
    poste.refresh_from_db()
    assert poste.actif


def test_un_poste_vide_se_ferme(client, administrateur, autre_poste):
    connecter(client, administrateur)

    reponse = client.post(f"/api/postes/{autre_poste.identifiant_public}/basculer-activation/")

    assert reponse.status_code == 200
    autre_poste.refresh_from_db()
    assert not autre_poste.actif


def test_un_poste_ferme_se_rouvre(client, administrateur, autre_poste):
    autre_poste.actif = False
    autre_poste.save()

    connecter(client, administrateur)
    client.post(f"/api/postes/{autre_poste.identifiant_public}/basculer-activation/")

    autre_poste.refresh_from_db()
    assert autre_poste.actif


def test_un_poste_n_est_jamais_supprime(client, administrateur, autre_poste):
    """Son historique et ses bénéficiaires lui restent rattachés."""
    connecter(client, administrateur)

    reponse = client.delete(f"/api/postes/{autre_poste.identifiant_public}/")

    assert reponse.status_code == 405


# --- Audit -------------------------------------------------------------------


def test_la_creation_d_un_poste_est_journalisee(client, administrateur):
    connecter(client, administrateur)

    client.post(
        "/api/postes/",
        {"nom": "Poste de Khombole", "district": "Thiès", "region": "Thiès"},
        format="json",
    )

    acte = JournalAudit.objects.get(acte=ActeAdministration.CREATION_POSTE)
    assert "Khombole" in acte.detail


def test_un_changement_de_nom_est_journalise(client, superviseur, poste):
    connecter(client, superviseur)

    client.patch(
        f"/api/postes/{poste.identifiant_public}/",
        {"nom": "Poste de Santé de Ndondol"},
        format="json",
    )

    acte = JournalAudit.objects.filter(acte=ActeAdministration.MODIFICATION_POSTE).first()
    assert acte is not None
    assert "→" in acte.detail


def test_un_changement_de_telephone_n_est_pas_journalise(client, superviseur, poste):
    """Le journal doit rester lisible : seuls les changements structurants
    y figurent."""
    connecter(client, superviseur)

    client.patch(
        f"/api/postes/{poste.identifiant_public}/",
        {"telephone": "+221339000001"},
        format="json",
    )

    assert not JournalAudit.objects.filter(acte=ActeAdministration.MODIFICATION_POSTE).exists()
