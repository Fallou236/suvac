"""Canaux d'envoi des rappels.

Chaque canal sait faire une seule chose : envoyer un message et dire si
c'est parti. Le reste du système ne connaît que cette interface, ce qui
permet de tester toute la chaîne sans dépendre de WhatsApp — et de changer
d'opérateur sans toucher au métier.
"""

import logging

from .base import Canal, MessageSortant, ResultatEnvoi
from .simulation import CanalSimulation

journal = logging.getLogger("suvac.rappels")

__all__ = [
    "Canal",
    "MessageSortant",
    "ResultatEnvoi",
    "CanalSimulation",
    "canal_pour",
]


def canal_pour(nom: str) -> Canal:
    """Fabrique le canal demandé, ou la simulation s'il n'est pas utilisable.

    Import tardif : les canaux réels dépendent de bibliothèques externes
    qu'on ne charge pas pour rien en test. Le repli sur la simulation
    couvre deux cas — le module absent, et le canal présent mais non
    configuré.
    """
    try:
        if nom == "whatsapp":
            from .whatsapp import CanalWhatsApp

            canal = CanalWhatsApp()
            if canal.disponible():
                return canal
            journal.warning("WhatsApp non configuré, repli sur la simulation.")

        elif nom == "sms":
            from .sms import CanalSms

            canal = CanalSms()
            if canal.disponible():
                return canal
            journal.warning("SMS non configuré, repli sur la simulation.")

    except ImportError:
        journal.warning("Canal %s indisponible, repli sur la simulation.", nom)

    return CanalSimulation()
