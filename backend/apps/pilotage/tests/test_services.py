"""Tests des indicateurs de pilotage.

Un indicateur faux affiché avec assurance induit en erreur davantage qu'un
indicateur absent. Ces tests vérifient surtout les dénominateurs.
"""

from datetime import timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.beneficiaires.models import Enfant, Mere, Sexe
from apps.pilotage.services import (
    couverture_par_vaccin,
    enfants_en_retard,
    synthese,
    taux_abandon,
)
from apps.suivi.models import DoseAdministree, Echeance
from apps.suivi.services import enregistrer_dose

pytestmark = pytest.mark.django_db


@pytest.fixture
def schema():
    call_command("charger_schema_pev", verbosity=0)


@pytest.fixture
def mere(poste):
    return Mere.objects.create(prenom="Awa", nom="Ndiaye", poste=poste)


def creer_enfant(mere, poste, jours: int, prenom: str = "Moussa") -> Enfant:
    return Enfant.objects.create(
        mere=mere,
        prenom=prenom,
        date_naissance=timezone.localdate() - timedelta(days=jours),
        sexe=Sexe.MASCULIN,
        poste=poste,
    )


def administrer(enfant, agent, code: str, rang: int, il_y_a: int):
    echeance = Echeance.objects.get(enfant=enfant, vaccin__code=code, rang=rang)
    return enregistrer_dose(
        echeance=echeance,
        date_administration=timezone.localdate() - timedelta(days=il_y_a),
        agent=agent,
    )


# --- EF-60 : couverture -----------------------------------------------------


def test_les_echeances_a_venir_ne_comptent_pas_au_denominateur(schema, mere, poste):
    """Un enfant de deux mois n'est pas « non couvert » pour la rougeole
    prévue à neuf mois : cette échéance n'est pas encore due."""
    enfant = creer_enfant(mere, poste, jours=60)
    echeances = Echeance.objects.filter(enfant=enfant)

    couverture = {c.code: c for c in couverture_par_vaccin(echeances)}

    # RR est prévu à 9 mois : hors du dénominateur.
    assert "RR" not in couverture
    # BCG était dû à la naissance : il y figure.
    assert "BCG" in couverture


def test_une_dose_administree_fait_monter_le_taux(schema, mere, poste, agent):
    enfant = creer_enfant(mere, poste, jours=60)
    administrer(enfant, agent, "BCG", 1, il_y_a=59)

    echeances = Echeance.objects.filter(enfant=enfant)
    bcg = next(c for c in couverture_par_vaccin(echeances) if c.code == "BCG")

    assert bcg.administres == 1
    assert bcg.attendus == 1
    assert bcg.taux == 100.0


def test_un_taux_est_nul_sans_aucune_dose(schema, mere, poste):
    enfant = creer_enfant(mere, poste, jours=60)
    echeances = Echeance.objects.filter(enfant=enfant)

    bcg = next(c for c in couverture_par_vaccin(echeances) if c.code == "BCG")
    assert bcg.taux == 0.0


def test_la_couverture_distingue_les_rangs(schema, mere, poste, agent):
    """Penta-1 et Penta-2 sont deux indicateurs distincts."""
    enfant = creer_enfant(mere, poste, jours=120)
    administrer(enfant, agent, "PENTA", 1, il_y_a=75)

    echeances = Echeance.objects.filter(enfant=enfant)
    penta = {c.rang: c for c in couverture_par_vaccin(echeances) if c.code == "PENTA"}

    assert penta[1].administres == 1
    assert penta[2].administres == 0


# --- EF-61 : abandon --------------------------------------------------------


def test_le_taux_d_abandon_mesure_la_perte_en_cours_de_serie(schema, mere, poste, agent):
    """Trois enfants commencent Penta, un seul la termine : 67 % d'abandon."""
    for index in range(3):
        enfant = creer_enfant(mere, poste, jours=200, prenom=f"Enfant{index}")
        administrer(enfant, agent, "PENTA", 1, il_y_a=155)
        if index == 0:
            administrer(enfant, agent, "PENTA", 2, il_y_a=125)
            administrer(enfant, agent, "PENTA", 3, il_y_a=95)

    echeances = Echeance.objects.all()
    penta = next(a for a in taux_abandon(echeances) if a.code == "PENTA")

    assert penta.premiere_dose == 3
    assert penta.derniere_dose == 1
    assert penta.taux == 66.7


def test_une_serie_jamais_commencee_n_apparait_pas(schema, mere, poste):
    """Sans première dose, il n'y a pas d'abandon : il n'y a pas de début."""
    creer_enfant(mere, poste, jours=200)

    echeances = Echeance.objects.all()
    assert all(a.code != "PENTA" for a in taux_abandon(echeances))


def test_une_serie_complete_n_a_aucun_abandon(schema, mere, poste, agent):
    enfant = creer_enfant(mere, poste, jours=200)
    administrer(enfant, agent, "PENTA", 1, il_y_a=155)
    administrer(enfant, agent, "PENTA", 2, il_y_a=125)
    administrer(enfant, agent, "PENTA", 3, il_y_a=95)

    echeances = Echeance.objects.all()
    penta = next(a for a in taux_abandon(echeances) if a.code == "PENTA")

    assert penta.taux == 0.0


# --- Synthèse ---------------------------------------------------------------


def test_la_synthese_compte_les_enfants_suivis(schema, mere, poste):
    creer_enfant(mere, poste, jours=60, prenom="A")
    creer_enfant(mere, poste, jours=90, prenom="B")

    resultat = synthese(Enfant.objects.all(), Echeance.objects.all(), DoseAdministree.objects.all())
    assert resultat.enfants_suivis == 2


def test_la_synthese_compte_les_doses_du_mois(schema, mere, poste, agent):
    enfant = creer_enfant(mere, poste, jours=60)
    administrer(enfant, agent, "BCG", 1, il_y_a=0)

    resultat = synthese(Enfant.objects.all(), Echeance.objects.all(), DoseAdministree.objects.all())
    assert resultat.doses_du_mois == 1


def test_la_synthese_sur_une_base_vide_ne_divise_pas_par_zero(db):
    resultat = synthese(
        Enfant.objects.none(), Echeance.objects.none(), DoseAdministree.objects.none()
    )

    assert resultat.enfants_suivis == 0
    assert resultat.couverture_globale == 0.0


# --- EF-62 : liste nominative -----------------------------------------------


def test_la_liste_des_retards_expose_le_contact(schema, mere, poste):
    """La liste doit permettre de joindre la mère : c'est son unique
    raison d'être (EF-62)."""
    from apps.suivi.services import rafraichir_statuts

    mere.telephone = "+221771000001"
    mere.village = "Ndondol"
    mere.save()

    creer_enfant(mere, poste, jours=250)
    rafraichir_statuts()

    lignes = enfants_en_retard(Echeance.objects.all())

    assert lignes
    assert lignes[0]["telephone"] == "+221771000001"
    assert lignes[0]["village"] == "Ndondol"
    assert lignes[0]["vaccin"]
    assert lignes[0]["mere"] == "Awa Ndiaye"


def test_les_retards_sont_tries_du_plus_urgent_au_moins_urgent(schema, mere, poste):
    """Le tri suit la date limite : la fenêtre qui se referme le plus tôt
    appelle l'action la plus urgente."""
    from apps.suivi.services import rafraichir_statuts

    creer_enfant(mere, poste, jours=250, prenom="Ancien")
    creer_enfant(mere, poste, jours=150, prenom="Recent")
    rafraichir_statuts()

    lignes = enfants_en_retard(Echeance.objects.all())
    limites = [ligne["date_limite"] for ligne in lignes if ligne["date_limite"]]

    assert limites == sorted(limites)


def test_la_limite_est_respectee(schema, mere, poste):
    from apps.suivi.services import rafraichir_statuts

    creer_enfant(mere, poste, jours=250)
    rafraichir_statuts()

    assert len(enfants_en_retard(Echeance.objects.all(), limite=3)) <= 3
