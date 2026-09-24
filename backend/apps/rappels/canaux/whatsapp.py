"""Canal WhatsApp par la Cloud API de Meta.

Deux contraintes structurent ce canal.

Hors de la fenêtre de vingt-quatre heures suivant un message du
destinataire, seuls des modèles pré-approuvés peuvent être envoyés : on ne
peut pas écrire librement à une mère qui n'a pas répondu récemment.

Un modèle n'accepte ni audio ni document en en-tête. Le message vocal est
donc encapsulé en vidéo, ce qui suppose de téléverser le fichier avant
l'envoi et d'en récupérer un identifiant.
"""

from __future__ import annotations

import logging
from pathlib import Path

import requests
from django.conf import settings

from .base import Canal, MessageSortant, ResultatEnvoi

journal = logging.getLogger("suvac.rappels")

DELAI = 30

# Codes pour lesquels réessayer ne sert à rien : le problème vient du
# destinataire ou de la configuration, pas du réseau.
ERREURS_DEFINITIVES = {
    131026,  # destinataire injoignable sur WhatsApp
    131047,  # hors fenêtre de vingt-quatre heures, message libre refusé
    132000,  # nombre de variables incompatible avec le modèle
    132001,  # modèle introuvable
    132005,  # modèle non approuvé
    132007,  # modèle en pause
    133010,  # numéro non enregistré
}


class CanalWhatsApp(Canal):
    nom = "whatsapp"

    def __init__(self) -> None:
        self.numero_id = getattr(settings, "WHATSAPP_NUMERO_ID", "")
        self.jeton = getattr(settings, "WHATSAPP_JETON", "")
        self.version = getattr(settings, "WHATSAPP_VERSION_API", "v25.0")
        self.modele = getattr(settings, "WHATSAPP_MODELE_RAPPEL", "rappel_vaccinal")
        self.langue_modele = getattr(settings, "WHATSAPP_LANGUE_MODELE", "fr")

    def disponible(self) -> bool:
        return bool(self.numero_id and self.jeton)

    @property
    def _racine(self) -> str:
        return f"https://graph.facebook.com/{self.version}"

    @property
    def _entetes(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.jeton}"}

    def envoyer(self, message: MessageSortant) -> ResultatEnvoi:
        if not self.disponible():
            return ResultatEnvoi.echec(
                "WhatsApp non configuré : identifiant ou jeton manquant.",
                definitif=True,
            )

        destinataire = _normaliser(message.destinataire)
        if not destinataire:
            return ResultatEnvoi.echec("Numéro invalide.", definitif=True)

        if message.chemin_audio:
            return self._envoyer_avec_video(destinataire, message)
        return self._envoyer_texte(destinataire, message)

    # ---------------------------------------------------------------- #

    def _envoyer_avec_video(self, destinataire: str, message: MessageSortant) -> ResultatEnvoi:
        """Téléverse la vidéo puis l'envoie en en-tête de modèle.

        Le téléversement est une étape distincte : Meta rend un identifiant
        valable trente jours, qu'on pourrait réutiliser pour plusieurs
        destinataires recevant le même message. Ce n'est pas fait ici — les
        messages sont personnalisés — mais la piste est notée.
        """
        chemin = Path(message.chemin_audio)
        if not chemin.exists():
            return ResultatEnvoi.echec(f"Vidéo introuvable : {chemin}", definitif=True)

        identifiant = self._televerser(chemin)
        if identifiant is None:
            return ResultatEnvoi.echec("Téléversement de la vidéo échoué.")

        corps = {
            "messaging_product": "whatsapp",
            "to": destinataire,
            "type": "template",
            "template": {
                "name": self.modele,
                "language": {"code": self.langue_modele},
                "components": [
                    {
                        "type": "header",
                        "parameters": [{"type": "video", "video": {"id": identifiant}}],
                    },
                    {
                        "type": "body",
                        "parameters": [
                            {"type": "text", "text": _tronquer(v)}
                            for v in (message.variables or ("votre enfant",))
                        ],
                    },
                ],
            },
        }
        return self._poster(corps)

    def _envoyer_texte(self, destinataire: str, message: MessageSortant) -> ResultatEnvoi:
        """Message texte libre.

        Ne fonctionne que dans la fenêtre de vingt-quatre heures. Hors de
        cette fenêtre, Meta renvoie l'erreur 131047 et le message est perdu.
        """
        corps = {
            "messaging_product": "whatsapp",
            "to": destinataire,
            "type": "text",
            "text": {"body": message.texte[:4096], "preview_url": False},
        }
        return self._poster(corps)

    def _televerser(self, chemin: Path) -> str | None:
        try:
            with chemin.open("rb") as fichier:
                reponse = requests.post(
                    f"{self._racine}/{self.numero_id}/media",
                    headers=self._entetes,
                    data={"messaging_product": "whatsapp", "type": "video/mp4"},
                    files={"file": (chemin.name, fichier, "video/mp4")},
                    timeout=DELAI,
                )
        except requests.RequestException as erreur:
            journal.warning("Téléversement impossible : %s", erreur)
            return None

        if reponse.status_code != 200:
            journal.warning(
                "Téléversement refusé (%d) : %s",
                reponse.status_code,
                reponse.text[:300],
            )
            return None

        return reponse.json().get("id")

    def _poster(self, corps: dict) -> ResultatEnvoi:
        try:
            reponse = requests.post(
                f"{self._racine}/{self.numero_id}/messages",
                headers={**self._entetes, "Content-Type": "application/json"},
                json=corps,
                timeout=DELAI,
            )
        except requests.Timeout:
            return ResultatEnvoi.echec("Délai dépassé.")
        except requests.RequestException as erreur:
            return ResultatEnvoi.echec(f"Réseau : {erreur}")

        if reponse.status_code == 200:
            messages = reponse.json().get("messages", [])
            return ResultatEnvoi.succes(messages[0]["id"] if messages else "")

        return self._interpreter_erreur(reponse)

    def _interpreter_erreur(self, reponse) -> ResultatEnvoi:
        """Distingue ce qui peut réussir plus tard de ce qui est perdu."""
        try:
            erreur = reponse.json().get("error", {})
        except ValueError:
            erreur = {}

        code = erreur.get("code")
        message = erreur.get("message", reponse.text[:300])
        detail = erreur.get("error_data", {}).get("details", "")

        definitif = code in ERREURS_DEFINITIVES or reponse.status_code == 400

        journal.warning(
            "Envoi WhatsApp refusé (%s, code %s) : %s %s",
            reponse.status_code,
            code,
            message,
            detail,
        )

        return ResultatEnvoi.echec(f"[{code}] {message} {detail}".strip(), definitif=definitif)


def _normaliser(numero: str) -> str:
    """Met le numéro au format attendu : chiffres seuls, indicatif compris.

    Meta refuse le « + » et les espaces. Un numéro sénégalais saisi sans
    indicatif est complété par 221.
    """
    chiffres = "".join(c for c in numero if c.isdigit())

    if not chiffres:
        return ""
    if chiffres.startswith("221"):
        return chiffres
    if len(chiffres) == 9 and chiffres.startswith("7"):
        return f"221{chiffres}"
    return chiffres


def _tronquer(valeur: str, maximum: int = 60) -> str:
    """Une variable de modèle ne peut ni être vide ni contenir de saut de ligne."""
    propre = " ".join(str(valeur).split())
    return propre[:maximum] or "—"
