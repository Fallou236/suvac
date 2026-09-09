from django.contrib import admin

from .models import RegleVaccinale, Vaccin


class RegleInline(admin.TabularInline):
    model = RegleVaccinale
    extra = 0
    fields = ("cible", "rang", "age_min_jours", "age_cible_jours",
              "age_limite_jours", "intervalle_min_jours", "actif")


@admin.register(Vaccin)
class VaccinAdmin(admin.ModelAdmin):
    list_display = ("code", "libelle_fr", "libelle_wo", "voie", "actif")
    list_filter = ("actif", "voie")
    search_fields = ("code", "libelle_fr", "libelle_wo")
    inlines = [RegleInline]


@admin.register(RegleVaccinale)
class RegleVaccinaleAdmin(admin.ModelAdmin):
    list_display = ("vaccin", "cible", "rang", "age_cible_jours",
                    "age_limite_jours", "intervalle_min_jours", "actif")
    list_filter = ("cible", "actif", "vaccin")
    ordering = ("cible", "age_cible_jours")