"""Tâches périodiques des rappels."""

import logging

from celery import shared_task

from .services import envoyer_les_rappels, planifier_les_rappels

journal = logging.getLogger("suvac.rappels")


@shared_task(name="apps.rappels.taches.balayer_les_echeances")
def balayer_les_echeances() -> str:
    """Balayage quotidien (EF-40) : planifie puis envoie.

    Les deux étapes sont séparées dans le service, mais enchaînées ici :
    en exploitation, il n'y a aucune raison de planifier sans envoyer.
    """
    bilan = planifier_les_rappels()
    envois = envoyer_les_rappels()

    resume = f"{bilan} — {envois['envoyes']} envoyés, {envois['echecs']} en échec"
    journal.info("Balayage terminé : %s", resume)
    return resume


@shared_task(name="apps.rappels.taches.reessayer_les_echecs")
def reessayer_les_echecs() -> str:
    """Nouvelle tentative pour les rappels en échec temporaire."""
    envois = envoyer_les_rappels()
    return f"{envois['envoyes']} envoyés, {envois['echecs']} encore en échec"
