"""Assemblage des messages vocaux wolof.

Le choix des segments pré-enregistrés plutôt que de la synthèse vocale
tient à trois raisons : la qualité d'une voix humaine, l'absence de modèle
de synthèse wolof fiable, et le coût — assembler des fichiers ne demande
aucun service externe.

Le prix à payer est la rigidité : tout ce qui n'est pas enregistré ne peut
être dit. C'est pourquoi les prénoms sont remplacés par une périphrase.
"""

from __future__ import annotations

import hashlib
import logging
import shutil
import subprocess
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from django.conf import settings

from apps.suivi.models import Echeance

from .models import TypeRappel

journal = logging.getLogger("suvac.rappels")

RACINE_SEGMENTS = Path(settings.MEDIA_ROOT) / "audio"
RACINE_MESSAGES = Path(settings.MEDIA_ROOT) / "messages"

CODES_VACCINS = {
    "BCG": "vaccin_bcg",
    "VPO": "vaccin_vpo",
    "VPI": "vaccin_vpi",
    "PENTA": "vaccin_penta",
    "PNEUMO": "vaccin_pneumo",
    "ROTA": "vaccin_rota",
    "RR": "vaccin_rr",
    "VAA": "vaccin_vaa",
    "TD": "vaccin_td",
}


class SegmentManquant(Exception):
    """Un segment nécessaire au message n'a pas été enregistré."""


@dataclass(frozen=True, slots=True)
class Assemblage:
    chemin: Path
    duree_estimee: float
    segments: tuple[str, ...]


def ffmpeg_disponible() -> bool:
    return shutil.which("ffmpeg") is not None


def chemin_segment(nom: str, langue: str = "wo") -> Path:
    """Trouve le fichier d'un segment, quelle que soit son extension."""
    dossier = RACINE_SEGMENTS / langue
    for extension in (".m4a", ".mp3", ".ogg", ".wav"):
        chemin = dossier / f"{nom}{extension}"
        if chemin.exists():
            return chemin
    raise SegmentManquant(f"Segment « {nom} » absent de {dossier}.")


def segments_pour_date(jour: date) -> list[str]:
    return [f"nombre_{jour.day:02d}", f"mois_{jour.month:02d}"]


def segments_pour_poste(nom_poste: str) -> list[str]:
    """Le nom du poste, réduit à un identifiant de fichier.

    « Poste de Santé de Ndondol » devient `poste_ndondol`.
    """
    from .composition import nom_court_poste

    court = nom_court_poste(nom_poste)
    normalise = (
        court.lower()
        .replace(" ", "_")
        .replace("é", "e")
        .replace("è", "e")
        .replace("à", "a")
        .replace("ô", "o")
    )
    return [f"poste_{normalise}"]


def segments_du_message(
    echeances: list[Echeance],
    type_rappel: str,
    nom_poste: str,
    pour_elle_meme: bool,
) -> list[str]:
    """Décompose un message en suite de segments à concaténer.

    L'ordre suit celui des phrases validées : salutation, destinataire,
    liaison, vaccins, date, lieu.
    """
    codes: list[str] = []
    for echeance in echeances:
        segment = CODES_VACCINS.get(echeance.vaccin.code)
        if segment and segment not in codes:
            codes.append(segment)

    dates = sorted(e.date_cible for e in echeances)
    reference = dates[0] if type_rappel == TypeRappel.RELANCE else dates[-1]

    suite = ["amorce_salutation"]

    if pour_elle_meme:
        if type_rappel == TypeRappel.RELANCE:
            suite += ["mere_na_pas_recu"] + segments_pour_date(reference)
            suite += ["liaison_venez_vite"]
            return suite
        suite += ["mere_doit_recevoir"] + segments_pour_date(reference)
        suite += ["liaison_venez_au_poste"] + segments_pour_poste(nom_poste)
        return suite

    # Le prénom n'est pas enregistrable : on dit « votre enfant ».
    suite.append("beneficiaire_votre_enfant")

    if type_rappel == TypeRappel.RELANCE:
        suite.append("liaison_na_pas_recu")
        suite += _vaccins_enonces(codes)
        suite.append("liaison_prevu_le")
        suite += segments_pour_date(reference)
        suite.append("liaison_venez_vite")
        return suite

    suite.append("liaison_doit_recevoir")
    suite += _vaccins_enonces(codes)

    if type_rappel == TypeRappel.JOUR_MEME:
        suite.append("liaison_aujourdhui")
    else:
        suite.append("liaison_le")
        suite += segments_pour_date(reference)

    suite.append("liaison_venez_au_poste")
    suite += segments_pour_poste(nom_poste)
    return suite


def _vaccins_enonces(codes: list[str]) -> list[str]:
    """Au-delà de trois vaccins, on résume — comme à l'écrit.

    Un message vocal qui énumère dix vaccins dure une minute et personne ne
    l'écoute jusqu'au bout.
    """
    if len(codes) <= 3:
        return codes
    return codes[:2] + [
        "liaison_et_autres",
        f"nombre_{len(codes) - 2:02d}",
        "liaison_vaccins_restants",
    ]


def assembler(segments: list[str], langue: str = "wo", cache: bool = True) -> Assemblage:
    """Concatène les segments en un seul fichier audio.

    Le nom du fichier produit dérive de l'empreinte des segments : deux
    messages identiques réutilisent le même fichier, ce qui évite de
    réassembler des centaines de fois le même contenu à chaque balayage.
    """
    if not ffmpeg_disponible():
        raise RuntimeError("ffmpeg est absent : impossible d'assembler l'audio.")

    empreinte = hashlib.sha256("|".join(segments).encode()).hexdigest()[:16]
    RACINE_MESSAGES.mkdir(parents=True, exist_ok=True)
    sortie = RACINE_MESSAGES / f"{langue}-{empreinte}.m4a"

    if cache and sortie.exists():
        return Assemblage(sortie, _duree(sortie), tuple(segments))

    chemins = [chemin_segment(nom, langue) for nom in segments]

    liste = RACINE_MESSAGES / f"{empreinte}.txt"
    liste.write_text(
        "\n".join(f"file '{chemin.as_posix()}'" for chemin in chemins),
        encoding="utf-8",
    )

    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(liste),
                "-c:a",
                "aac",
                "-b:a",
                "64k",
                "-ar",
                "24000",
                "-ac",
                "1",
                str(sortie),
            ],
            check=True,
            capture_output=True,
            timeout=60,
        )
    except subprocess.CalledProcessError as erreur:
        journal.error("Assemblage échoué : %s", erreur.stderr.decode()[:500])
        raise
    finally:
        liste.unlink(missing_ok=True)

    return Assemblage(sortie, _duree(sortie), tuple(segments))


def _duree(chemin: Path) -> float:
    """Durée en secondes, via ffprobe."""
    try:
        resultat = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(chemin),
            ],
            check=True,
            capture_output=True,
            timeout=10,
        )
        return round(float(resultat.stdout.decode().strip()), 1)
    except (subprocess.SubprocessError, ValueError):
        return 0.0
