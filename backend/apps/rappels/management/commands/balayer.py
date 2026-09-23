"""Déclenche le balayage sans attendre l'heure de Celery."""

from datetime import date

from django.core.management.base import BaseCommand

from apps.rappels.services import envoyer_les_rappels, planifier_les_rappels
from apps.suivi.services import rafraichir_statuts


class Command(BaseCommand):
    help = "Planifie et envoie les rappels du jour."

    def add_arguments(self, parser):
        parser.add_argument("--date", help="Jour à traiter (AAAA-MM-JJ). Défaut : aujourd'hui.")
        parser.add_argument(
            "--sans-envoi",
            action="store_true",
            help="Planifie sans envoyer, pour relire avant.",
        )

    def handle(self, *args, **options):
        jour = date.fromisoformat(options["date"]) if options["date"] else None

        modifiees = rafraichir_statuts(jour)
        self.stdout.write(f"Statuts rafraîchis : {modifiees}.")

        bilan = planifier_les_rappels(jour)
        self.stdout.write(f"Planification : {bilan}.")

        if options["sans_envoi"]:
            self.stdout.write(self.style.WARNING("Envoi ignoré (--sans-envoi)."))
            return

        envois = envoyer_les_rappels(jour)
        self.stdout.write(
            self.style.SUCCESS(f"Envoi : {envois['envoyes']} partis, {envois['echecs']} en échec.")
        )
