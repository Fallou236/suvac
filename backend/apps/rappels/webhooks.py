"""Réception des accusés de WhatsApp.

Meta ne dit pas si un message est arrivé au moment de l'envoi : il rappelle
plus tard, par une requête sur une adresse qu'on lui déclare. Sans ce
webhook, un rappel resterait « envoyé » à jamais, sans qu'on sache s'il a
été remis ni lu.

Ce point d'accès est public — Meta n'a pas de compte chez nous. Sa sécurité
repose sur deux choses : un jeton de vérification à l'abonnement, et la
signature de chaque requête.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging

from django.conf import settings
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Rappel, StatutRappel

journal = logging.getLogger("suvac.rappels")

CORRESPONDANCE_STATUTS = {
    "sent": StatutRappel.ENVOYE,
    "delivered": StatutRappel.REMIS,
    "read": StatutRappel.LU,
    "failed": StatutRappel.ECHEC,
}


@csrf_exempt
@require_http_methods(["GET", "POST"])
def webhook_whatsapp(requete: HttpRequest) -> HttpResponse:
    if requete.method == "GET":
        return _verifier_abonnement(requete)
    return _traiter_notification(requete)


def _verifier_abonnement(requete: HttpRequest) -> HttpResponse:
    """Meta appelle cette adresse une fois, pour vérifier qu'elle est à nous.

    Il envoie un défi et un jeton ; on lui rend le défi si le jeton est le
    bon. Sans cela, n'importe qui pourrait détourner nos notifications vers
    son propre serveur.
    """
    mode = requete.GET.get("hub.mode")
    jeton = requete.GET.get("hub.verify_token")
    defi = requete.GET.get("hub.challenge", "")

    attendu = getattr(settings, "WHATSAPP_JETON_WEBHOOK", "")

    if mode == "subscribe" and attendu and hmac.compare_digest(jeton or "", attendu):
        journal.info("Webhook WhatsApp vérifié.")
        return HttpResponse(defi, content_type="text/plain")

    journal.warning("Vérification du webhook refusée.")
    return HttpResponse("Vérification refusée.", status=403)


def _traiter_notification(requete: HttpRequest) -> HttpResponse:
    """Enregistre les accusés reçus.

    On répond toujours 200, même en cas de données inattendues : Meta
    réessaie pendant plusieurs jours quand il reçoit autre chose, et
    finit par désactiver l'abonnement. Une notification qu'on ne sait pas
    lire est journalisée, pas rejetée.
    """
    if not _signature_valide(requete):
        return HttpResponse("Signature invalide.", status=403)

    try:
        charge = json.loads(requete.body)
    except json.JSONDecodeError:
        journal.warning("Notification WhatsApp illisible.")
        return JsonResponse({"recu": True})

    traites = 0
    for entree in charge.get("entry", []):
        for changement in entree.get("changes", []):
            valeur = changement.get("value", {})
            for statut in valeur.get("statuses", []):
                if _appliquer_statut(statut):
                    traites += 1

    if traites:
        journal.info("Accusés WhatsApp traités : %d.", traites)

    return JsonResponse({"recu": True})


def _signature_valide(requete: HttpRequest) -> bool:
    """Vérifie que la requête vient bien de Meta.

    La signature est calculée avec le secret de l'application. Sans elle,
    n'importe qui pourrait marquer nos rappels comme lus.

    En développement, l'absence de secret laisse passer : le webhook n'est
    alors atteignable que depuis la machine locale.
    """
    secret = getattr(settings, "META_SECRET_APPLICATION", "")
    if not secret:
        return True

    entete = requete.headers.get("X-Hub-Signature-256", "")
    if not entete.startswith("sha256="):
        return False

    attendu = hmac.new(secret.encode(), requete.body, hashlib.sha256).hexdigest()

    return hmac.compare_digest(entete[7:], attendu)


def _appliquer_statut(statut: dict) -> bool:
    """Reporte un accusé sur le rappel correspondant.

    Les accusés arrivent parfois dans le désordre : « remis » peut suivre
    « lu ». On ne recule donc jamais dans la progression.
    """
    identifiant = statut.get("id")
    etat = statut.get("status")

    if not identifiant or etat not in CORRESPONDANCE_STATUTS:
        return False

    rappel = Rappel.objects.filter(identifiant_externe=identifiant).first()
    if rappel is None:
        return False

    nouveau = CORRESPONDANCE_STATUTS[etat]

    if nouveau == StatutRappel.ECHEC:
        erreurs = statut.get("errors", [{}])
        message = erreurs[0].get("title", "Échec rapporté par WhatsApp.")
        rappel.marquer_echec(message, definitif=True)
        return True

    progression = [
        StatutRappel.EN_ATTENTE,
        StatutRappel.ENVOYE,
        StatutRappel.REMIS,
        StatutRappel.LU,
    ]
    if (
        nouveau in progression
        and rappel.statut in progression
        and progression.index(nouveau) <= progression.index(rappel.statut)
    ):
        return False

    if nouveau == StatutRappel.REMIS:
        rappel.marquer_remis()
    elif nouveau == StatutRappel.LU:
        rappel.marquer_lu()
    else:
        rappel.marquer_envoye(identifiant)

    return True
