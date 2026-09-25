"""Tests de l'accès bénéficiaire.

Le cloisonnement est ici plus strict que le cloisonnement par poste : une
mère ne doit jamais voir le dossier d'une autre, même dans le même poste.
Une faille ici exposerait le carnet d'un enfant à une inconnue.
"""

from datetime import date

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.accounts.models import Role, Utilisateur
from apps.beneficiaires.models import Enfant, Grossesse, Mere, Sexe

pytestmark = pytest.mark.django_db

MOT_DE_PASSE = "motdepasse-de-test-123"


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def schema():
    call_command("charger_schema_pev", verbosity=0)


def creer_mere_avec_acces(poste, prenom, nom, identifiant):
    compte = Utilisateur.objects.create_user(
        username=identifiant,
        password=MOT_DE_PASSE,
        first_name=prenom,
        last_name=nom,
        role=Role.BENEFICIAIRE,
    )
    return Mere.objects.create(prenom=prenom, nom=nom, poste=poste, compte=compte)


@pytest.fixture
def khady(schema, poste):
    mere = creer_mere_avec_acces(poste, "Khady", "Ndiaye", "khady.ndiaye")
    Enfant.objects.create(
        mere=mere,
        prenom="Moussa",
        date_naissance=date(2026, 1, 1),
        sexe=Sexe.MASCULIN,
        poste=poste,
    )
    return mere


@pytest.fixture
def bineta(schema, poste):
    """Une autre mère du même poste : c'est elle qui ne doit rien voir."""
    mere = creer_mere_avec_acces(poste, "Bineta", "Fall", "bineta.fall")
    Enfant.objects.create(
        mere=mere,
        prenom="Cheikh",
        date_naissance=date(2026, 2, 1),
        sexe=Sexe.MASCULIN,
        poste=poste,
    )
    return mere


def connecter(client, identifiant):
    reponse = client.post(
        "/api/auth/connexion/",
        {"username": identifiant, "password": MOT_DE_PASSE},
        format="json",
    )
    assert reponse.status_code == 200
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {reponse.data['access']}")


# --- Cloisonnement ----------------------------------------------------------


def test_la_mere_voit_son_propre_dossier(client, khady):
    connecter(client, "khady.ndiaye")
    reponse = client.get("/api/mon-dossier/profil/")

    assert reponse.status_code == 200
    assert reponse.data["nom_complet"] == "Khady Ndiaye"


def test_la_mere_ne_voit_que_ses_propres_enfants(client, khady, bineta):
    connecter(client, "khady.ndiaye")
    reponse = client.get("/api/mon-dossier/beneficiaires/")

    noms = [enfant["nom"] for enfant in reponse.data["enfants"]]
    assert "Moussa" in noms[0]
    assert not any("Cheikh" in nom for nom in noms)


def test_le_carnet_d_un_enfant_d_une_autre_mere_est_introuvable(client, khady, bineta):
    """Un identifiant valide mais rattaché à une autre mère reçoit la même
    réponse qu'un identifiant inconnu : ne rien divulguer, pas même
    l'existence."""
    enfant_de_bineta = bineta.enfants.first()

    connecter(client, "khady.ndiaye")
    reponse = client.get(f"/api/mon-dossier/carnet/{enfant_de_bineta.identifiant_public}/")

    assert reponse.status_code == 404


def test_les_rappels_ne_concernent_que_ses_beneficiaires(client, khady, bineta):
    from apps.suivi.services import rafraichir_statuts

    rafraichir_statuts()

    connecter(client, "khady.ndiaye")
    reponse = client.get("/api/mon-dossier/rappels/")

    beneficiaires = {ligne["beneficiaire"] for ligne in reponse.data}
    assert all("Cheikh" not in nom for nom in beneficiaires)


# --- Séparation des écrans --------------------------------------------------


def test_la_mere_n_accede_pas_a_la_file_du_jour(client, khady):
    connecter(client, "khady.ndiaye")
    assert client.get("/api/echeances/file-du-jour/").status_code == 403


def test_la_mere_n_accede_pas_a_la_liste_des_beneficiaires(client, khady):
    connecter(client, "khady.ndiaye")
    assert client.get("/api/meres/").status_code == 403


def test_la_mere_n_accede_pas_au_pilotage(client, khady):
    connecter(client, "khady.ndiaye")
    assert client.get("/api/pilotage/synthese/").status_code == 403


def test_la_mere_ne_peut_pas_enregistrer_de_dose(client, khady):
    connecter(client, "khady.ndiaye")
    reponse = client.post("/api/doses/", {}, format="json")
    assert reponse.status_code == 403


def test_l_agent_n_accede_pas_au_dossier_personnel(client, agent):
    """Le chemin inverse est aussi fermé : ces points d'accès sont réservés
    aux bénéficiaires."""
    connecter(client, "awa.ndiaye")
    assert client.get("/api/mon-dossier/profil/").status_code == 403


# --- Carnet -----------------------------------------------------------------


def test_le_carnet_de_son_enfant_est_accessible(client, khady):
    enfant = khady.enfants.first()

    connecter(client, "khady.ndiaye")
    reponse = client.get(f"/api/mon-dossier/carnet/{enfant.identifiant_public}/")

    assert reponse.status_code == 200
    assert reponse.data["type"] == "enfant"
    assert len(reponse.data["echeances"]) == 17


def test_le_carnet_d_une_grossesse_est_accessible(client, khady, poste):
    grossesse = Grossesse.objects.create(mere=khady, rang=1, date_reference=date(2026, 3, 1))

    connecter(client, "khady.ndiaye")
    reponse = client.get(f"/api/mon-dossier/carnet/{grossesse.identifiant_public}/")

    assert reponse.status_code == 200
    assert reponse.data["type"] == "grossesse"
    assert len(reponse.data["echeances"]) == 5


# --- Modification limitée ---------------------------------------------------


def test_la_mere_peut_corriger_son_telephone(client, khady):
    connecter(client, "khady.ndiaye")
    reponse = client.patch(
        "/api/mon-dossier/profil/", {"telephone": "+221770000099"}, format="json"
    )

    assert reponse.status_code == 200
    khady.refresh_from_db()
    assert khady.telephone == "+221770000099"


def test_la_mere_ne_peut_pas_changer_son_identite(client, khady):
    """Le nom figure sur le carnet et les actes : il n'est pas modifiable
    par la bénéficiaire."""
    connecter(client, "khady.ndiaye")
    client.patch("/api/mon-dossier/profil/", {"nom": "Usurpée"}, format="json")

    khady.refresh_from_db()
    assert khady.nom == "Ndiaye"


# --- Ouverture d'accès ------------------------------------------------------


def test_l_agent_ouvre_un_acces(client, agent, poste):
    mere = Mere.objects.create(prenom="Astou", nom="Mbaye", poste=poste)

    connecter(client, "awa.ndiaye")
    reponse = client.post(
        f"/api/meres/{mere.identifiant_public}/ouvrir-acces/",
        {"identifiant": "astou.mbaye", "mot_de_passe": "motdepasse-solide"},
        format="json",
    )

    assert reponse.status_code == 201
    mere.refresh_from_db()
    assert mere.compte is not None
    assert mere.compte.role == Role.BENEFICIAIRE


def test_un_identifiant_deja_pris_est_refuse(client, agent, poste, khady):
    mere = Mere.objects.create(prenom="Astou", nom="Mbaye", poste=poste)

    connecter(client, "awa.ndiaye")
    reponse = client.post(
        f"/api/meres/{mere.identifiant_public}/ouvrir-acces/",
        {"identifiant": "khady.ndiaye", "mot_de_passe": "motdepasse-solide"},
        format="json",
    )

    assert reponse.status_code == 400


def test_fermer_un_acces_desactive_le_compte(client, agent, khady):
    connecter(client, "awa.ndiaye")
    reponse = client.post(f"/api/meres/{khady.identifiant_public}/fermer-acces/")

    assert reponse.status_code == 204
    khady.refresh_from_db()
    assert khady.compte is None


def test_un_compte_ferme_ne_peut_plus_se_connecter(client, agent, khady):
    connecter(client, "awa.ndiaye")
    client.post(f"/api/meres/{khady.identifiant_public}/fermer-acces/")

    client.credentials()
    reponse = client.post(
        "/api/auth/connexion/",
        {"username": "khady.ndiaye", "password": MOT_DE_PASSE},
        format="json",
    )
    assert reponse.status_code == 401


def test_rouvrir_un_acces_reactive_le_compte(client, agent, khady):
    """Sans cela, chaque fermeture-réouverture laisserait un compte fantôme
    et obligerait la mère à retenir un nouvel identifiant."""
    connecter(client, "awa.ndiaye")
    client.post(f"/api/meres/{khady.identifiant_public}/fermer-acces/")

    reponse = client.post(
        f"/api/meres/{khady.identifiant_public}/ouvrir-acces/",
        {"identifiant": "khady.ndiaye", "mot_de_passe": "nouveau-motdepasse"},
        format="json",
    )

    assert reponse.status_code == 201
    assert reponse.data["reactive"] is True
    assert Utilisateur.objects.filter(username="khady.ndiaye").count() == 1


def test_un_compte_reactive_accepte_le_nouveau_mot_de_passe(client, agent, khady):
    connecter(client, "awa.ndiaye")
    client.post(f"/api/meres/{khady.identifiant_public}/fermer-acces/")
    client.post(
        f"/api/meres/{khady.identifiant_public}/ouvrir-acces/",
        {"identifiant": "khady.ndiaye", "mot_de_passe": "nouveau-motdepasse"},
        format="json",
    )

    client.credentials()
    reponse = client.post(
        "/api/auth/connexion/",
        {"username": "khady.ndiaye", "password": "nouveau-motdepasse"},
        format="json",
    )

    assert reponse.status_code == 200
