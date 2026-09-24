"""Encapsulation de l'audio en vidéo pour WhatsApp.

Meta n'accepte pas l'audio en en-tête d'un modèle de message : hors de la
fenêtre de vingt-quatre heures suivant un message du destinataire, seules
les images, vidéos et documents passent. Une vidéo d'une image fixe avec
l'audio par-dessus contourne la limite sans dégrader l'expérience — la
mère appuie sur lecture et entend le message.

Le coût est le poids : une vidéo pèse plus qu'un fichier audio seul. Le
paramétrage ci-dessous vise le minimum acceptable pour un réseau 2G.
"""

from __future__ import annotations

import logging
import subprocess
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings

from .audio import ffmpeg_disponible

journal = logging.getLogger("suvac.rappels")

RACINE_VIDEOS = Path(settings.MEDIA_ROOT) / "videos"
VIGNETTE = Path(settings.BASE_DIR) / "apps" / "rappels" / "ressources" / "vignette.png"

# 360 pixels de large suffisent : la vidéo n'a rien à montrer, elle
# transporte du son. Descendre plus bas ferait douter de la qualité.
LARGEUR = 360
HAUTEUR = 360


@dataclass(frozen=True, slots=True)
class Encapsulation:
    chemin: Path
    poids_octets: int

    @property
    def poids_ko(self) -> int:
        return round(self.poids_octets / 1024)


def encapsuler(chemin_audio: Path, vignette: Path | None = None) -> Encapsulation:
    """Produit une vidéo à partir d'un fichier audio et d'une image fixe.

    Le nom de la vidéo dérive de celui de l'audio : le cache de l'assemblage
    se prolonge donc naturellement ici.
    """
    if not ffmpeg_disponible():
        raise RuntimeError("ffmpeg est absent : impossible d'encapsuler l'audio.")

    image = vignette or VIGNETTE
    if not image.exists():
        raise FileNotFoundError(f"Vignette introuvable : {image}")

    RACINE_VIDEOS.mkdir(parents=True, exist_ok=True)
    sortie = RACINE_VIDEOS / f"{chemin_audio.stem}.mp4"

    if sortie.exists():
        return Encapsulation(sortie, sortie.stat().st_size)

    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                # L'image est bouclée pour durer autant que l'audio.
                "-loop",
                "1",
                "-i",
                str(image),
                "-i",
                str(chemin_audio),
                "-c:v",
                "libx264",
                "-tune",
                "stillimage",
                "-preset",
                "veryfast",
                # Une image par seconde : rien ne bouge, inutile d'encoder
                # vingt-cinq fois la même chose.
                "-r",
                "1",
                "-vf",
                f"scale={LARGEUR}:{HAUTEUR}",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "64k",
                # La vidéo s'arrête avec l'audio.
                "-shortest",
                # Les métadonnées en tête : la lecture commence sans
                # attendre le téléchargement complet.
                "-movflags",
                "+faststart",
                str(sortie),
            ],
            check=True,
            capture_output=True,
            timeout=120,
        )
    except subprocess.CalledProcessError as erreur:
        journal.error("Encapsulation échouée : %s", erreur.stderr.decode()[:500])
        raise

    poids = sortie.stat().st_size
    if poids > 16 * 1024 * 1024:
        journal.warning(
            "Vidéo de %d Ko : au-delà de la limite WhatsApp de 16 Mo.",
            poids // 1024,
        )

    return Encapsulation(sortie, poids)
