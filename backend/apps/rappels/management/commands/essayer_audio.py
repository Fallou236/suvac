"""Assemble le message vocal d'un rappel et rapporte sa durée."""

from django.core.management.base import BaseCommand

from apps.rappels.audio import assembler, segments_du_message
from apps.rappels.models import Rappel


class Command(BaseCommand):
    help = "Assemble l'audio d'un rappel existant et affiche sa durée."

    def add_arguments(self, parser):
        parser.add_argument("--tous", action="store_true")
        parser.add_argument("--limite", type=int, default=5)

    def handle(self, *args, **options):
        rappels = Rappel.objects.select_related("mere").prefetch_related(
            "echeances__vaccin", "echeances__enfant__poste", "echeances__grossesse"
        )[: options["limite"]]

        if not rappels:
            self.stdout.write(self.style.WARNING("Aucun rappel en base."))
            return

        for rappel in rappels:
            echeances = list(rappel.echeances.all())
            if not echeances:
                continue

            premiere = echeances[0]
            pour_elle_meme = premiere.grossesse_id is not None
            poste = rappel.mere.poste.nom if pour_elle_meme else premiere.enfant.poste.nom

            segments = segments_du_message(echeances, rappel.type, poste, pour_elle_meme)

            try:
                assemblage = assembler(segments, rappel.langue)
            except Exception as erreur:  # noqa: BLE001
                self.stdout.write(self.style.ERROR(f"{rappel.mere} : {erreur}"))
                continue

            alerte = " — TROP LONG" if assemblage.duree_estimee > 45 else ""
            self.stdout.write(
                f"{rappel.get_type_display()} | {rappel.mere} | "
                f"{assemblage.duree_estimee}s{alerte}"
            )
            self.stdout.write(f"  {len(segments)} segments : {' + '.join(segments)}")
            self.stdout.write(f"  {assemblage.chemin.name}\n")
