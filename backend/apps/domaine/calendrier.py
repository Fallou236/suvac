"""Moteur de calendrier vaccinal.

Ce module ne dépend ni de Django, ni de la base de données, ni du réseau.
Il ne manipule que des dates et des structures immuables. C'est ce qui permet
de le tester exhaustivement et de le faire évoluer sans toucher au reste.

Règles de gestion implémentées : RG-01 à RG-06.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from enum import StrEnum

# Identifiant d'une échéance : le vaccin et le rang de la dose dans sa série.
CleDose = tuple[str, int]


class Cible(StrEnum):
    ENFANT = "enfant"
    MERE = "mere"


class Statut(StrEnum):
    A_VENIR = "a_venir"
    DUE = "due"
    EN_RETARD = "en_retard"
    ADMINISTREE = "administree"
    ANNULEE = "annulee"


class Violation(StrEnum):
    """Motif de refus d'une administration."""

    AGE_MINIMAL_NON_ATTEINT = "age_minimal_non_atteint"
    INTERVALLE_MINIMAL_NON_RESPECTE = "intervalle_minimal_non_respecte"
    DOSE_PRECEDENTE_MANQUANTE = "dose_precedente_manquante"
    DOSE_DEJA_ADMINISTREE = "dose_deja_administree"
    DATE_FUTURE = "date_future"


@dataclass(frozen=True, slots=True)
class RegleVaccinale:
    """Une ligne du schéma vaccinal de référence.

    Les âges sont exprimés en jours depuis la date de référence : la naissance
    pour un enfant, le premier contact prénatal pour une mère.
    """

    code_vaccin: str
    libelle: str
    rang: int
    age_min_jours: int
    age_cible_jours: int
    age_limite_jours: int | None = None
    intervalle_min_jours: int | None = None
    cible: Cible = Cible.ENFANT

    def __post_init__(self) -> None:
        if self.rang < 1:
            raise ValueError("Le rang d'une dose commence à 1.")
        if self.age_min_jours > self.age_cible_jours:
            raise ValueError(
                f"{self.code_vaccin}-{self.rang} : âge minimal postérieur à l'âge cible."
            )
        if self.age_limite_jours is not None and self.age_limite_jours < self.age_cible_jours:
            raise ValueError(
                f"{self.code_vaccin}-{self.rang} : âge limite antérieur à l'âge cible."
            )

    @property
    def tolerance_jours(self) -> int | None:
        """Marge de rattrapage prévue par le schéma, en jours."""
        if self.age_limite_jours is None:
            return None
        return self.age_limite_jours - self.age_cible_jours


@dataclass(frozen=True, slots=True)
class Echeance:
    """Un rendez-vous vaccinal calculé."""

    code_vaccin: str
    libelle: str
    rang: int
    date_ouverture: date
    date_cible: date
    date_limite: date | None
    statut: Statut
    date_administration: date | None = None

    @property
    def cle(self) -> CleDose:
        return (self.code_vaccin, self.rang)

    def retard_en_jours(self, aujourdhui: date) -> int:
        """Nombre de jours écoulés depuis la date limite. Zéro si pas en retard."""
        if self.date_limite is None or aujourdhui <= self.date_limite:
            return 0
        return (aujourdhui - self.date_limite).days


def _series(regles: Sequence[RegleVaccinale]) -> dict[str, list[RegleVaccinale]]:
    """Regroupe les règles par vaccin, chaque série triée par rang croissant."""
    groupes: dict[str, list[RegleVaccinale]] = {}
    for regle in regles:
        groupes.setdefault(regle.code_vaccin, []).append(regle)
    for serie in groupes.values():
        serie.sort(key=lambda r: r.rang)
    return groupes


def _statut(
    cle: CleDose,
    date_cible: date,
    date_limite: date | None,
    doses: Mapping[CleDose, date],
    annulees: frozenset[CleDose],
    aujourdhui: date,
) -> Statut:
    if cle in annulees:
        return Statut.ANNULEE
    if cle in doses:
        return Statut.ADMINISTREE
    if aujourdhui < date_cible:
        return Statut.A_VENIR
    if date_limite is None or aujourdhui <= date_limite:
        return Statut.DUE
    return Statut.EN_RETARD


def generer_calendrier(
    *,
    date_reference: date,
    regles: Sequence[RegleVaccinale],
    doses: Mapping[CleDose, date] | None = None,
    annulees: Iterable[CleDose] = (),
    aujourdhui: date,
) -> list[Echeance]:
    """Construit le calendrier complet d'un bénéficiaire.

    `date_reference` est la naissance pour un enfant, le premier contact
    prénatal pour une mère. `doses` associe chaque dose réellement
    administrée à sa date.

    RG-04 : lorsqu'une dose est administrée à une date autre que prévue, les
    doses suivantes de la même série sont recalculées à partir de cette date
    réelle, en respectant l'intervalle minimal.

    RG-03 : les doses déjà reçues restent acquises. Un retard ne réinitialise
    jamais la série.
    """
    doses = dict(doses or {})
    annulees_gelees = frozenset(annulees)
    calendrier: list[Echeance] = []

    for serie in _series(regles).values():
        # Date de référence pour l'intervalle : dose précédente réelle si elle
        # existe, sinon date cible planifiée de la dose précédente.
        ancrage_precedent: date | None = None

        for regle in serie:
            ouverture = date_reference + timedelta(days=regle.age_min_jours)
            cible = date_reference + timedelta(days=regle.age_cible_jours)

            if ancrage_precedent is not None and regle.intervalle_min_jours is not None:
                plancher = ancrage_precedent + timedelta(days=regle.intervalle_min_jours)
                ouverture = max(ouverture, plancher)
                cible = max(cible, plancher)

            # La marge de rattrapage suit la date cible recalculée : décaler une
            # dose ne doit pas amputer la fenêtre de rattrapage prévue.
            limite = (
                cible + timedelta(days=regle.tolerance_jours)
                if regle.tolerance_jours is not None
                else None
            )

            cle: CleDose = (regle.code_vaccin, regle.rang)
            calendrier.append(
                Echeance(
                    code_vaccin=regle.code_vaccin,
                    libelle=regle.libelle,
                    rang=regle.rang,
                    date_ouverture=ouverture,
                    date_cible=cible,
                    date_limite=limite,
                    statut=_statut(cle, cible, limite, doses, annulees_gelees, aujourdhui),
                    date_administration=doses.get(cle),
                )
            )

            ancrage_precedent = doses.get(cle, cible)

    calendrier.sort(key=lambda e: (e.date_cible, e.code_vaccin, e.rang))
    return calendrier


def valider_administration(
    *,
    regle: RegleVaccinale,
    date_reference: date,
    date_administration: date,
    date_dose_precedente: date | None = None,
    deja_administree: bool = False,
    aujourdhui: date,
) -> list[Violation]:
    """Vérifie qu'une dose peut être administrée à cette date.

    Retourne la liste des règles enfreintes. Une liste vide vaut acceptation.

    RG-01 : pas d'administration avant l'âge minimal.
    RG-02 : intervalle minimal entre deux doses consécutives.
    """
    violations: list[Violation] = []

    if deja_administree:
        violations.append(Violation.DOSE_DEJA_ADMINISTREE)

    if date_administration > aujourdhui:
        violations.append(Violation.DATE_FUTURE)

    age_jours = (date_administration - date_reference).days
    if age_jours < regle.age_min_jours:
        violations.append(Violation.AGE_MINIMAL_NON_ATTEINT)

    if regle.rang > 1:
        if date_dose_precedente is None:
            violations.append(Violation.DOSE_PRECEDENTE_MANQUANTE)
        elif regle.intervalle_min_jours is not None:
            ecart = (date_administration - date_dose_precedente).days
            if ecart < regle.intervalle_min_jours:
                violations.append(Violation.INTERVALLE_MINIMAL_NON_RESPECTE)

    return violations


JOURS_AVANT_ABANDON = 183  # six mois


def serie_abandonnee(
    *,
    code_vaccin: str,
    calendrier: Sequence[Echeance],
    aujourdhui: date,
    seuil_jours: int = JOURS_AVANT_ABANDON,
) -> bool:
    """RG-06 : série incomplète dont la dernière dose remonte à plus de six mois.

    Une série jamais commencée n'est pas abandonnée : elle n'a pas débuté.
    """
    serie = [e for e in calendrier if e.code_vaccin == code_vaccin]
    if not serie:
        return False

    administrees = [e for e in serie if e.statut is Statut.ADMINISTREE]
    if not administrees:
        return False

    restantes = [e for e in serie if e.statut in {Statut.A_VENIR, Statut.DUE, Statut.EN_RETARD}]
    if not restantes:
        return False

    derniere = max(e.date_administration for e in administrees if e.date_administration)
    return (aujourdhui - derniere).days > seuil_jours
