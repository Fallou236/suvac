"""Appel au service de synthèse vocale.

Le service tourne à part, en Python 3.11 : le modèle exige des versions de
PyTorch et de transformers incompatibles avec l'environnement de SUVAC.
Voir services/synthese/README.md.

L'indisponibilité du service n'est pas une erreur : l'appelant retombe sur
l'assemblage de segments pré-enregistrés.
"""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path

import requests
from django.conf import settings

journal = logging.getLogger("suvac.rappels")

RACINE = Path(settings.MEDIA_ROOT) / "synthese"

# Vingt secondes pour le message le plus long, mesuré sur un portable sans
# carte graphique. La marge couvre un serveur plus lent.
DELAI = 60


class SyntheseIndisponible(Exception):
    """Le service ne répond pas ou refuse la demande."""


def disponible() -> bool:
    adresse = getattr(settings, "SYNTHESE_URL", "")
    if not adresse:
        return False

    try:
        reponse = requests.get(f"{adresse}/sante", timeout=3)
        return reponse.status_code == 200
    except requests.RequestException:
        return False


def synthetiser(texte: str) -> Path:
    """Produit le fichier audio d'un texte, ou le rend s'il existe déjà.

    Le nom du fichier dérive de l'empreinte du texte : deux mères recevant
    le même message partagent le fichier. C'est ce qui rend la synthèse
    praticable — une vingtaine de messages distincts par balayage, pas un
    par bénéficiaire.
    """
    RACINE.mkdir(parents=True, exist_ok=True)
    chemin = RACINE / f"{_empreinte(texte)}.wav"

    if chemin.exists():
        return chemin

    adresse = getattr(settings, "SYNTHESE_URL", "")
    if not adresse:
        raise SyntheseIndisponible("SYNTHESE_URL n'est pas configurée.")

    entetes = {"Content-Type": "application/json"}
    if jeton := getattr(settings, "SYNTHESE_JETON", ""):
        entetes["X-Jeton"] = jeton

    try:
        reponse = requests.post(
            f"{adresse}/synthetiser",
            json={"texte": texte},
            headers=entetes,
            timeout=DELAI,
        )
    except requests.RequestException as erreur:
        raise SyntheseIndisponible(f"Service injoignable : {erreur}") from erreur

    if reponse.status_code != 200:
        raise SyntheseIndisponible(
            f"Service en erreur ({reponse.status_code}) : {reponse.text[:200]}"
        )

    chemin.write_bytes(reponse.content)
    journal.info("Synthétisé : %s (%d Ko)", chemin.name, len(reponse.content) // 1024)
    return chemin


def _empreinte(texte: str) -> str:
    return hashlib.sha256(texte.encode()).hexdigest()[:16]
