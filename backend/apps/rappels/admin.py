from django.contrib import admin

from .models import Rappel


@admin.register(Rappel)
class RappelAdmin(admin.ModelAdmin):
    list_display = (
        "mere",
        "type",
        "canal",
        "statut",
        "planifie_pour",
        "envoye_le",
    )
    list_filter = ("statut", "canal", "type", "planifie_pour")
    search_fields = ("mere__prenom", "mere__nom", "mere__telephone", "texte")
    date_hierarchy = "planifie_pour"
    # Un rappel est une trace : rien ne doit pouvoir la réécrire.
    readonly_fields = [champ.name for champ in Rappel._meta.fields]
    filter_horizontal = ("echeances",)

    def has_add_permission(self, request) -> bool:
        return False
