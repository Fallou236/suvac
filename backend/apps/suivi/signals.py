"""Génération automatique du calendrier à la création d'un bénéficiaire."""

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.beneficiaires.models import Enfant, Grossesse

from .services import generer_echeances


@receiver(post_save, sender=Enfant)
def calendrier_a_la_naissance(sender, instance, created, **kwargs):
    """EF-20 : le calendrier existe dès l'enregistrement de l'enfant."""
    if created:
        generer_echeances(instance)


@receiver(post_save, sender=Grossesse)
def calendrier_prenatal(sender, instance, created, **kwargs):
    """EF-21."""
    if created:
        generer_echeances(instance)
