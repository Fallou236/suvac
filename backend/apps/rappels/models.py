"""Modèle des rappels adressés aux bénéficiaires.

Un rappel est une trace, pas un événement passager : il dit qui a été
prévenu, quand, par quel canal, et ce qu'il est advenu du message. Sans
cette trace, impossible de savoir si une mère absente a été relancée ni
de ne pas la relancer deux fois.
"""

from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.commun.models import ModeleHorodate, ModeleIdentifiantPublic


class CanalRappel(models.TextChoices):
    WHATSAPP = "whatsapp", _("WhatsApp")
    SMS = "sms", _("SMS")
    APPLICATION = "application", _("Application")
    SIMULATION = "simulation", _("Simulation")


class TypeRappel(models.TextChoices):
    AVANT_ECHEANCE = "avant", _("Avant l'échéance")
    JOUR_MEME = "jour", _("Le jour même")
    RELANCE = "relance", _("Relance après retard")
    CONFIRMATION = "confirmation", _("Confirmation d'administration")


class StatutRappel(models.TextChoices):
    EN_ATTENTE = "en_attente", _("En attente d'envoi")
    ENVOYE = "envoye", _("Envoyé")
    REMIS = "remis", _("Remis au destinataire")
    LU = "lu", _("Lu")
    ECHEC = "echec", _("Échec")
    ABANDONNE = "abandonne", _("Abandonné")


class Rappel(ModeleHorodate, ModeleIdentifiantPublic):
    """Un message adressé à une mère au sujet d'une ou plusieurs échéances.

    Un rappel peut porter sur plusieurs échéances : RG-09 impose de les
    regrouper en un seul message plutôt que d'en envoyer un par vaccin.
    """

    mere = models.ForeignKey(
        "beneficiaires.Mere",
        verbose_name=_("destinataire"),
        on_delete=models.CASCADE,
        related_name="rappels",
    )
    echeances = models.ManyToManyField(
        "suivi.Echeance",
        verbose_name=_("échéances concernées"),
        related_name="rappels",
    )

    type = models.CharField(_("type"), max_length=20, choices=TypeRappel.choices)
    canal = models.CharField(_("canal"), max_length=20, choices=CanalRappel.choices)
    statut = models.CharField(
        _("statut"),
        max_length=20,
        choices=StatutRappel.choices,
        default=StatutRappel.EN_ATTENTE,
        db_index=True,
    )

    langue = models.CharField(_("langue"), max_length=5, default="wo")
    texte = models.TextField(
        _("texte du message"),
        help_text=_("Conservé pour tracer ce qui a réellement été envoyé."),
    )

    # Ces trois dates disent l'histoire du message.
    planifie_pour = models.DateField(_("planifié pour"), db_index=True)
    envoye_le = models.DateTimeField(_("envoyé le"), null=True, blank=True)
    remis_le = models.DateTimeField(_("remis le"), null=True, blank=True)

    identifiant_externe = models.CharField(
        _("identifiant chez l'opérateur"),
        max_length=255,
        blank=True,
        db_index=True,
        help_text=_("Permet de relier un accusé de réception à ce rappel."),
    )
    erreur = models.TextField(_("erreur"), blank=True)
    tentatives = models.PositiveSmallIntegerField(_("tentatives"), default=0)

    class Meta:
        verbose_name = _("rappel")
        verbose_name_plural = _("rappels")
        ordering = ["-planifie_pour", "-cree_le"]
        indexes = [
            models.Index(fields=["mere", "planifie_pour"]),
            models.Index(fields=["statut", "planifie_pour"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["mere", "type", "planifie_pour"],
                name="un_seul_rappel_par_type_et_par_jour",
            )
        ]

    def __str__(self) -> str:
        return f"{self.get_type_display()} à {self.mere} le {self.planifie_pour}"

    def marquer_envoye(self, identifiant_externe: str = "") -> None:
        self.statut = StatutRappel.ENVOYE
        self.envoye_le = timezone.now()
        self.identifiant_externe = identifiant_externe
        self.erreur = ""
        self.save(
            update_fields=[
                "statut",
                "envoye_le",
                "identifiant_externe",
                "erreur",
                "modifie_le",
            ]
        )

    def marquer_remis(self) -> None:
        self.statut = StatutRappel.REMIS
        self.remis_le = timezone.now()
        self.save(update_fields=["statut", "remis_le", "modifie_le"])

    def marquer_lu(self) -> None:
        self.statut = StatutRappel.LU
        if self.remis_le is None:
            self.remis_le = timezone.now()
        self.save(update_fields=["statut", "remis_le", "modifie_le"])

    def marquer_echec(self, message: str, definitif: bool = False) -> None:
        self.tentatives += 1
        self.erreur = message[:2000]
        self.statut = StatutRappel.ABANDONNE if definitif else StatutRappel.ECHEC
        self.save(update_fields=["statut", "erreur", "tentatives", "modifie_le"])
