"""Charge le schéma vaccinal du PEV Sénégal.

    python manage.py charger_schema_pev

La commande est idempotente : elle met à jour les règles existantes au lieu
de les dupliquer. Elle peut donc être relancée après chaque correction du
schéma.

AVERTISSEMENT — les données ci-dessous reprennent l'annexe A du cahier des
charges, qui est une reconstitution et NON une source officielle. Elles
doivent être confrontées à un document du PEV Sénégal en vigueur et validées
par une personne compétente en santé publique avant tout usage réel.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.vaccination.models import Cible, RegleVaccinale, Vaccin, VoieAdministration

SEMAINE = 7
MOIS = 30
AN = 365

# Libellés wolof laissés vides : à faire renseigner par un locuteur natif
# avant le sprint 3, puisqu'ils alimentent les messages vocaux.
VACCINS = [
    ("BCG", "BCG", "", VoieAdministration.INTRADERMIQUE, 20),
    ("VPO", "Polio oral", "", VoieAdministration.ORALE, 20),
    ("VPI", "Polio injectable", "", VoieAdministration.INTRAMUSCULAIRE, 5),
    ("PENTA", "Pentavalent", "", VoieAdministration.INTRAMUSCULAIRE, 1),
    ("PNEUMO", "Pneumocoque", "", VoieAdministration.INTRAMUSCULAIRE, 1),
    ("ROTA", "Rotavirus", "", VoieAdministration.ORALE, 1),
    ("RR", "Rougeole-Rubéole", "", VoieAdministration.SOUS_CUTANEE, 10),
    ("VAA", "Fièvre jaune", "", VoieAdministration.SOUS_CUTANEE, 10),
    ("TD", "Antitétanique et antidiphtérique", "", VoieAdministration.INTRAMUSCULAIRE, 10),
]

# (code, cible, rang, age_min, age_cible, age_limite, intervalle_min)
REGLES = [
    # --- Naissance ---
    ("BCG", Cible.ENFANT, 1, 0, 0, 12 * MOIS, None),
    ("VPO", Cible.ENFANT, 1, 0, 0, 14 * SEMAINE, None),
    # --- 6 semaines ---
    ("PENTA", Cible.ENFANT, 1, 6 * SEMAINE, 6 * SEMAINE, 12 * MOIS, None),
    ("VPO", Cible.ENFANT, 2, 6 * SEMAINE, 6 * SEMAINE, 12 * MOIS, 4 * SEMAINE),
    ("PNEUMO", Cible.ENFANT, 1, 6 * SEMAINE, 6 * SEMAINE, 12 * MOIS, None),
    ("ROTA", Cible.ENFANT, 1, 6 * SEMAINE, 6 * SEMAINE, 15 * SEMAINE, None),
    # --- 10 semaines ---
    ("PENTA", Cible.ENFANT, 2, 10 * SEMAINE, 10 * SEMAINE, 12 * MOIS, 4 * SEMAINE),
    ("VPO", Cible.ENFANT, 3, 10 * SEMAINE, 10 * SEMAINE, 12 * MOIS, 4 * SEMAINE),
    ("PNEUMO", Cible.ENFANT, 2, 10 * SEMAINE, 10 * SEMAINE, 12 * MOIS, 4 * SEMAINE),
    ("ROTA", Cible.ENFANT, 2, 10 * SEMAINE, 10 * SEMAINE, 24 * SEMAINE, 4 * SEMAINE),
    # --- 14 semaines ---
    ("PENTA", Cible.ENFANT, 3, 14 * SEMAINE, 14 * SEMAINE, 12 * MOIS, 4 * SEMAINE),
    ("VPO", Cible.ENFANT, 4, 14 * SEMAINE, 14 * SEMAINE, 12 * MOIS, 4 * SEMAINE),
    ("PNEUMO", Cible.ENFANT, 3, 14 * SEMAINE, 14 * SEMAINE, 12 * MOIS, 4 * SEMAINE),
    ("VPI", Cible.ENFANT, 1, 14 * SEMAINE, 14 * SEMAINE, 12 * MOIS, None),
    # --- 9 mois ---
    ("RR", Cible.ENFANT, 1, 9 * MOIS, 9 * MOIS, 24 * MOIS, None),
    ("VAA", Cible.ENFANT, 1, 9 * MOIS, 9 * MOIS, 24 * MOIS, None),
    # --- 15 mois ---
    ("RR", Cible.ENFANT, 2, 15 * MOIS, 15 * MOIS, 36 * MOIS, 4 * SEMAINE),
    # --- Femme enceinte : référence = premier contact prénatal ---
    ("TD", Cible.MERE, 1, 0, 0, None, None),
    ("TD", Cible.MERE, 2, 4 * SEMAINE, 4 * SEMAINE, None, 4 * SEMAINE),
    ("TD", Cible.MERE, 3, 6 * MOIS, 6 * MOIS, None, 6 * MOIS),
    ("TD", Cible.MERE, 4, AN + 6 * MOIS, AN + 6 * MOIS, None, AN),
    ("TD", Cible.MERE, 5, 2 * AN + 6 * MOIS, 2 * AN + 6 * MOIS, None, AN),
]


class Command(BaseCommand):
    help = "Charge ou met à jour le schéma vaccinal du PEV Sénégal."

    @transaction.atomic
    def handle(self, *args, **options):
        vaccins = {}
        crees = maj = 0

        for code, libelle_fr, libelle_wo, voie, doses in VACCINS:
            vaccin, cree = Vaccin.objects.update_or_create(
                code=code,
                defaults={
                    "libelle_fr": libelle_fr,
                    "libelle_wo": libelle_wo,
                    "voie": voie,
                    "doses_par_flacon": doses,
                    "actif": True,
                },
            )
            vaccins[code] = vaccin
            crees += cree
            maj += not cree

        self.stdout.write(f"Vaccins : {crees} créés, {maj} mis à jour.")

        crees = maj = 0
        for code, cible, rang, age_min, age_cible, age_limite, intervalle in REGLES:
            _, cree = RegleVaccinale.objects.update_or_create(
                vaccin=vaccins[code],
                cible=cible,
                rang=rang,
                defaults={
                    "age_min_jours": age_min,
                    "age_cible_jours": age_cible,
                    "age_limite_jours": age_limite,
                    "intervalle_min_jours": intervalle,
                    "actif": True,
                },
            )
            crees += cree
            maj += not cree

        self.stdout.write(f"Règles : {crees} créées, {maj} mises à jour.")
        self.stdout.write(
            self.style.WARNING(
                "Schéma reconstitué, non officiel. À valider auprès du PEV Sénégal "
                "avant tout usage réel (cahier des charges, annexe A et risque R-08)."
            )
        )
