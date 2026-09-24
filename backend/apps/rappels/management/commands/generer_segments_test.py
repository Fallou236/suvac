"""Produit des segments audio factices pour éprouver l'assemblage.

Ces fichiers ne contiennent qu'un silence de la durée approximative du
texte réel. Ils permettent de vérifier que la chaîne d'assemblage
fonctionne, que les noms de segments correspondent, et que la durée des
messages reste raisonnable — avant même que les enregistrements existent.

À ne jamais utiliser en production : un message silencieux serait pire
qu'aucun message.
"""

import subprocess
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

# Durée approximative de chaque segment, en secondes. Estimée à la lecture :
# environ deux mots et demi par seconde en parole posée.
SEGMENTS = {
    "amorce_salutation": 1.0,
    "liaison_doit_recevoir": 1.2,
    "liaison_le": 0.4,
    "liaison_aujourdhui": 0.5,
    "liaison_venez_au_poste": 1.8,
    "liaison_na_pas_recu": 1.0,
    "liaison_prevu_le": 1.5,
    "liaison_venez_vite": 3.0,
    "liaison_a_recu": 1.0,
    "liaison_prochain_rdv": 1.8,
    "mere_doit_recevoir": 2.2,
    "mere_na_pas_recu": 2.5,
    "liaison_et_autres": 0.4,
    "liaison_vaccins_restants": 1.2,
    "beneficiaire_votre_enfant": 0.8,
    "liaison_ne_en": 1.4,
    "vaccin_bcg": 2.2,
    "vaccin_vpo": 2.4,
    "vaccin_vpi": 2.4,
    # Le pentavalent énumère cinq maladies : c'est le plus long.
    "vaccin_penta": 9.0,
    "vaccin_pneumo": 2.6,
    "vaccin_rota": 2.8,
    "vaccin_rr": 2.6,
    "vaccin_vaa": 2.0,
    "vaccin_td": 2.6,
    "poste_ndondol": 1.0,
    "poste_ngaparou": 1.0,
}

MOIS = [
    "sanwiye",
    "fewriye",
    "mars",
    "awril",
    "me",
    "suwe",
    "sulet",
    "ut",
    "sattumbar",
    "oktoobar",
    "nowambar",
    "desambar",
]


class Command(BaseCommand):
    help = "Crée des segments audio silencieux pour tester l'assemblage."

    def add_arguments(self, parser):
        parser.add_argument("--langue", default="wo")
        parser.add_argument(
            "--ecraser",
            action="store_true",
            help="Remplace les fichiers existants, y compris de vrais enregistrements.",
        )

    def handle(self, *args, **options):
        langue = options["langue"]
        dossier = Path(settings.MEDIA_ROOT) / "audio" / langue
        dossier.mkdir(parents=True, exist_ok=True)

        durees = dict(SEGMENTS)
        durees.update({f"mois_{i + 1:02d}": 0.9 for i in range(len(MOIS))})
        # Les nombres composés sont plus longs à dire.
        durees.update({f"nombre_{j:02d}": 0.7 if j <= 10 else 1.3 for j in range(1, 32)})

        crees = 0
        ignores = 0

        for nom, duree in durees.items():
            chemin = dossier / f"{nom}.m4a"

            if chemin.exists() and not options["ecraser"]:
                ignores += 1
                continue

            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-f",
                    "lavfi",
                    "-i",
                    "anullsrc=r=24000:cl=mono",
                    "-t",
                    str(duree),
                    "-c:a",
                    "aac",
                    "-b:a",
                    "64k",
                    str(chemin),
                ],
                check=True,
                capture_output=True,
            )
            crees += 1

        self.stdout.write(f"Segments créés : {crees}, ignorés : {ignores}.")
        self.stdout.write(f"Dossier : {dossier}")
        self.stdout.write(
            self.style.WARNING(
                "Ces fichiers sont silencieux. Ils servent à éprouver "
                "l'assemblage, jamais à envoyer un vrai message."
            )
        )
