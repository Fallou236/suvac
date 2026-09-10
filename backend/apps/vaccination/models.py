"""Référentiel des vaccins et schéma vaccinal de référence.

Le schéma est stocké en base et non codé en dur : EF-25 impose de pouvoir le
corriger sans redéploiement. C'est essentiel ici, puisque le calendrier PEV
retenu doit encore être validé par une source officielle.
"""

from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.commun.models import ModeleHorodate, ModeleSuppressionLogique


class Cible(models.TextChoices):
    ENFANT = "enfant", _("Enfant")
    MERE = "mere", _("Mère")


class VoieAdministration(models.TextChoices):
    ORALE = "orale", _("Orale")
    INTRADERMIQUE = "intradermique", _("Intradermique")
    INTRAMUSCULAIRE = "intramusculaire", _("Intramusculaire")
    SOUS_CUTANEE = "sous_cutanee", _("Sous-cutanée")


class Vaccin(ModeleHorodate, ModeleSuppressionLogique):
    """Un vaccin du référentiel.

    Le libellé wolof est porté ici plutôt que dans les fichiers de traduction :
    il alimente les messages vocaux (EF-44) et doit rester modifiable par un
    administrateur sans passer par un déploiement.
    """

    code = models.CharField(_("code"), max_length=20, unique=True)
    libelle_fr = models.CharField(_("libellé français"), max_length=100)
    libelle_wo = models.CharField(_("libellé wolof"), max_length=100, blank=True)
    description = models.TextField(_("description"), blank=True)
    voie = models.CharField(
        _("voie d'administration"),
        max_length=20,
        choices=VoieAdministration.choices,
        default=VoieAdministration.INTRAMUSCULAIRE,
    )
    doses_par_flacon = models.PositiveSmallIntegerField(_("doses par flacon"), default=1)
    actif = models.BooleanField(_("actif"), default=True)

    class Meta:
        verbose_name = _("vaccin")
        verbose_name_plural = _("vaccins")
        ordering = ["code"]

    def __str__(self) -> str:
        return f"{self.code} — {self.libelle_fr}"

    def libelle(self, langue: str = "fr") -> str:
        """Libellé dans la langue demandée, avec repli sur le français."""
        if langue == "wo" and self.libelle_wo:
            return self.libelle_wo
        return self.libelle_fr


class RegleVaccinale(ModeleHorodate, ModeleSuppressionLogique):
    """Une ligne du schéma vaccinal : quel vaccin, à quel rang, à quel âge.

    Les âges sont en jours depuis la date de référence — naissance pour un
    enfant, premier contact prénatal pour une mère. Compter en jours plutôt
    qu'en semaines ou en mois évite toute ambiguïté d'arrondi : « 6 semaines »
    et « 1 mois et demi » ne tombent pas le même jour.
    """

    vaccin = models.ForeignKey(
        Vaccin,
        verbose_name=_("vaccin"),
        on_delete=models.PROTECT,
        related_name="regles",
    )
    cible = models.CharField(_("cible"), max_length=10, choices=Cible.choices, default=Cible.ENFANT)
    rang = models.PositiveSmallIntegerField(_("rang de la dose"), validators=[MinValueValidator(1)])
    age_min_jours = models.PositiveIntegerField(_("âge minimal (jours)"))
    age_cible_jours = models.PositiveIntegerField(_("âge cible (jours)"))
    age_limite_jours = models.PositiveIntegerField(
        _("âge limite (jours)"),
        null=True,
        blank=True,
        help_text=_("Fin de la fenêtre de rattrapage. Vide si sans limite."),
    )
    intervalle_min_jours = models.PositiveIntegerField(
        _("intervalle minimal (jours)"),
        null=True,
        blank=True,
        help_text=_("Délai minimal depuis la dose précédente. Vide pour la première dose."),
    )
    actif = models.BooleanField(_("actif"), default=True)

    class Meta:
        verbose_name = _("règle vaccinale")
        verbose_name_plural = _("schéma vaccinal")
        ordering = ["cible", "age_cible_jours", "vaccin__code", "rang"]
        constraints = [
            models.UniqueConstraint(
                fields=["vaccin", "cible", "rang"],
                condition=models.Q(supprime_le__isnull=True),
                name="regle_unique_par_vaccin_cible_rang",
            ),
            models.CheckConstraint(
                name="age_min_avant_age_cible",
                condition=models.Q(age_min_jours__lte=models.F("age_cible_jours")),
            ),
            models.CheckConstraint(
                name="age_limite_apres_age_cible",
                condition=models.Q(age_limite_jours__isnull=True)
                | models.Q(age_limite_jours__gte=models.F("age_cible_jours")),
            ),
        ]

    def __str__(self) -> str:
        return f"{self.vaccin.code}-{self.rang} ({self.get_cible_display()})"
