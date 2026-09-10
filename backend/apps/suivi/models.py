"""Échéances planifiées et doses administrées.

Les échéances sont persistées plutôt que recalculées à chaque requête. Deux
raisons : le balayage quotidien des rappels (EF-40) doit pouvoir interroger la
base par date, et un agent hors ligne doit disposer de sa file du jour sans
moteur de calcul embarqué.
"""

import uuid

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.beneficiaires.models import Enfant, Grossesse
from apps.commun.models import ModeleHorodate, ModeleIdentifiantPublic
from apps.vaccination.models import Vaccin


class StatutEcheance(models.TextChoices):
    A_VENIR = "a_venir", _("À venir")
    DUE = "due", _("Due")
    EN_RETARD = "en_retard", _("En retard")
    ADMINISTREE = "administree", _("Administrée")
    ANNULEE = "annulee", _("Annulée")


class MotifAnnulation(models.TextChoices):
    CONTRE_INDICATION = "contre_indication", _("Contre-indication médicale")
    DECES = "deces", _("Décès")
    DEMENAGEMENT = "demenagement", _("Déménagement")
    REFUS = "refus", _("Refus des parents")
    AUTRE = "autre", _("Autre")


class Echeance(ModeleHorodate, ModeleIdentifiantPublic):
    """Un rendez-vous vaccinal planifié par le moteur.

    Le bénéficiaire est soit un enfant, soit une grossesse — jamais les deux,
    jamais aucun. La contrainte `beneficiaire_unique` l'impose en base.
    """

    enfant = models.ForeignKey(
        Enfant,
        verbose_name=_("enfant"),
        on_delete=models.CASCADE,
        related_name="echeances",
        null=True,
        blank=True,
    )
    grossesse = models.ForeignKey(
        Grossesse,
        verbose_name=_("grossesse"),
        on_delete=models.CASCADE,
        related_name="echeances",
        null=True,
        blank=True,
    )
    vaccin = models.ForeignKey(
        Vaccin,
        verbose_name=_("vaccin"),
        on_delete=models.PROTECT,
        related_name="echeances",
    )
    rang = models.PositiveSmallIntegerField(_("rang de la dose"))

    date_ouverture = models.DateField(_("date d'ouverture"))
    date_cible = models.DateField(_("date cible"), db_index=True)
    date_limite = models.DateField(_("date limite"), null=True, blank=True, db_index=True)

    statut = models.CharField(
        _("statut"),
        max_length=15,
        choices=StatutEcheance.choices,
        default=StatutEcheance.A_VENIR,
        db_index=True,
    )
    motif_annulation = models.CharField(
        _("motif d'annulation"),
        max_length=20,
        choices=MotifAnnulation.choices,
        blank=True,
    )
    commentaire_annulation = models.TextField(_("commentaire"), blank=True)

    class Meta:
        verbose_name = _("échéance")
        verbose_name_plural = _("échéances")
        ordering = ["date_cible", "vaccin__code", "rang"]
        constraints = [
            models.CheckConstraint(
                name="beneficiaire_unique",
                condition=(
                    models.Q(enfant__isnull=False, grossesse__isnull=True)
                    | models.Q(enfant__isnull=True, grossesse__isnull=False)
                ),
            ),
            models.UniqueConstraint(
                fields=["enfant", "vaccin", "rang"],
                condition=models.Q(enfant__isnull=False),
                name="echeance_unique_par_enfant",
            ),
            models.UniqueConstraint(
                fields=["grossesse", "vaccin", "rang"],
                condition=models.Q(grossesse__isnull=False),
                name="echeance_unique_par_grossesse",
            ),
        ]
        indexes = [
            models.Index(fields=["statut", "date_cible"]),
        ]

    def __str__(self) -> str:
        return f"{self.beneficiaire} — {self.vaccin.code}-{self.rang}"

    @property
    def beneficiaire(self):
        return self.enfant or self.grossesse

    @property
    def poste(self):
        if self.enfant:
            return self.enfant.poste
        return self.grossesse.mere.poste

    def retard_en_jours(self, a_la_date=None) -> int:
        reference = a_la_date or timezone.localdate()
        if self.date_limite is None or reference <= self.date_limite:
            return 0
        return (reference - self.date_limite).days

    def annuler(self, motif: str, commentaire: str = "") -> None:
        """EF-27. Une échéance annulée ne déclenche plus de rappel (RG-08)."""
        if self.statut == StatutEcheance.ADMINISTREE:
            raise ValidationError(_("Une dose administrée ne peut être annulée."))
        self.statut = StatutEcheance.ANNULEE
        self.motif_annulation = motif
        self.commentaire_annulation = commentaire
        self.save(
            update_fields=[
                "statut",
                "motif_annulation",
                "commentaire_annulation",
                "modifie_le",
            ]
        )


class DoseAdministree(ModeleHorodate, ModeleIdentifiantPublic):
    """Un acte vaccinal réalisé.

    RG-10 : cet enregistrement est immuable. Une correction crée une nouvelle
    version et marque la précédente comme remplacée ; rien n'est jamais effacé.

    `cle_idempotence` est fournie par le client. Elle permet de rejouer sans
    risque la file de synchronisation hors ligne (EF-54) : un même acte soumis
    deux fois ne crée qu'une seule dose.
    """

    echeance = models.ForeignKey(
        Echeance,
        verbose_name=_("échéance"),
        on_delete=models.PROTECT,
        related_name="doses",
    )
    date_administration = models.DateField(_("date d'administration"), db_index=True)
    numero_lot = models.CharField(_("numéro de lot"), max_length=50, blank=True)
    agent = models.ForeignKey(
        "accounts.Utilisateur",
        verbose_name=_("agent"),
        on_delete=models.PROTECT,
        related_name="doses_administrees",
    )
    poste = models.ForeignKey(
        "accounts.PosteSante",
        verbose_name=_("poste"),
        on_delete=models.PROTECT,
        related_name="doses_administrees",
    )
    cle_idempotence = models.UUIDField(
        _("clé d'idempotence"),
        default=uuid.uuid4,
        unique=True,
        help_text=_("Générée par le client. Empêche les doublons à la synchronisation."),
    )
    remplacee_par = models.OneToOneField(
        "self",
        verbose_name=_("remplacée par"),
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="remplace",
    )
    evenement_indesirable = models.TextField(_("événement indésirable"), blank=True)

    class Meta:
        verbose_name = _("dose administrée")
        verbose_name_plural = _("doses administrées")
        ordering = ["-date_administration"]
        indexes = [
            models.Index(fields=["poste", "date_administration"]),
        ]

    def __str__(self) -> str:
        return f"{self.echeance} — {self.date_administration}"

    @property
    def est_courante(self) -> bool:
        return self.remplacee_par is None

    def clean(self) -> None:
        if self.date_administration and self.date_administration > timezone.localdate():
            raise ValidationError(
                {"date_administration": _("Une dose ne peut être administrée dans le futur.")}
            )
