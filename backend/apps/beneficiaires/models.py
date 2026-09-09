"""Mères, grossesses et enfants.

Le consentement aux rappels est modélisé comme une entité à part entière et
non comme une case à cocher : ENF-21 impose qu'il soit horodaté, traçable et
révocable à tout moment.
"""

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.accounts.models import Langue, PosteSante, validateur_telephone
from apps.commun.models import ModeleHorodate, ModeleIdentifiantPublic, ModeleSuppressionLogique


class Sexe(models.TextChoices):
    FEMININ = "F", _("Féminin")
    MASCULIN = "M", _("Masculin")


class CanalRappel(models.TextChoices):
    WHATSAPP = "whatsapp", _("WhatsApp")
    SMS = "sms", _("SMS")
    APPLICATION = "application", _("Application uniquement")


class StatutGrossesse(models.TextChoices):
    EN_COURS = "en_cours", _("En cours")
    TERMINEE = "terminee", _("Terminée")
    INTERROMPUE = "interrompue", _("Interrompue")


class Mere(ModeleHorodate, ModeleSuppressionLogique, ModeleIdentifiantPublic):
    """Femme bénéficiaire, mère ou future mère."""

    prenom = models.CharField(_("prénom"), max_length=100)
    nom = models.CharField(_("nom"), max_length=100)
    date_naissance = models.DateField(_("date de naissance"), null=True, blank=True)
    telephone = models.CharField(
        _("téléphone"), max_length=20, blank=True, validators=[validateur_telephone]
    )
    langue = models.CharField(
        _("langue préférée"), max_length=2, choices=Langue.choices, default=Langue.WOLOF
    )
    poste = models.ForeignKey(
        PosteSante,
        verbose_name=_("poste de rattachement"),
        on_delete=models.PROTECT,
        related_name="meres",
    )
    village = models.CharField(_("village ou quartier"), max_length=150, blank=True)

    class Meta:
        verbose_name = _("mère")
        verbose_name_plural = _("mères")
        ordering = ["nom", "prenom"]
        indexes = [
            models.Index(fields=["poste", "nom"]),
            models.Index(fields=["telephone"]),
        ]

    def __str__(self) -> str:
        return f"{self.prenom} {self.nom}"

    @property
    def nom_complet(self) -> str:
        return f"{self.prenom} {self.nom}"

    @property
    def consentement_actif(self) -> "Consentement | None":
        """Dernier consentement non révoqué, s'il existe."""
        return self.consentements.filter(revoque_le__isnull=True).order_by("-accorde_le").first()

    @property
    def accepte_les_rappels(self) -> bool:
        """EF-47 : aucun rappel sans consentement actif."""
        consentement = self.consentement_actif
        return consentement is not None and consentement.canal != CanalRappel.APPLICATION


class Consentement(ModeleHorodate):
    """Trace du consentement aux rappels (ENF-21).

    On n'écrase jamais un consentement : une révocation pose une date, et un
    nouveau consentement crée une ligne. L'historique reste lisible.
    """

    mere = models.ForeignKey(
        Mere, verbose_name=_("mère"), on_delete=models.CASCADE, related_name="consentements"
    )
    canal = models.CharField(
        _("canal accepté"),
        max_length=20,
        choices=CanalRappel.choices,
        default=CanalRappel.WHATSAPP,
    )
    accorde_le = models.DateTimeField(_("accordé le"), default=timezone.now)
    revoque_le = models.DateTimeField(_("révoqué le"), null=True, blank=True)
    recueilli_par = models.ForeignKey(
        "accounts.Utilisateur",
        verbose_name=_("recueilli par"),
        on_delete=models.PROTECT,
        related_name="consentements_recueillis",
    )

    class Meta:
        verbose_name = _("consentement")
        verbose_name_plural = _("consentements")
        ordering = ["-accorde_le"]

    def __str__(self) -> str:
        etat = _("révoqué") if self.revoque_le else _("actif")
        return f"{self.mere} — {self.get_canal_display()} ({etat})"

    def revoquer(self) -> None:
        if self.revoque_le is None:
            self.revoque_le = timezone.now()
            self.save(update_fields=["revoque_le", "modifie_le"])


class Grossesse(ModeleHorodate, ModeleSuppressionLogique, ModeleIdentifiantPublic):
    """Un épisode de grossesse.

    `date_reference` est le premier contact prénatal : c'est à partir de cette
    date que se calcule le calendrier antitétanique de la mère (EF-21).
    """

    mere = models.ForeignKey(
        Mere, verbose_name=_("mère"), on_delete=models.PROTECT, related_name="grossesses"
    )
    rang = models.PositiveSmallIntegerField(_("rang de la grossesse"), default=1)
    date_reference = models.DateField(_("date du premier contact prénatal"))
    terme_estime = models.DateField(_("terme estimé"), null=True, blank=True)
    statut = models.CharField(
        _("statut"),
        max_length=15,
        choices=StatutGrossesse.choices,
        default=StatutGrossesse.EN_COURS,
    )

    class Meta:
        verbose_name = _("grossesse")
        verbose_name_plural = _("grossesses")
        ordering = ["-date_reference"]

    def __str__(self) -> str:
        return f"{self.mere} — grossesse {self.rang}"

    def clean(self) -> None:
        if self.terme_estime and self.terme_estime < self.date_reference:
            raise ValidationError(
                {"terme_estime": _("Le terme ne peut précéder le premier contact prénatal.")}
            )


class Enfant(ModeleHorodate, ModeleSuppressionLogique, ModeleIdentifiantPublic):
    """Enfant bénéficiaire.

    `semaines_gestation` sert au repérage des prématurés. Le PEV se fonde sur
    l'âge chronologique et non corrigé (RG-07), mais l'information reste
    nécessaire pour signaler le cas à l'agent.
    """

    mere = models.ForeignKey(
        Mere, verbose_name=_("mère"), on_delete=models.PROTECT, related_name="enfants"
    )
    grossesse = models.ForeignKey(
        Grossesse,
        verbose_name=_("grossesse"),
        on_delete=models.SET_NULL,
        related_name="enfants",
        null=True,
        blank=True,
    )
    prenom = models.CharField(_("prénom"), max_length=100, blank=True)
    nom = models.CharField(_("nom"), max_length=100, blank=True)
    date_naissance = models.DateField(_("date de naissance"))
    sexe = models.CharField(_("sexe"), max_length=1, choices=Sexe.choices)
    semaines_gestation = models.PositiveSmallIntegerField(
        _("semaines de gestation à la naissance"),
        null=True,
        blank=True,
        help_text=_("Moins de 37 semaines : prématuré."),
    )
    poids_naissance_grammes = models.PositiveIntegerField(
        _("poids de naissance (g)"), null=True, blank=True
    )
    poste = models.ForeignKey(
        PosteSante,
        verbose_name=_("poste de rattachement"),
        on_delete=models.PROTECT,
        related_name="enfants",
    )

    class Meta:
        verbose_name = _("enfant")
        verbose_name_plural = _("enfants")
        ordering = ["-date_naissance"]
        indexes = [
            models.Index(fields=["poste", "date_naissance"]),
            models.Index(fields=["mere"]),
        ]

    def __str__(self) -> str:
        return f"{self.prenom} {self.nom}".strip() or f"Enfant de {self.mere}"

    @property
    def nom_complet(self) -> str:
        complet = f"{self.prenom} {self.nom}".strip()
        return complet or f"Enfant de {self.mere.nom_complet}"

    @property
    def est_premature(self) -> bool:
        return self.semaines_gestation is not None and self.semaines_gestation < 37

    def age_en_jours(self, a_la_date=None) -> int:
        reference = a_la_date or timezone.localdate()
        return (reference - self.date_naissance).days

    def clean(self) -> None:
        if self.date_naissance and self.date_naissance > timezone.localdate():
            raise ValidationError(
                {"date_naissance": _("La date de naissance ne peut être future.")}
            )
