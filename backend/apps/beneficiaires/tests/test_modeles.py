"""Tests des bénéficiaires, du consentement et des règles de saisie."""

from datetime import date, timedelta

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.beneficiaires.models import (
    CanalRappel,
    Consentement,
    Enfant,
    Grossesse,
    Mere,
    Sexe,
)

pytestmark = pytest.mark.django_db


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
def enfant(mere, poste):
    return Enfant.objects.create(
        mere=mere,
        prenom="Moussa",
        nom="Ndiaye",
        date_naissance=date(2026, 1, 15),
        sexe=Sexe.MASCULIN,
        poste=poste,
    )


# --- Identité ---------------------------------------------------------------


def test_nom_complet_de_la_mere(mere):
    assert mere.nom_complet == "Awa Ndiaye"


def test_enfant_sans_nom_reste_identifiable(mere, poste):
    """Au Sénégal, le nom est souvent donné au baptême, après le BCG."""
    nouveau_ne = Enfant.objects.create(
        mere=mere,
        prenom="",
        date_naissance=timezone.localdate(),
        sexe=Sexe.FEMININ,
        poste=poste,
    )
    assert "Awa Ndiaye" in nouveau_ne.nom_complet


def test_age_en_jours(enfant):
    assert enfant.age_en_jours(a_la_date=date(2026, 3, 1)) == 45


# --- Prématurité (RG-07) ----------------------------------------------------


def test_enfant_ne_a_terme_n_est_pas_premature(enfant):
    enfant.semaines_gestation = 39
    assert not enfant.est_premature


def test_enfant_ne_avant_37_semaines_est_premature(enfant):
    enfant.semaines_gestation = 34
    assert enfant.est_premature


def test_gestation_inconnue_ne_vaut_pas_prematurite(enfant):
    assert enfant.semaines_gestation is None
    assert not enfant.est_premature


# --- Consentement (ENF-21, EF-47) -------------------------------------------


def test_sans_consentement_aucun_rappel(mere):
    assert mere.consentement_actif is None
    assert not mere.accepte_les_rappels


def test_consentement_whatsapp_autorise_les_rappels(mere, agent):
    Consentement.objects.create(mere=mere, canal=CanalRappel.WHATSAPP, recueilli_par=agent)
    assert mere.accepte_les_rappels


def test_consentement_application_seule_n_autorise_pas_les_envois(mere, agent):
    """La mère consulte dans l'application mais refuse d'être contactée."""
    Consentement.objects.create(mere=mere, canal=CanalRappel.APPLICATION, recueilli_par=agent)
    assert mere.consentement_actif is not None
    assert not mere.accepte_les_rappels


def test_revocation_coupe_les_rappels(mere, agent):
    consentement = Consentement.objects.create(
        mere=mere, canal=CanalRappel.WHATSAPP, recueilli_par=agent
    )
    consentement.revoquer()

    mere.refresh_from_db()
    assert not mere.accepte_les_rappels
    assert mere.consentement_actif is None


def test_revoquer_deux_fois_conserve_la_premiere_date(mere, agent):
    consentement = Consentement.objects.create(
        mere=mere, canal=CanalRappel.WHATSAPP, recueilli_par=agent
    )
    consentement.revoquer()
    premiere_date = consentement.revoque_le
    consentement.revoquer()

    assert consentement.revoque_le == premiere_date


def test_un_nouveau_consentement_reactive_les_rappels(mere, agent):
    ancien = Consentement.objects.create(
        mere=mere,
        canal=CanalRappel.WHATSAPP,
        accorde_le=timezone.now() - timedelta(days=30),
        recueilli_par=agent,
    )
    ancien.revoquer()
    Consentement.objects.create(mere=mere, canal=CanalRappel.SMS, recueilli_par=agent)

    assert mere.accepte_les_rappels
    assert mere.consentement_actif.canal == CanalRappel.SMS


def test_l_historique_des_consentements_est_conserve(mere, agent):
    """ENF-21 : on n'écrase jamais, on empile."""
    premier = Consentement.objects.create(
        mere=mere,
        canal=CanalRappel.WHATSAPP,
        accorde_le=timezone.now() - timedelta(days=30),
        recueilli_par=agent,
    )
    premier.revoquer()
    Consentement.objects.create(mere=mere, canal=CanalRappel.SMS, recueilli_par=agent)

    assert mere.consentements.count() == 2


# --- Validation -------------------------------------------------------------


def test_naissance_future_est_refusee(mere, poste):
    futur = Enfant(
        mere=mere,
        prenom="Fatou",
        date_naissance=timezone.localdate() + timedelta(days=1),
        sexe=Sexe.FEMININ,
        poste=poste,
    )
    with pytest.raises(ValidationError):
        futur.full_clean()


def test_terme_avant_le_premier_contact_est_refuse(mere):
    grossesse = Grossesse(
        mere=mere,
        rang=1,
        date_reference=date(2026, 6, 1),
        terme_estime=date(2026, 5, 1),
    )
    with pytest.raises(ValidationError):
        grossesse.full_clean()


def test_grossesse_coherente_est_acceptee(mere):
    grossesse = Grossesse(
        mere=mere,
        rang=1,
        date_reference=date(2026, 1, 10),
        terme_estime=date(2026, 8, 15),
    )
    grossesse.full_clean()  # ne lève pas


# --- Suppression logique ----------------------------------------------------


def test_la_suppression_d_une_mere_est_logique(mere):
    mere.supprimer()
    assert Mere.objects.count() == 0
    assert Mere.tous.count() == 1
