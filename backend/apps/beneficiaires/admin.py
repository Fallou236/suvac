from django.contrib import admin

from .models import Consentement, Enfant, Grossesse, Mere


class ConsentementInline(admin.TabularInline):
    model = Consentement
    extra = 0
    readonly_fields = ("accorde_le",)
    fields = ("canal", "accorde_le", "revoque_le", "recueilli_par")


class EnfantInline(admin.TabularInline):
    model = Enfant
    extra = 0
    fields = ("prenom", "nom", "date_naissance", "sexe", "semaines_gestation")
    show_change_link = True


@admin.register(Mere)
class MereAdmin(admin.ModelAdmin):
    list_display = (
        "nom_complet",
        "telephone",
        "poste",
        "village",
        "accepte_les_rappels",
    )
    list_filter = ("poste", "langue")
    search_fields = ("prenom", "nom", "telephone")
    inlines = [ConsentementInline, EnfantInline]


@admin.register(Enfant)
class EnfantAdmin(admin.ModelAdmin):
    list_display = (
        "nom_complet",
        "date_naissance",
        "sexe",
        "mere",
        "poste",
        "est_premature",
    )
    list_filter = ("poste", "sexe")
    search_fields = ("prenom", "nom", "mere__prenom", "mere__nom")
    date_hierarchy = "date_naissance"


@admin.register(Grossesse)
class GrossesseAdmin(admin.ModelAdmin):
    list_display = ("mere", "rang", "date_reference", "terme_estime", "statut")
    list_filter = ("statut",)


@admin.register(Consentement)
class ConsentementAdmin(admin.ModelAdmin):
    list_display = ("mere", "canal", "accorde_le", "revoque_le", "recueilli_par")
    list_filter = ("canal",)
