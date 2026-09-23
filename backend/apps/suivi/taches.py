"""Tâches périodiques du suivi."""

from celery import shared_task

from .services import rafraichir_statuts


@shared_task(name="apps.suivi.taches.rafraichir_les_statuts")
def rafraichir_les_statuts() -> str:
    """Réévalue les statuts avant le balayage des rappels (RG-05).

    Une échéance due hier peut être en retard aujourd'hui sans qu'aucune
    écriture n'ait eu lieu : seul le passage du temps l'a changée.
    """
    modifiees = rafraichir_statuts()
    return f"{modifiees} échéances mises à jour"
