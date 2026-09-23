"""Contrat commun à tous les canaux."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ResultatEnvoi:
    """Ce qu'un canal rapporte après une tentative.

    `definitif` distingue l'échec qu'il est inutile de réessayer — numéro
    invalide, destinataire non autorisé — de celui qui peut réussir plus
    tard : réseau coupé, service indisponible.
    """

    reussi: bool
    identifiant_externe: str = ""
    erreur: str = ""
    definitif: bool = False

    @classmethod
    def succes(cls, identifiant: str = "") -> ResultatEnvoi:
        return cls(reussi=True, identifiant_externe=identifiant)

    @classmethod
    def echec(cls, message: str, definitif: bool = False) -> ResultatEnvoi:
        return cls(reussi=False, erreur=message, definitif=definitif)


@dataclass(frozen=True, slots=True)
class MessageSortant:
    """Ce qu'un canal reçoit à envoyer.

    Le texte est toujours présent ; l'audio ne l'est que si le canal sait
    le transporter. Un canal SMS ignorera simplement le fichier.
    """

    destinataire: str
    texte: str
    langue: str = "wo"
    chemin_audio: str | None = None
    modele: str = ""
    variables: tuple[str, ...] = ()


class Canal(ABC):
    """Interface d'un canal d'envoi."""

    nom: str

    @abstractmethod
    def envoyer(self, message: MessageSortant) -> ResultatEnvoi:
        """Tente l'envoi et rapporte ce qui s'est passé.

        Ne lève jamais : un canal indisponible est un cas courant, pas une
        erreur de programmation. L'appelant décide quoi faire du résultat.
        """

    def disponible(self) -> bool:
        """Le canal est-il configuré et utilisable ?"""
        return True
