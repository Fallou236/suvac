"""Envoie un vrai message WhatsApp, pour éprouver la chaîne de bout en bout."""

from pathlib import Path

from django.core.management.base import BaseCommand

from apps.rappels.canaux.base import MessageSortant
from apps.rappels.canaux.whatsapp import CanalWhatsApp


class Command(BaseCommand):
    help = "Envoie un message WhatsApp de test."

    def add_arguments(self, parser):
        parser.add_argument("numero", help="Destinataire, déclaré chez Meta.")
        parser.add_argument("--video", help="Chemin d'une vidéo à joindre.")
        parser.add_argument("--nom", default="votre enfant")
        parser.add_argument(
            "--texte",
            action="store_true",
            help="Message texte libre — ne passe que dans la fenêtre de 24 h.",
        )

    def handle(self, *args, **options):
        canal = CanalWhatsApp()

        if not canal.disponible():
            self.stdout.write(
                self.style.ERROR(
                    "WhatsApp non configuré. Renseignez WHATSAPP_NUMERO_ID et "
                    "WHATSAPP_JETON dans .env."
                )
            )
            return

        video = None
        if not options["texte"]:
            if options["video"]:
                video = options["video"]
            else:
                from apps.rappels.video import RACINE_VIDEOS

                fichiers = sorted(RACINE_VIDEOS.glob("*.mp4"))
                if not fichiers:
                    self.stdout.write(
                        self.style.ERROR(
                            "Aucune vidéo. Lancez d'abord `essayer_audio` puis " "l'encapsulation."
                        )
                    )
                    return
                video = str(fichiers[0])
                self.stdout.write(f"Vidéo : {Path(video).name}")

        resultat = canal.envoyer(
            MessageSortant(
                destinataire=options["numero"],
                texte="Rappel de vaccination — SUVAC",
                chemin_audio=video,
                variables=(options["nom"],),
            )
        )

        if resultat.reussi:
            self.stdout.write(self.style.SUCCESS(f"Envoyé — {resultat.identifiant_externe}"))
        else:
            style = self.style.ERROR if resultat.definitif else self.style.WARNING
            mention = "définitif" if resultat.definitif else "à réessayer"
            self.stdout.write(style(f"Échec ({mention}) : {resultat.erreur}"))
