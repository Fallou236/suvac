"""Canal de simulation : écrit dans les journaux au lieu d'envoyer.

Permet de dérouler toute la chaîne — balayage, composition, traçabilité —
sans compte WhatsApp ni frais d'envoi. C'est aussi le canal utilisé par la
suite de tests.
"""

import logging
import uuid

from .base import Canal, MessageSortant, ResultatEnvoi

journal = logging.getLogger("suvac.rappels")


class CanalSimulation(Canal):
    nom = "simulation"

    def envoyer(self, message: MessageSortant) -> ResultatEnvoi:
        journal.info(
            "Rappel simulé vers %s (%s) : %s%s",
            message.destinataire,
            message.langue,
            message.texte,
            f" [audio : {message.chemin_audio}]" if message.chemin_audio else "",
        )
        return ResultatEnvoi.succes(f"simulation-{uuid.uuid4().hex[:12]}")
