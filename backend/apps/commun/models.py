"""Briques de modèle réutilisées par toutes les applications."""

import uuid

from django.db import models
from django.utils import timezone


class ModeleHorodate(models.Model):
    """Horodatage de création et de modification."""

    cree_le = models.DateTimeField(auto_now_add=True, db_index=True)
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class GestionnaireNonSupprimes(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(supprime_le__isnull=True)


"""Suppression logique : rien n'est jamais effacé (RG-10, ENF-25).

`objects` masque les enregistrements supprimés, `tous` les expose.
Toujours passer par `objects` dans le code métier.
"""


class ModeleSuppressionLogique(models.Model):
    """Suppression logique : rien n'est jamais effacé (RG-10, ENF-25).

    `objects` masque les enregistrements supprimés, `tous` les expose.
    Toujours passer par `objects` dans le code métier.
    """

    supprime_le = models.DateTimeField(null=True, blank=True, db_index=True)

    objects = GestionnaireNonSupprimes()
    tous = models.Manager()  # noqa: DJ012 — faux positif sur modèle abstrait

    class Meta:
        abstract = True

    def supprimer(self) -> None:
        self.supprime_le = timezone.now()
        self.save(update_fields=["supprime_le"])

    def restaurer(self) -> None:
        self.supprime_le = None
        self.save(update_fields=["supprime_le"])


class ModeleIdentifiantPublic(models.Model):
    """Identifiant public non devinable, exposé par l'API.

    La clé primaire entière reste interne. On n'expose jamais un compteur
    séquentiel : cela révèle le volume de bénéficiaires et permet
    l'énumération.
    """

    identifiant_public = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    class Meta:
        abstract = True
