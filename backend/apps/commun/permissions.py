"""Permissions transverses.

EF-03 : un agent n'accède qu'aux données de son poste de rattachement.
"""

from rest_framework import permissions

from apps.accounts.models import Role


class EstAdministrateur(permissions.BasePermission):
    message = "Réservé aux administrateurs."

    def has_permission(self, request, view) -> bool:
        return bool(request.user.is_authenticated and request.user.est_administrateur)


class EstSuperviseurOuAdministrateur(permissions.BasePermission):
    message = "Réservé aux superviseurs et administrateurs."

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user.is_authenticated
            and request.user.role in {Role.SUPERVISEUR, Role.ADMINISTRATEUR}
        )


class LectureSeulePourSuperviseur(permissions.BasePermission):
    """Le superviseur consulte et n'administre pas de doses.

    C'est une règle métier, pas une commodité : la responsabilité d'un acte
    vaccinal appartient à l'agent qui l'a réalisé.
    """

    message = "Le superviseur ne peut pas modifier les données de vaccination."

    def has_permission(self, request, view) -> bool:
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.role != Role.SUPERVISEUR


class FiltrageParPoste:
    """Mixin de filtrage par poste de rattachement.

    L'attribut `champ_poste` indique le chemin vers le poste depuis le modèle
    filtré — par exemple `poste` ou `mere__poste`.
    """

    champ_poste = "poste"

    def filtrer_par_poste(self, queryset):
        utilisateur = self.request.user

        if utilisateur.est_administrateur:
            return queryset
        if utilisateur.poste_id is None:
            return queryset.none()
        return queryset.filter(**{f"{self.champ_poste}_id": utilisateur.poste_id})
