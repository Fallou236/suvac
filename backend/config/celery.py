"""Configuration de Celery.

Le balayage quotidien des échéances est la seule tâche périodique du projet.
Elle est déclarée ici plutôt qu'en base pour qu'elle existe dès le premier
déploiement, sans intervention.
"""

import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("suvac")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

app.conf.beat_schedule = {
    "balayage-quotidien": {
        "task": "apps.rappels.taches.balayer_les_echeances",
        # 6 h du matin heure de Dakar : les rappels arrivent avant que la
        # mère ne parte aux champs ou au marché.
        "schedule": crontab(hour=6, minute=0),
    },
    "rafraichir-les-statuts": {
        "task": "apps.suivi.taches.rafraichir_les_statuts",
        # Juste avant le balayage : une échéance due hier peut être en
        # retard aujourd'hui.
        "schedule": crontab(hour=5, minute=30),
    },
}
