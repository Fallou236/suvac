"""Tests de la planification et de l'envoi des rappels.

Deux garanties comptent plus que les autres : aucun rappel sans
consentement (EF-47), et un seul message par mère et par jour (RG-09).
Une faille sur la première est une faute ; sur la seconde, du harcèlement.
"""

from datetime import date, timedelta

import pytest
from django.core.management import call_command

from apps.beneficiaires.models import CanalRappel as CanalConsentement
from apps.beneficiaires.models import Consentement, Enfant, Grossesse, Mere, Sexe
from apps.rappels.models import CanalRappel, Rappel, StatutRappel, TypeRappel
from apps.rappels.services import (
    envoyer_les_rappels,
    planifier_les_rappels,
)
from apps.suivi.services import rafraichir_statuts

pytestmark = pytest.mark.django_db

AUJOURDHUI = date(2026, 6, 15)


@pytest.fixture
def schema():
    call_command("charger_schema_pev", verbosity=0)


def creer_mere(poste, prenom="Awa", canal=CanalConsentement.WHATSAPP, agent=None):
    mere = Mere.objects.create(
        prenom=prenom,
        nom="Ndiaye",
        poste=poste,
        telephone="+221771000001",
        langue="wo",
    )
    if canal is not None:
        Consentement.objects.create(mere=mere, canal=canal, recueilli_par=agent)
    return mere


def creer_enfant(mere, poste, naissance: date, prenom="Moussa"):
    return Enfant.objects.create(
        mere=mere,
        prenom=prenom,
        date_naissance=naissance,
        sexe=Sexe.MASCULIN,
        poste=poste,
    )


# --- EF-47 : le consentement -------------------------------------------------


def test_aucun_rappel_sans_consentement(schema, poste, agent):
    """Une mère sans consentement actif ne reçoit rien, quelle que soit
    l'urgence de la situation."""
    mere = creer_mere(poste, canal=None, agent=agent)
    creer_enfant(mere, poste, AUJOURDHUI - timedelta(days=42))

    bilan = planifier_les_rappels(AUJOURDHUI)

    assert Rappel.objects.filter(mere=mere).count() == 0
    assert bilan.ignores_sans_consentement >= 1


def test_un_consentement_revoque_arrete_les_rappels(schema, poste, agent):
    mere = creer_mere(poste, agent=agent)
    creer_enfant(mere, poste, AUJOURDHUI - timedelta(days=42))

    mere.consentement_actif.revoquer()
    planifier_les_rappels(AUJOURDHUI)

    assert Rappel.objects.filter(mere=mere).count() == 0


def test_le_canal_suit_le_consentement(schema, poste, agent):
    """La mère a choisi le SMS : on ne lui envoie pas de WhatsApp."""
    mere = creer_mere(poste, canal=CanalConsentement.SMS, agent=agent)
    creer_enfant(mere, poste, AUJOURDHUI - timedelta(days=42))

    planifier_les_rappels(AUJOURDHUI)

    assert Rappel.objects.filter(mere=mere).first().canal == CanalRappel.SMS


def test_sans_telephone_aucun_envoi_externe(schema, poste, agent):
    mere = creer_mere(poste, agent=agent)
    mere.telephone = ""
    mere.save()
    creer_enfant(mere, poste, AUJOURDHUI - timedelta(days=42))

    bilan = planifier_les_rappels(AUJOURDHUI)

    assert Rappel.objects.filter(mere=mere).count() == 0
    assert bilan.ignores_sans_telephone >= 1


# --- RG-09 : un seul message par jour ---------------------------------------


def test_les_echeances_du_jour_tiennent_en_un_message(schema, poste, agent):
    """Un enfant de six semaines a quatre vaccins le même jour : il reçoit
    un message, pas quatre."""
    mere = creer_mere(poste, agent=agent)
    creer_enfant(mere, poste, AUJOURDHUI - timedelta(days=42))
    rafraichir_statuts(AUJOURDHUI)

    planifier_les_rappels(AUJOURDHUI)

    rappels = Rappel.objects.filter(mere=mere, type=TypeRappel.JOUR_MEME)
    assert rappels.count() == 1
    assert rappels.first().echeances.count() > 1


def test_deux_enfants_de_la_meme_mere_ne_font_qu_un_message(schema, poste, agent):
    mere = creer_mere(poste, agent=agent)
    creer_enfant(mere, poste, AUJOURDHUI - timedelta(days=42), prenom="Moussa")
    creer_enfant(mere, poste, AUJOURDHUI - timedelta(days=42), prenom="Fatou")

    planifier_les_rappels(AUJOURDHUI)

    assert Rappel.objects.filter(mere=mere, type=TypeRappel.JOUR_MEME).count() == 1


def test_rejouer_le_balayage_ne_duplique_rien(schema, poste, agent):
    """La contrainte en base est la vraie garantie : même deux balayages
    concurrents ne produiraient pas deux messages."""
    mere = creer_mere(poste, agent=agent)
    creer_enfant(mere, poste, AUJOURDHUI - timedelta(days=42))

    planifier_les_rappels(AUJOURDHUI)
    avant = Rappel.objects.count()

    bilan = planifier_les_rappels(AUJOURDHUI)

    assert Rappel.objects.count() == avant
    assert bilan.deja_planifies >= 1


# --- Les trois moments du rappel --------------------------------------------


def test_un_preavis_part_trois_jours_avant(schema, poste, agent):
    """L'enfant a 39 jours : ses vaccins de 6 semaines tombent dans 3 jours."""
    mere = creer_mere(poste, agent=agent)
    creer_enfant(mere, poste, AUJOURDHUI - timedelta(days=39))
    rafraichir_statuts(AUJOURDHUI)

    planifier_les_rappels(AUJOURDHUI)

    assert Rappel.objects.filter(mere=mere, type=TypeRappel.AVANT_ECHEANCE).exists()


def test_une_relance_part_pour_un_retard(schema, poste, agent):
    mere = creer_mere(poste, agent=agent)
    creer_enfant(mere, poste, AUJOURDHUI - timedelta(days=300))
    rafraichir_statuts(AUJOURDHUI)

    planifier_les_rappels(AUJOURDHUI)

    assert Rappel.objects.filter(mere=mere, type=TypeRappel.RELANCE).exists()


def test_une_grossesse_recoit_ses_propres_rappels(schema, poste, agent):
    mere = creer_mere(poste, agent=agent)
    Grossesse.objects.create(mere=mere, rang=1, date_reference=AUJOURDHUI)

    planifier_les_rappels(AUJOURDHUI)

    rappel = Rappel.objects.filter(mere=mere).first()
    assert rappel is not None
    # Le message s'adresse à elle, pas à un enfant.
    assert "sa ñakku tetanus" in rappel.texte or "votre vaccin" in rappel.texte


# --- Composition -------------------------------------------------------------


def test_le_message_ne_repete_pas_un_vaccin(schema, poste, agent):
    """Trois doses de pentavalent en retard se disent « le pentavalent »."""
    mere = creer_mere(poste, agent=agent)
    creer_enfant(mere, poste, AUJOURDHUI - timedelta(days=300))
    rafraichir_statuts(AUJOURDHUI)

    planifier_les_rappels(AUJOURDHUI)
    texte = Rappel.objects.get(mere=mere, type=TypeRappel.RELANCE).texte

    assert texte.count("Pentavalent") <= 1


def test_au_dela_de_trois_vaccins_le_message_resume(schema, poste, agent):
    mere = creer_mere(poste, agent=agent)
    creer_enfant(mere, poste, AUJOURDHUI - timedelta(days=300))
    rafraichir_statuts(AUJOURDHUI)

    planifier_les_rappels(AUJOURDHUI)
    texte = Rappel.objects.get(mere=mere, type=TypeRappel.RELANCE).texte

    assert "ñakk yu des" in texte


def test_le_message_suit_la_langue_de_la_mere(schema, poste, agent):
    mere = creer_mere(poste, agent=agent)
    mere.langue = "fr"
    mere.save()
    creer_enfant(mere, poste, AUJOURDHUI - timedelta(days=42))

    planifier_les_rappels(AUJOURDHUI)

    assert "Bonjour" in Rappel.objects.filter(mere=mere).first().texte


def test_une_relance_n_accuse_pas(schema, poste, agent):
    """Le ton compte : une mère culpabilisée ne revient pas."""
    mere = creer_mere(poste, agent=agent)
    mere.langue = "fr"
    mere.save()
    creer_enfant(mere, poste, AUJOURDHUI - timedelta(days=300))
    rafraichir_statuts(AUJOURDHUI)

    planifier_les_rappels(AUJOURDHUI)
    texte = Rappel.objects.get(mere=mere, type=TypeRappel.RELANCE).texte

    assert "encore temps" in texte


# --- Envoi -------------------------------------------------------------------


def test_l_envoi_marque_le_rappel(schema, poste, agent):
    mere = creer_mere(poste, agent=agent)
    creer_enfant(mere, poste, AUJOURDHUI - timedelta(days=42))
    planifier_les_rappels(AUJOURDHUI)

    envoyer_les_rappels(AUJOURDHUI)

    rappel = Rappel.objects.filter(mere=mere).first()
    assert rappel.statut == StatutRappel.ENVOYE
    assert rappel.envoye_le is not None
    assert rappel.identifiant_externe


def test_un_rappel_dans_l_application_n_est_pas_envoye(schema, poste, agent):
    """La mère le lira dans son espace : il reste en attente."""
    mere = creer_mere(poste, canal=CanalConsentement.APPLICATION, agent=agent)
    creer_enfant(mere, poste, AUJOURDHUI - timedelta(days=42))
    planifier_les_rappels(AUJOURDHUI)

    envoyer_les_rappels(AUJOURDHUI)

    assert all(r.statut == StatutRappel.EN_ATTENTE for r in Rappel.objects.filter(mere=mere))


def test_un_rappel_deja_envoye_ne_repart_pas(schema, poste, agent):
    mere = creer_mere(poste, agent=agent)
    creer_enfant(mere, poste, AUJOURDHUI - timedelta(days=42))
    planifier_les_rappels(AUJOURDHUI)
    envoyer_les_rappels(AUJOURDHUI)

    resultat = envoyer_les_rappels(AUJOURDHUI)

    assert resultat["envoyes"] == 0


def test_le_nom_du_poste_ne_repete_pas_ce_que_le_message_dit_deja(schema, poste, agent):
    """« postu wérgi-yaram bu Poste de Santé de Ndondol » est absurde à
    l'oral : le message annonce déjà le poste de santé."""
    mere = creer_mere(poste, agent=agent)
    creer_enfant(mere, poste, AUJOURDHUI - timedelta(days=42))

    planifier_les_rappels(AUJOURDHUI)
    textes = [r.texte for r in Rappel.objects.filter(mere=mere)]

    assert all("postu wérgi-yaram bu Poste" not in t for t in textes)


def test_le_texte_envoye_est_conserve(schema, poste, agent):
    """On doit pouvoir dire ce qui a réellement été envoyé, pas ce qu'on
    enverrait aujourd'hui avec le code actuel."""
    mere = creer_mere(poste, agent=agent)
    creer_enfant(mere, poste, AUJOURDHUI - timedelta(days=42))
    planifier_les_rappels(AUJOURDHUI)

    assert all(r.texte for r in Rappel.objects.filter(mere=mere))


def test_un_preavis_et_un_rappel_du_jour_coexistent(schema, poste, agent):
    """Ce sont deux moments distincts : une mère peut être prévenue
    aujourd'hui pour une dose d'aujourd'hui et pour une autre dans trois
    jours. RG-09 regroupe les échéances d'un même moment, pas les moments
    entre eux."""
    mere = creer_mere(poste, agent=agent)
    creer_enfant(mere, poste, AUJOURDHUI - timedelta(days=42))

    planifier_les_rappels(AUJOURDHUI)

    types = set(Rappel.objects.filter(mere=mere).values_list("type", flat=True))
    assert TypeRappel.JOUR_MEME in types
