"""Journal des actes d'administration sur les comptes.

Sur des données de santé, savoir qui a créé, désactivé ou réinitialisé un
compte n'est pas un confort : c'est ce qui permet de répondre quand une
consultation illégitime est soupçonnée.

Ce journal est en écriture seule. Rien ne le modifie ni ne l'efface.
"""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class ActeAdministration(models.TextChoices):
    CREATION_COMPTE = "creation", _("Création d'un compte")
    DESACTIVATION = "desactivation", _("Désactivation d'un compte")
    REACTIVATION = "reactivation", _("Réactivation d'un compte")
    REINITIALISATION = "reinitialisation", _("Réinitialisation du mot de passe")
    TRANSFERT = "transfert", _("Transfert vers un autre poste")
    CHANGEMENT_ROLE = "changement_role", _("Changement de rôle")


class JournalAudit(models.Model):
    acte = models.CharField(
        _("acte"), max_length=30, choices=ActeAdministration.choices, db_index=True
    )
    auteur = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name=_("auteur"),
        on_delete=models.SET_NULL,
        null=True,
        related_name="actes_administration",
    )
    cible = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name=_("compte concerné"),
        on_delete=models.SET_NULL,
        null=True,
        related_name="actes_subis",
    )
    # Conservés en clair : si le compte est supprimé un jour, la trace de
    # l'acte doit rester lisible.
    auteur_identifiant = models.CharField(_("auteur"), max_length=150, blank=True)
    cible_identifiant = models.CharField(_("cible"), max_length=150, blank=True)

    detail = models.TextField(_("détail"), blank=True)
    horodatage = models.DateTimeField(_("horodatage"), auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = _("acte d'administration")
        verbose_name_plural = _("journal d'audit")
        ordering = ["-horodatage"]

    def __str__(self) -> str:
        return f"{self.get_acte_display()} — {self.cible_identifiant}"


def journaliser(acte: str, auteur, cible, detail: str = "") -> JournalAudit:
    """Enregistre un acte d'administration.

    Ne lève jamais : un journal indisponible ne doit pas empêcher un
    superviseur de créer le compte dont son poste a besoin.
    """
    try:
        return JournalAudit.objects.create(
            acte=acte,
            auteur=auteur if auteur and auteur.is_authenticated else None,
            cible=cible,
            auteur_identifiant=getattr(auteur, "username", ""),
            cible_identifiant=getattr(cible, "username", ""),
            detail=detail,
        )
    except Exception:  # noqa: BLE001
        import logging

        logging.getLogger("suvac").exception("Journalisation d'audit échouée.")
        return None
