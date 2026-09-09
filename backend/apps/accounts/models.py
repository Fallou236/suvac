"""Postes de santé et comptes utilisateurs."""

from django.contrib.auth.models import AbstractUser, UserManager
from django.core.validators import RegexValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.commun.models import ModeleHorodate, ModeleIdentifiantPublic, ModeleSuppressionLogique

validateur_telephone = RegexValidator(
    regex=r"^\+?[0-9]{7,15}$",
    message=_("Numéro invalide. Format attendu : +221771234567."),
)


class Langue(models.TextChoices):
    FRANCAIS = "fr", _("Français")
    WOLOF = "wo", _("Wolof")


class Role(models.TextChoices):
    AGENT = "agent", _("Agent de santé")
    SUPERVISEUR = "superviseur", _("Superviseur de district")
    ADMINISTRATEUR = "admin", _("Administrateur")


class PosteSante(ModeleHorodate, ModeleSuppressionLogique, ModeleIdentifiantPublic):
    """Structure sanitaire de rattachement."""

    nom = models.CharField(_("nom"), max_length=150)
    district = models.CharField(_("district"), max_length=100)
    region = models.CharField(_("région"), max_length=100)
    latitude = models.DecimalField(
        _("latitude"), max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        _("longitude"), max_digits=9, decimal_places=6, null=True, blank=True
    )
    actif = models.BooleanField(_("actif"), default=True)

    class Meta:
        verbose_name = _("poste de santé")
        verbose_name_plural = _("postes de santé")
        ordering = ["region", "district", "nom"]
        constraints = [
            models.UniqueConstraint(
                fields=["nom", "district"],
                condition=models.Q(supprime_le__isnull=True),
                name="poste_unique_par_district",
            )
        ]

    def __str__(self) -> str:
        return f"{self.nom} ({self.district})"


class GestionnaireUtilisateur(UserManager):
    """Gestionnaire des comptes.

    Un superutilisateur est un administrateur au sens métier : il n'est
    rattaché à aucun poste et voit l'ensemble du système. On force donc son
    rôle, sans quoi il naîtrait « agent sans poste » et violerait la
    contrainte `agent_et_superviseur_ont_un_poste`.
    """

    def create_superuser(self, username, email=None, password=None, **champs):
        champs.setdefault("role", Role.ADMINISTRATEUR)
        return super().create_superuser(username, email, password, **champs)


class Utilisateur(AbstractUser, ModeleHorodate, ModeleIdentifiantPublic):
    """Compte applicatif.

    Le rôle et le poste de rattachement portent tout le contrôle d'accès
    (EF-02, EF-03).
    """

    role = models.CharField(_("rôle"), max_length=20, choices=Role.choices, default=Role.AGENT)
    poste = models.ForeignKey(
        PosteSante,
        verbose_name=_("poste de rattachement"),
        on_delete=models.PROTECT,
        related_name="utilisateurs",
        null=True,
        blank=True,
    )
    telephone = models.CharField(
        _("téléphone"), max_length=20, blank=True, validators=[validateur_telephone]
    )
    langue = models.CharField(
        _("langue"), max_length=2, choices=Langue.choices, default=Langue.FRANCAIS
    )

    objects = GestionnaireUtilisateur()

    class Meta:
        verbose_name = _("utilisateur")
        verbose_name_plural = _("utilisateurs")
        ordering = ["last_name", "first_name", "username"]
        constraints = [
            models.CheckConstraint(
                name="agent_et_superviseur_ont_un_poste",
                condition=models.Q(role="admin") | models.Q(poste__isnull=False),
            )
        ]

    def __str__(self) -> str:
        nom = self.get_full_name().strip()
        return nom or self.username

    @property
    def est_agent(self) -> bool:
        return self.role == Role.AGENT

    @property
    def est_superviseur(self) -> bool:
        return self.role == Role.SUPERVISEUR

    @property
    def est_administrateur(self) -> bool:
        return self.role == Role.ADMINISTRATEUR
