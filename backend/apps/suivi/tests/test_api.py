"""Tests de l'API du suivi : calendrier, file du jour, doses, annulation."""

import uuid
from datetime import date

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.accounts.models import PosteSante, Role, Utilisateur
from apps.beneficiaires.models import Enfant, Grossesse, Mere, Sexe
from apps.suivi.models import DoseAdministree, Echeance, MotifAnnulation, StatutEcheance

pytestmark = pytest.mark.django_db

NAISSANCE = date(2026, 1, 1)


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def schema():
    call_command("charger_schema_pev", verbosity=0)


@pytest.fixture
def mere(poste):
    return Mere.objects.create(prenom="Awa", nom="Ndiaye", poste=poste)


@pytest.fixture
def enfant(schema, mere, poste):
    return Enfant.objects.create(
        mere=mere,
        prenom="Moussa",
        date_naissance=NAISSANCE,
        sexe=Sexe.MASCULIN,
        poste=poste,
    )


@pytest.fixture
def autre_poste(db):
    return PosteSante.objects.create(nom="Poste de Joal", district="Mbour", region="Thiès")


@pytest.fixture
def enfant_ailleurs(schema, autre_poste):
    autre_mere = Mere.objects.create(prenom="Fatou", nom="Sarr", poste=autre_poste)
    return Enfant.objects.create(
        mere=autre_mere,
        prenom="Ousmane",
        date_naissance=NAISSANCE,
        sexe=Sexe.MASCULIN,
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


def connecter(client, username):
    reponse = client.post(
        "/api/auth/connexion/",
        {"username": username, "password": "motdepasse-de-test-123"},
        format="json",
    )
    assert reponse.status_code == 200
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {reponse.data['access']}")


def echeance_de(enfant, code, rang) -> Echeance:
    return Echeance.objects.get(enfant=enfant, vaccin__code=code, rang=rang)


# --- Calendrier -------------------------------------------------------------


def test_calendrier_d_un_enfant(client, agent, enfant):
    connecter(client, "awa.ndiaye")
    reponse = client.get(f"/api/enfants/{enfant.identifiant_public}/calendrier/")

    assert reponse.status_code == 200
    assert reponse.data["beneficiaire_nom"] == "Moussa"
    assert len(reponse.data["echeances"]) == 17


def test_le_calendrier_est_trie_par_date(client, agent, enfant):
    connecter(client, "awa.ndiaye")
    reponse = client.get(f"/api/enfants/{enfant.identifiant_public}/calendrier/")

    dates = [e["date_cible"] for e in reponse.data["echeances"]]
    assert dates == sorted(dates)


def test_le_calendrier_expose_les_statuts(client, agent, enfant):
    connecter(client, "awa.ndiaye")
    reponse = client.get(f"/api/enfants/{enfant.identifiant_public}/calendrier/")

    statuts = {e["statut"] for e in reponse.data["echeances"]}
    assert statuts <= {"a_venir", "due", "en_retard", "administree", "annulee"}


def test_calendrier_d_un_enfant_d_un_autre_poste_refuse(client, agent, enfant_ailleurs):
    connecter(client, "awa.ndiaye")
    reponse = client.get(f"/api/enfants/{enfant_ailleurs.identifiant_public}/calendrier/")
    assert reponse.status_code == 404


def test_calendrier_d_une_grossesse(client, agent, schema, mere):
    grossesse = Grossesse.objects.create(mere=mere, rang=1, date_reference=date(2026, 3, 1))
    connecter(client, "awa.ndiaye")
    reponse = client.get(f"/api/grossesses/{grossesse.identifiant_public}/calendrier/")

    assert reponse.status_code == 200
    assert len(reponse.data["echeances"]) == 5


# --- EF-42 : file du jour ---------------------------------------------------


def test_la_file_du_jour_liste_les_echeances_dues(client, agent, enfant):
    connecter(client, "awa.ndiaye")
    reponse = client.get("/api/echeances/file-du-jour/?date=2026-02-12")

    codes = {(e["vaccin_code"], e["rang"]) for e in reponse.data}
    assert ("PENTA", 1) in codes  # cible au 12 février, dû ce jour
    assert ("RR", 1) not in codes  # prévu à 9 mois, hors horizon


def test_la_file_ecarte_le_rattrapage_ancien(client, agent, enfant):
    """Une échéance dont la cible remonte à plus de 30 jours sans être
    en retard relève du rattrapage, pas de la file du jour : elle
    encombrerait l'écran sans appeler d'action immédiate."""
    connecter(client, "awa.ndiaye")
    reponse = client.get("/api/echeances/file-du-jour/?date=2026-02-12")

    codes = {(e["vaccin_code"], e["rang"]) for e in reponse.data}
    # BCG était dû à la naissance, 42 jours plus tôt, mais sa fenêtre de
    # rattrapage court jusqu'à 12 mois : il n'est pas « en retard ».
    assert ("BCG", 1) not in codes


def test_l_horizon_est_ajustable(client, agent, enfant):
    connecter(client, "awa.ndiaye")

    court = client.get("/api/echeances/file-du-jour/?date=2026-02-12&horizon=0")
    large = client.get("/api/echeances/file-du-jour/?date=2026-02-12&horizon=90")

    assert len(large.data) > len(court.data)


def test_la_file_expose_le_beneficiaire_sans_requete_supplementaire(client, agent, enfant):
    connecter(client, "awa.ndiaye")
    reponse = client.get("/api/echeances/file-du-jour/?date=2026-02-12")

    ligne = reponse.data[0]
    assert ligne["beneficiaire_nom"] == "Moussa"
    assert ligne["beneficiaire_type"] == "enfant"
    assert "telephone" in ligne


def test_la_file_est_cloisonnee_par_poste(client, agent, enfant, enfant_ailleurs):
    connecter(client, "awa.ndiaye")
    reponse = client.get("/api/echeances/file-du-jour/?date=2026-02-12")

    noms = {e["beneficiaire_nom"] for e in reponse.data}
    assert "Moussa" in noms
    assert "Ousmane" not in noms


def test_la_file_ignore_les_doses_deja_administrees(client, agent, enfant):
    connecter(client, "awa.ndiaye")
    client.post(
        "/api/doses/",
        {
            "echeance_id": str(echeance_de(enfant, "BCG", 1).identifiant_public),
            "date_administration": "2026-01-01",
        },
        format="json",
    )

    reponse = client.get("/api/echeances/file-du-jour/?date=2026-02-12")
    codes = {(e["vaccin_code"], e["rang"]) for e in reponse.data}
    assert ("BCG", 1) not in codes


def test_la_file_sans_date_utilise_aujourd_hui(client, agent, enfant):
    connecter(client, "awa.ndiaye")
    reponse = client.get("/api/echeances/file-du-jour/")
    assert reponse.status_code == 200


# --- EF-30 : enregistrement d'une dose --------------------------------------


def test_enregistrer_une_dose(client, agent, enfant):
    connecter(client, "awa.ndiaye")
    reponse = client.post(
        "/api/doses/",
        {
            "echeance_id": str(echeance_de(enfant, "PENTA", 1).identifiant_public),
            "date_administration": "2026-02-12",
            "numero_lot": "LOT-A",
        },
        format="json",
    )

    assert reponse.status_code == 201
    assert reponse.data["numero_lot"] == "LOT-A"
    assert echeance_de(enfant, "PENTA", 1).statut == StatutEcheance.ADMINISTREE


def test_dose_trop_precoce_refusee_avec_le_motif(client, agent, enfant):
    connecter(client, "awa.ndiaye")
    reponse = client.post(
        "/api/doses/",
        {
            "echeance_id": str(echeance_de(enfant, "PENTA", 1).identifiant_public),
            "date_administration": "2026-01-20",
        },
        format="json",
    )

    assert reponse.status_code == 400
    assert "age_minimal_non_atteint" in reponse.data["violations"]
    assert DoseAdministree.objects.count() == 0


def test_intervalle_non_respecte_refuse(client, agent, enfant):
    connecter(client, "awa.ndiaye")
    client.post(
        "/api/doses/",
        {
            "echeance_id": str(echeance_de(enfant, "PENTA", 1).identifiant_public),
            "date_administration": "2026-02-12",
        },
        format="json",
    )
    reponse = client.post(
        "/api/doses/",
        {
            "echeance_id": str(echeance_de(enfant, "PENTA", 2).identifiant_public),
            "date_administration": "2026-02-26",
        },
        format="json",
    )

    assert reponse.status_code == 400
    assert "intervalle_minimal_non_respecte" in reponse.data["violations"]


def test_dose_sur_une_echeance_d_un_autre_poste_refusee(client, agent, enfant_ailleurs):
    connecter(client, "awa.ndiaye")
    reponse = client.post(
        "/api/doses/",
        {
            "echeance_id": str(echeance_de(enfant_ailleurs, "BCG", 1).identifiant_public),
            "date_administration": "2026-01-01",
        },
        format="json",
    )
    assert reponse.status_code == 404


def test_la_dose_replanifie_les_suivantes(client, agent, enfant):
    """RG-04 vérifié à travers l'API."""
    connecter(client, "awa.ndiaye")
    client.post(
        "/api/doses/",
        {
            "echeance_id": str(echeance_de(enfant, "PENTA", 1).identifiant_public),
            "date_administration": "2026-02-12",
        },
        format="json",
    )
    client.post(
        "/api/doses/",
        {
            "echeance_id": str(echeance_de(enfant, "PENTA", 2).identifiant_public),
            "date_administration": "2026-04-02",
        },
        format="json",
    )

    assert echeance_de(enfant, "PENTA", 3).date_cible == date(2026, 4, 30)


def test_le_superviseur_ne_peut_pas_enregistrer_de_dose(client, superviseur, enfant):
    connecter(client, "modou.fall")
    reponse = client.post(
        "/api/doses/",
        {
            "echeance_id": str(echeance_de(enfant, "BCG", 1).identifiant_public),
            "date_administration": "2026-01-01",
        },
        format="json",
    )
    assert reponse.status_code == 403


# --- EF-54 : idempotence ----------------------------------------------------


def test_rejouer_la_meme_cle_ne_cree_pas_de_doublon(client, agent, enfant):
    connecter(client, "awa.ndiaye")
    cle = str(uuid.uuid4())
    corps = {
        "echeance_id": str(echeance_de(enfant, "PENTA", 1).identifiant_public),
        "date_administration": "2026-02-12",
        "cle_idempotence": cle,
    }

    premiere = client.post("/api/doses/", corps, format="json")
    seconde = client.post("/api/doses/", corps, format="json")

    assert premiere.status_code == 201
    assert seconde.status_code == 201
    assert premiere.data["id"] == seconde.data["id"]
    assert DoseAdministree.objects.count() == 1


def test_sans_cle_le_serveur_en_genere_une(client, agent, enfant):
    connecter(client, "awa.ndiaye")
    client.post(
        "/api/doses/",
        {
            "echeance_id": str(echeance_de(enfant, "BCG", 1).identifiant_public),
            "date_administration": "2026-01-01",
        },
        format="json",
    )

    dose = DoseAdministree.objects.get()
    assert dose.cle_idempotence is not None


# --- EF-27 : annulation -----------------------------------------------------


def test_annuler_une_echeance(client, agent, enfant):
    connecter(client, "awa.ndiaye")
    echeance = echeance_de(enfant, "ROTA", 1)
    reponse = client.post(
        f"/api/echeances/{echeance.identifiant_public}/annuler/",
        {
            "motif": MotifAnnulation.CONTRE_INDICATION,
            "commentaire": "Allergie documentée",
        },
        format="json",
    )

    assert reponse.status_code == 200
    assert reponse.data["statut"] == "annulee"


def test_annuler_une_dose_administree_echoue(client, agent, enfant):
    connecter(client, "awa.ndiaye")
    echeance = echeance_de(enfant, "BCG", 1)
    client.post(
        "/api/doses/",
        {
            "echeance_id": str(echeance.identifiant_public),
            "date_administration": "2026-01-01",
        },
        format="json",
    )
    reponse = client.post(
        f"/api/echeances/{echeance.identifiant_public}/annuler/",
        {"motif": MotifAnnulation.AUTRE},
        format="json",
    )

    assert reponse.status_code == 400


def test_motif_d_annulation_invalide_refuse(client, agent, enfant):
    connecter(client, "awa.ndiaye")
    echeance = echeance_de(enfant, "ROTA", 1)
    reponse = client.post(
        f"/api/echeances/{echeance.identifiant_public}/annuler/",
        {"motif": "raison-inventee"},
        format="json",
    )
    assert reponse.status_code == 400


def test_une_echeance_annulee_disparait_de_la_file(client, agent, enfant):
    """RG-08 : plus aucun rappel pour une échéance annulée."""
    connecter(client, "awa.ndiaye")
    echeance = echeance_de(enfant, "PENTA", 1)
    client.post(
        f"/api/echeances/{echeance.identifiant_public}/annuler/",
        {"motif": MotifAnnulation.REFUS},
        format="json",
    )

    reponse = client.get("/api/echeances/file-du-jour/?date=2026-02-12")
    codes = {(e["vaccin_code"], e["rang"]) for e in reponse.data}
    assert ("PENTA", 1) not in codes


# --- Lecture seule ----------------------------------------------------------


def test_les_echeances_ne_se_creent_pas_directement(client, agent, enfant):
    """Seul le moteur produit des échéances."""
    connecter(client, "awa.ndiaye")
    reponse = client.post("/api/echeances/", {}, format="json")
    assert reponse.status_code == 405
