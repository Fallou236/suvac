"""Tests du webhook des accusés de réception.

Ce point d'accès est public : n'importe qui peut l'appeler. Deux
vérifications comptent — qu'on ne répond au défi d'abonnement qu'avec le
bon jeton, et qu'une notification non signée est rejetée.
"""

import hashlib
import hmac
import json
from datetime import date

import pytest
from django.urls import reverse

from apps.beneficiaires.models import Mere
from apps.rappels.models import CanalRappel, Rappel, StatutRappel, TypeRappel

pytestmark = pytest.mark.django_db


@pytest.fixture
def rappel(poste):
    mere = Mere.objects.create(prenom="Awa", nom="Ndiaye", poste=poste, telephone="+221771000001")
    return Rappel.objects.create(
        mere=mere,
        type=TypeRappel.JOUR_MEME,
        canal=CanalRappel.WHATSAPP,
        texte="Rappel",
        planifie_pour=date(2026, 6, 15),
        statut=StatutRappel.ENVOYE,
        identifiant_externe="wamid.ABC",
    )


def notifier(client, statut: str, identifiant: str = "wamid.ABC", erreurs=None):
    charge = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "statuses": [
                                {
                                    "id": identifiant,
                                    "status": statut,
                                    **({"errors": erreurs} if erreurs else {}),
                                }
                            ]
                        }
                    }
                ]
            }
        ]
    }
    return client.post(
        reverse("webhook-whatsapp"),
        data=json.dumps(charge),
        content_type="application/json",
    )


# --- Abonnement --------------------------------------------------------------


def test_le_defi_est_rendu_avec_le_bon_jeton(client, settings):
    settings.WHATSAPP_JETON_WEBHOOK = "secret-suvac"

    reponse = client.get(
        reverse("webhook-whatsapp"),
        {
            "hub.mode": "subscribe",
            "hub.verify_token": "secret-suvac",
            "hub.challenge": "12345",
        },
    )

    assert reponse.status_code == 200
    assert reponse.content.decode() == "12345"


def test_un_mauvais_jeton_ne_permet_pas_l_abonnement(client, settings):
    """Sans cette vérification, n'importe qui pourrait détourner nos
    notifications vers son propre serveur."""
    settings.WHATSAPP_JETON_WEBHOOK = "secret-suvac"

    reponse = client.get(
        reverse("webhook-whatsapp"),
        {
            "hub.mode": "subscribe",
            "hub.verify_token": "mauvais",
            "hub.challenge": "12345",
        },
    )

    assert reponse.status_code == 403


# --- Signature ---------------------------------------------------------------


def test_une_notification_non_signee_est_rejetee(client, settings, rappel):
    """Sans signature, n'importe qui pourrait marquer nos rappels comme lus."""
    settings.META_SECRET_APPLICATION = "secret-application"

    reponse = notifier(client, "read")

    assert reponse.status_code == 403
    rappel.refresh_from_db()
    assert rappel.statut == StatutRappel.ENVOYE


def test_une_notification_signee_est_acceptee(client, settings, rappel):
    settings.META_SECRET_APPLICATION = "secret-application"

    charge = json.dumps(
        {
            "entry": [
                {"changes": [{"value": {"statuses": [{"id": "wamid.ABC", "status": "delivered"}]}}]}
            ]
        }
    )
    signature = hmac.new(b"secret-application", charge.encode(), hashlib.sha256).hexdigest()

    reponse = client.post(
        reverse("webhook-whatsapp"),
        data=charge,
        content_type="application/json",
        HTTP_X_HUB_SIGNATURE_256=f"sha256={signature}",
    )

    assert reponse.status_code == 200
    rappel.refresh_from_db()
    assert rappel.statut == StatutRappel.REMIS


# --- Progression des statuts -------------------------------------------------


def test_un_accuse_de_remise_avance_le_statut(client, rappel):
    notifier(client, "delivered")

    rappel.refresh_from_db()
    assert rappel.statut == StatutRappel.REMIS
    assert rappel.remis_le is not None


def test_un_accuse_de_lecture_avance_le_statut(client, rappel):
    notifier(client, "read")

    rappel.refresh_from_db()
    assert rappel.statut == StatutRappel.LU


def test_le_statut_ne_recule_jamais(client, rappel):
    """Les accusés arrivent parfois dans le désordre : « remis » peut
    suivre « lu »."""
    notifier(client, "read")
    notifier(client, "delivered")

    rappel.refresh_from_db()
    assert rappel.statut == StatutRappel.LU


def test_un_echec_rapporte_par_whatsapp_est_definitif(client, rappel):
    notifier(
        client,
        "failed",
        erreurs=[{"title": "Numéro non enregistré sur WhatsApp"}],
    )

    rappel.refresh_from_db()
    assert rappel.statut == StatutRappel.ABANDONNE
    assert "Numéro non enregistré" in rappel.erreur


# --- Robustesse --------------------------------------------------------------


def test_un_identifiant_inconnu_ne_casse_rien(client, rappel):
    reponse = notifier(client, "read", identifiant="wamid.INCONNU")

    assert reponse.status_code == 200
    rappel.refresh_from_db()
    assert rappel.statut == StatutRappel.ENVOYE


def test_une_charge_illisible_recoit_quand_meme_200(client):
    """Meta réessaie pendant des jours quand il reçoit autre chose, et
    finit par désactiver l'abonnement."""
    reponse = client.post(
        reverse("webhook-whatsapp"),
        data="ceci n'est pas du JSON",
        content_type="application/json",
    )

    assert reponse.status_code == 200


def test_une_notification_sans_statut_ne_casse_rien(client):
    """Meta envoie aussi des messages entrants, qu'on ignore ici."""
    reponse = client.post(
        reverse("webhook-whatsapp"),
        data=json.dumps({"entry": [{"changes": [{"value": {"messages": []}}]}]}),
        content_type="application/json",
    )

    assert reponse.status_code == 200


@pytest.fixture(autouse=True)
def sans_signature(settings):
    """La vérification de signature a ses propres tests ; ailleurs, elle
    n'a pas à interférer."""
    settings.META_SECRET_APPLICATION = ""
