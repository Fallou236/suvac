"""Passerelle entre le référentiel en base et le moteur de calendrier.

Le module `apps.domaine.calendrier` ignore tout de Django. Ce fichier est le
seul point de contact : il lit les règles en base et les convertit en objets
du domaine.
"""

from collections.abc import Sequence

from apps.domaine import calendrier as moteur

from .models import Cible, RegleVaccinale


def charger_schema(cible: str = Cible.ENFANT) -> list[moteur.RegleVaccinale]:
    """Charge le schéma actif pour une cible donnée."""
    regles = (
        RegleVaccinale.objects.filter(cible=cible, actif=True, vaccin__actif=True)
        .select_related("vaccin")
        .order_by("vaccin__code", "rang")
    )
    return [_convertir(regle) for regle in regles]


def _convertir(regle: RegleVaccinale, langue: str = "fr") -> moteur.RegleVaccinale:
    return moteur.RegleVaccinale(
        code_vaccin=regle.vaccin.code,
        libelle=regle.vaccin.libelle(langue),
        rang=regle.rang,
        age_min_jours=regle.age_min_jours,
        age_cible_jours=regle.age_cible_jours,
        age_limite_jours=regle.age_limite_jours,
        intervalle_min_jours=regle.intervalle_min_jours,
        cible=moteur.Cible(regle.cible),
    )


def regle_pour(
    schema: Sequence[moteur.RegleVaccinale], code_vaccin: str, rang: int
) -> moteur.RegleVaccinale | None:
    """Retrouve une règle précise dans un schéma déjà chargé."""
    for regle in schema:
        if regle.code_vaccin == code_vaccin and regle.rang == rang:
            return regle
    return None
