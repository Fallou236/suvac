"""Télécharge le modèle de synthèse dans le volume, une fois pour toutes.

Séparé du serveur : le téléchargement demande un jeton Hugging Face et
l'acceptation des conditions du modèle, ce qui n'a pas sa place dans une
image distribuée.
"""

import os
import sys
from pathlib import Path

CIBLE = Path(os.getenv("TTS_CHECKPOINTS", "/modele"))
DEPOT = "AIHubSN/Kiriku-Wolof-TTS"


def main() -> int:
    if (CIBLE / "model.pth").exists():
        print(f"Modèle déjà présent dans {CIBLE}.")
        return 0

    jeton = os.getenv("HF_TOKEN", "")
    if not jeton:
        print(
            "HF_TOKEN manquant.\n\n"
            "Le modèle demande un compte Hugging Face et l'acceptation de ses\n"
            f"conditions sur https://huggingface.co/{DEPOT}\n\n"
            "Créez un jeton en lecture, puis relancez avec :\n"
            "  HF_TOKEN=hf_xxx docker compose run --rm synthese-modele",
            file=sys.stderr,
        )
        return 1

    from huggingface_hub import snapshot_download

    print(f"Téléchargement de {DEPOT} — 952 Mo…")
    snapshot_download(repo_id=DEPOT, local_dir=str(CIBLE), token=jeton)
    print(f"Modèle installé dans {CIBLE}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())