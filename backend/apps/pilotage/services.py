"""Calcul des indicateurs de couverture vaccinale.

Ce module ne fait qu'agréger : aucune décision métier n'y est prise. Les
définitions des indicateurs suivent celles du PEV, à valider comme le reste
du schéma (R-08).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from django.db.models import Count, Q, QuerySet
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.beneficiaires.models import Enfant
from apps.suivi.models import DoseAdministree, Echeance, StatutEcheance
from apps.vaccination.models import Vaccin


@dataclass(frozen=True, slots=True)
class CouvertureVaccin:
    code: str
    libelle: str
    rang: int
    attendus: int
    administres: int

    @property
    def taux(self) -> float:
        return round(100 * self.administres / self.attendus, 1) if self.attendus else 0.0


def couverture_par_vaccin(echeances: QuerySet[Echeance]) -> list[CouvertureVaccin]:
    """Taux de couverture par vaccin et par rang (EF-60).

    Le dénominateur est le nombre d'échéances arrivées à terme — pas le
    nombre d'enfants. Un enfant de trois mois n'est pas « non couvert »
    pour un vaccin prévu à neuf mois : cette échéance n'est pas encore due.
    """
    agregat = (
        echeances.exclude(statut=StatutEcheance.A_VENIR)
        .values("vaccin__code", "vaccin__libelle_fr", "rang")
        .annotate(
            attendus=Count("id"),
            administres=Count("id", filter=Q(statut=StatutEcheance.ADMINISTREE)),
        )
        .order_by("vaccin__code", "rang")
    )

    return [
        CouvertureVaccin(
            code=ligne["vaccin__code"],
            libelle=ligne["vaccin__libelle_fr"],
            rang=ligne["rang"],
            attendus=ligne["attendus"],
            administres=ligne["administres"],
        )
        for ligne in agregat
    ]


@dataclass(frozen=True, slots=True)
class Abandon:
    code: str
    libelle: str
    premiere_dose: int
    derniere_dose: int

    @property
    def taux(self) -> float:
        """Proportion ayant commencé la série sans la terminer."""
        if not self.premiere_dose:
            return 0.0
        perdus = self.premiere_dose - self.derniere_dose
        return round(100 * perdus / self.premiere_dose, 1)


def taux_abandon(echeances: QuerySet[Echeance]) -> list[Abandon]:
    """Écart entre première et dernière dose d'une série (EF-61).

    C'est l'indicateur de suivi le plus parlant du PEV : il mesure non pas
    ceux qui n'ont jamais commencé, mais ceux qu'on a perdus en chemin.
    """
    series = (
        Vaccin.objects.filter(actif=True)
        .annotate(rang_max=Count("regles__rang", distinct=True))
        .filter(rang_max__gt=1)
    )

    resultats: list[Abandon] = []
    for vaccin in series:
        rangs = list(
            vaccin.regles.filter(actif=True).values_list("rang", flat=True).order_by("rang")
        )
        if len(rangs) < 2:
            continue

        base = echeances.filter(vaccin=vaccin, statut=StatutEcheance.ADMINISTREE)
        premiere = base.filter(rang=rangs[0]).count()
        derniere = base.filter(rang=rangs[-1]).count()

        if premiere:
            resultats.append(
                Abandon(
                    code=vaccin.code,
                    libelle=vaccin.libelle_fr,
                    premiere_dose=premiere,
                    derniere_dose=derniere,
                )
            )

    return sorted(resultats, key=lambda a: a.taux, reverse=True)


def activite_mensuelle(doses: QuerySet[DoseAdministree], mois: int = 12) -> list[dict]:
    """Nombre de doses administrées par mois, sur la période demandée."""
    debut = timezone.localdate().replace(day=1) - timedelta(days=31 * (mois - 1))
    debut = debut.replace(day=1)

    agregat = (
        doses.filter(date_administration__gte=debut, remplacee_par__isnull=True)
        .annotate(periode=TruncMonth("date_administration"))
        .values("periode")
        .annotate(total=Count("id"))
        .order_by("periode")
    )

    return [{"mois": ligne["periode"].isoformat(), "doses": ligne["total"]} for ligne in agregat]


@dataclass(frozen=True, slots=True)
class Synthese:
    enfants_suivis: int
    doses_du_mois: int
    en_retard: int
    perimees: int
    couverture_globale: float


def synthese(
    enfants: QuerySet[Enfant],
    echeances: QuerySet[Echeance],
    doses: QuerySet[DoseAdministree],
) -> Synthese:
    """Les quatre chiffres qui résument l'activité d'un poste."""
    debut_mois = timezone.localdate().replace(day=1)

    arrivees = echeances.exclude(statut=StatutEcheance.A_VENIR).count()
    administrees = echeances.filter(statut=StatutEcheance.ADMINISTREE).count()

    return Synthese(
        enfants_suivis=enfants.count(),
        doses_du_mois=doses.filter(
            date_administration__gte=debut_mois, remplacee_par__isnull=True
        ).count(),
        en_retard=echeances.filter(statut=StatutEcheance.EN_RETARD).count(),
        perimees=echeances.filter(statut=StatutEcheance.PERIMEE).count(),
        couverture_globale=(round(100 * administrees / arrivees, 1) if arrivees else 0.0),
    )


def enfants_en_retard(echeances: QuerySet[Echeance], limite: int = 100) -> list[dict]:
    """Liste nominative des enfants en retard, du plus ancien au plus récent (EF-62)."""
    aujourdhui = timezone.localdate()

    lignes = (
        echeances.filter(statut=StatutEcheance.EN_RETARD, enfant__isnull=False)
        .select_related("enfant", "enfant__mere", "vaccin")
        .order_by("date_limite")[:limite]
    )

    return [
        {
            "enfant_id": str(e.enfant.identifiant_public),
            "enfant": e.enfant.nom_complet,
            "mere": e.enfant.mere.nom_complet,
            "telephone": e.enfant.mere.telephone,
            "village": e.enfant.mere.village,
            "vaccin": f"{e.vaccin.code}-{e.rang}",
            "date_limite": e.date_limite.isoformat() if e.date_limite else None,
            "retard_jours": e.retard_en_jours(aujourdhui),
        }
        for e in lignes
    ]
