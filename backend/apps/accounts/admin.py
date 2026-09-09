from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as UserAdminBase
from django.utils.translation import gettext_lazy as _

from .models import PosteSante, Utilisateur


@admin.register(PosteSante)
class PosteSanteAdmin(admin.ModelAdmin):
    list_display = ("nom", "district", "region", "actif", "supprime_le")
    list_filter = ("region", "district", "actif")
    search_fields = ("nom", "district", "region")


@admin.register(Utilisateur)
class UtilisateurAdmin(UserAdminBase):
    list_display = ("username", "get_full_name", "role", "poste", "is_active")
    list_filter = ("role", "poste", "is_active")
    search_fields = ("username", "first_name", "last_name", "telephone")
    fieldsets = UserAdminBase.fieldsets + (
        (_("Profil SUVAC"), {"fields": ("role", "poste", "telephone", "langue")}),
    )
    add_fieldsets = UserAdminBase.add_fieldsets + (
        (_("Profil SUVAC"), {"fields": ("role", "poste", "telephone", "langue")}),
    )