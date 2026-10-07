"""Service de synthèse vocale wolof.

Isolé du backend pour une raison précise : le modèle exige Python 3.11,
PyTorch et une version ancienne de transformers, incompatibles avec
l'environnement de SUVAC qui tourne en 3.13. Les faire cohabiter
demanderait de rétrograder tout le projet.

Le service expose une seule route. Il charge le modèle au démarrage —
plusieurs secondes — et le garde en mémoire.

Modèle : Kiriku-Wolof-TTS, architecture VITS, entraîné par AI Hub Sénégal.
"""

from __future__ import annotations

import hashlib
import logging
import os
import time
from pathlib import Path

from flask import Flask, jsonify, request, send_file

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
journal = logging.getLogger("synthese")

RACINE = Path(__file__).parent
CHECKPOINTS = Path(os.getenv("TTS_CHECKPOINTS", RACINE / "checkpoints"))
SORTIE = Path(os.getenv("TTS_SORTIE", RACINE / "audio"))
JETON = os.getenv("TTS_JETON", "")

application = Flask(__name__)
synthetiseur = None


def charger():
    """Charge le modèle une fois pour toutes.

    Le chargement prend plusieurs secondes ; le refaire à chaque requête
    rendrait le service inutilisable.
    """
    global synthetiseur
    if synthetiseur is not None:
        return synthetiseur

    from TTS.utils.synthesizer import Synthesizer

    debut = time.time()
    synthetiseur = Synthesizer(
        tts_checkpoint=str(CHECKPOINTS / "model.pth"),
        tts_config_path=str(CHECKPOINTS / "config.json"),
    )
    journal.info("Modèle chargé en %.1f s", time.time() - debut)
    return synthetiseur


def empreinte(texte: str) -> str:
    return hashlib.sha256(texte.encode()).hexdigest()[:16]


def autorise(requete) -> bool:
    """Le service n'est pas exposé publiquement, mais un jeton partagé
    évite qu'un autre processus de la machine l'appelle par mégarde."""
    if not JETON:
        return True
    return requete.headers.get("X-Jeton") == JETON


@application.get("/sante")
def sante():
    return jsonify({"etat": "pret" if synthetiseur else "en attente"})


@application.post("/synthetiser")
def synthetiser():
    """Produit un fichier audio à partir d'un texte wolof.

    Rend le fichier existant si le même texte a déjà été synthétisé : les
    messages se répètent beaucoup d'une mère à l'autre, et la génération
    coûte plusieurs secondes.
    """
    if not autorise(request):
        return jsonify({"erreur": "Jeton invalide."}), 403

    donnees = request.get_json(silent=True) or {}
    texte = (donnees.get("texte") or "").strip()

    if not texte:
        return jsonify({"erreur": "Texte manquant."}), 400
    if len(texte) > 1000:
        return jsonify({"erreur": "Texte trop long."}), 400

    SORTIE.mkdir(parents=True, exist_ok=True)
    chemin = SORTIE / f"{empreinte(texte)}.wav"

    if chemin.exists():
        journal.info("Déjà synthétisé : %s", chemin.name)
        return send_file(chemin, mimetype="audio/wav")

    try:
        debut = time.time()
        moteur = charger()
        wav = moteur.tts(text=texte)
        moteur.save_wav(wav, str(chemin))
        journal.info(
            "Synthétisé en %.1f s (%d caractères) : %s",
            time.time() - debut,
            len(texte),
            chemin.name,
        )
    except Exception as erreur:  # noqa: BLE001
        journal.exception("Synthèse échouée")
        return jsonify({"erreur": str(erreur)}), 500

    return send_file(chemin, mimetype="audio/wav")


if __name__ == "__main__":
    charger()
    application.run(host="127.0.0.1", port=8800)
