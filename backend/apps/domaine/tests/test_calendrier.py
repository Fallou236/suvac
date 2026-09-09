"""Les neuf situations obligatoires de la section 11.3 du cahier des charges."""

from datetime import date

import pytest

from apps.domaine.calendrier import (
    Cible,
    Echeance,
    RegleVaccinale,
    Statut,
    Violation,
    generer_calendrier,
    serie_abandonnee,
    valider_administration,
)

NAISSANCE = date(2026, 1, 1)


# --- Schéma de test, volontairement réduit ---------------------------------

BCG = RegleVaccinale(
    code_vaccin="BCG", libelle="BCG", rang=1,
    age_min_jours=0, age_cible_jours=0, age_limite_jours=30,
)

PENTA = [
    RegleVaccinale(
        code_vaccin="PENTA", libelle="Pentavalent", rang=rang,
        age_min_jours=age_min, age_cible_jours=age_cible,
        age_limite_jours=age_cible + 28, intervalle_min_jours=intervalle,
    )
    for rang, age_min, age_cible, intervalle in [
        (1, 42, 42, None),
        (2, 70, 70, 28),
        (3, 98, 98, 28),
    ]
]

SCHEMA = [BCG, *PENTA]


def calendrier(doses=None, annulees=(), aujourdhui=NAISSANCE):
    return generer_calendrier(
        date_reference=NAISSANCE, regles=SCHEMA, doses=doses,
        annulees=annulees, aujourdhui=aujourdhui,
    )


def par_cle(calendrier_: list[Echeance]) -> dict[tuple[str, int], Echeance]:
    return {e.cle: e for e in calendrier_}


# --- Cas 1 : parcours nominal ----------------------------------------------

def test_enfant_vaccine_dans_les_delais():
    doses = {
        ("BCG", 1): NAISSANCE,
        ("PENTA", 1): date(2026, 2, 12),
        ("PENTA", 2): date(2026, 3, 12),
        ("PENTA", 3): date(2026, 4, 9),
    }
    resultat = par_cle(calendrier(doses, aujourdhui=date(2026, 5, 1)))

    assert all(e.statut is Statut.ADMINISTREE for e in resultat.values())
    assert resultat[("PENTA", 3)].date_administration == date(2026, 4, 9)


def test_calendrier_vierge_est_planifie_aux_dates_de_reference():
    resultat = par_cle(calendrier())

    assert resultat[("BCG", 1)].date_cible == NAISSANCE
    assert resultat[("PENTA", 1)].date_cible == date(2026, 2, 12)
    assert resultat[("PENTA", 2)].date_cible == date(2026, 3, 12)
    assert resultat[("PENTA", 3)].date_cible == date(2026, 4, 9)


# --- Cas 2 : dose trop précoce ---------------------------------------------

def test_dose_avant_age_minimal_est_refusee():
    violations = valider_administration(
        regle=PENTA[0], date_reference=NAISSANCE,
        date_administration=date(2026, 1, 20),  # 19 jours, minimum 42
        aujourdhui=date(2026, 1, 20),
    )
    assert Violation.AGE_MINIMAL_NON_ATTEINT in violations


def test_dose_sous_intervalle_minimal_est_refusee():
    violations = valider_administration(
        regle=PENTA[1], date_reference=NAISSANCE,
        date_administration=date(2026, 2, 26),  # 14 jours après Penta-1
        date_dose_precedente=date(2026, 2, 12),
        aujourdhui=date(2026, 2, 26),
    )
    assert Violation.INTERVALLE_MINIMAL_NON_RESPECTE in violations


def test_administration_conforme_ne_leve_aucune_violation():
    violations = valider_administration(
        regle=PENTA[1], date_reference=NAISSANCE,
        date_administration=date(2026, 3, 12),
        date_dose_precedente=date(2026, 2, 12),
        aujourdhui=date(2026, 3, 12),
    )
    assert violations == []


def test_date_dans_le_futur_est_refusee():
    violations = valider_administration(
        regle=BCG, date_reference=NAISSANCE,
        date_administration=date(2026, 6, 1),
        aujourdhui=date(2026, 5, 1),
    )
    assert Violation.DATE_FUTURE in violations


# --- Cas 3 : retard et re-planification (RG-04) ----------------------------

def test_dose_en_retard_decale_les_suivantes():
    # Penta-2 rattrapée le 2 avril au lieu du 12 mars, soit 21 jours de retard.
    doses = {("PENTA", 1): date(2026, 2, 12), ("PENTA", 2): date(2026, 4, 2)}
    resultat = par_cle(calendrier(doses, aujourdhui=date(2026, 4, 2)))

    penta3 = resultat[("PENTA", 3)]
    assert penta3.date_cible == date(2026, 4, 30)  # 2 avril + 28 jours
    assert penta3.date_ouverture == date(2026, 4, 30)


def test_la_fenetre_de_rattrapage_suit_la_cible_recalculee():
    doses = {("PENTA", 1): date(2026, 2, 12), ("PENTA", 2): date(2026, 4, 2)}
    penta3 = par_cle(calendrier(doses, aujourdhui=date(2026, 4, 2)))[("PENTA", 3)]

    assert penta3.date_limite == date(2026, 5, 28)  # cible + 28 jours de marge


# --- Cas 4 : dose omise puis rattrapée (RG-03) -----------------------------

def test_le_retard_ne_reinitialise_pas_la_serie():
    doses = {
        ("PENTA", 1): date(2026, 2, 12),
        ("PENTA", 2): date(2026, 9, 1),  # très en retard
    }
    resultat = par_cle(calendrier(doses, aujourdhui=date(2026, 9, 1)))

    assert resultat[("PENTA", 1)].statut is Statut.ADMINISTREE
    assert resultat[("PENTA", 2)].statut is Statut.ADMINISTREE
    assert resultat[("PENTA", 3)].statut is Statut.A_VENIR
    assert resultat[("PENTA", 3)].date_cible == date(2026, 9, 29)


# --- Cas 5 : abandon (RG-06) -----------------------------------------------

def test_serie_incomplete_depuis_plus_de_six_mois_est_abandonnee():
    doses = {("PENTA", 1): date(2026, 2, 12)}
    resultat = calendrier(doses, aujourdhui=date(2026, 9, 30))

    assert serie_abandonnee(code_vaccin="PENTA", calendrier=resultat,
                            aujourdhui=date(2026, 9, 30))


def test_serie_recente_n_est_pas_abandonnee():
    doses = {("PENTA", 1): date(2026, 2, 12)}
    resultat = calendrier(doses, aujourdhui=date(2026, 5, 1))

    assert not serie_abandonnee(code_vaccin="PENTA", calendrier=resultat,
                                aujourdhui=date(2026, 5, 1))


def test_serie_jamais_commencee_n_est_pas_abandonnee():
    resultat = calendrier(aujourdhui=date(2027, 6, 1))

    assert not serie_abandonnee(code_vaccin="PENTA", calendrier=resultat,
                                aujourdhui=date(2027, 6, 1))


def test_serie_complete_n_est_pas_abandonnee():
    doses = {
        ("PENTA", 1): date(2026, 2, 12),
        ("PENTA", 2): date(2026, 3, 12),
        ("PENTA", 3): date(2026, 4, 9),
    }
    resultat = calendrier(doses, aujourdhui=date(2027, 6, 1))

    assert not serie_abandonnee(code_vaccin="PENTA", calendrier=resultat,
                                aujourdhui=date(2027, 6, 1))


# --- Statuts ---------------------------------------------------------------

def test_statuts_selon_la_date_du_jour():
    veille = par_cle(calendrier(aujourdhui=date(2026, 2, 11)))
    assert veille[("PENTA", 1)].statut is Statut.A_VENIR

    jour = par_cle(calendrier(aujourdhui=date(2026, 2, 12)))
    assert jour[("PENTA", 1)].statut is Statut.DUE

    dans_la_marge = par_cle(calendrier(aujourdhui=date(2026, 3, 12)))
    assert dans_la_marge[("PENTA", 1)].statut is Statut.DUE

    apres = par_cle(calendrier(aujourdhui=date(2026, 3, 13)))
    assert apres[("PENTA", 1)].statut is Statut.EN_RETARD


def test_echeance_annulee_ne_devient_jamais_en_retard():
    resultat = par_cle(calendrier(annulees=[("PENTA", 1)], aujourdhui=date(2027, 1, 1)))
    assert resultat[("PENTA", 1)].statut is Statut.ANNULEE


def test_retard_en_jours():
    resultat = par_cle(calendrier(aujourdhui=date(2026, 3, 22)))
    assert resultat[("PENTA", 1)].retard_en_jours(date(2026, 3, 22)) == 10
    assert resultat[("PENTA", 3)].retard_en_jours(date(2026, 3, 22)) == 0


# --- Cas 9 : bascules de calendrier ----------------------------------------

def test_annee_bissextile():
    regle = RegleVaccinale(
        code_vaccin="TEST", libelle="Test", rang=1, age_min_jours=0, age_cible_jours=60
    )
    resultat = generer_calendrier(
        date_reference=date(2028, 1, 1), regles=[regle], aujourdhui=date(2028, 1, 1)
    )
    # 2028 est bissextile : février compte 29 jours.
    assert resultat[0].date_cible == date(2028, 3, 1)


def test_passage_d_annee():
    regle = RegleVaccinale(
        code_vaccin="TEST", libelle="Test", rang=1, age_min_jours=0, age_cible_jours=45
    )
    resultat = generer_calendrier(
        date_reference=date(2026, 12, 1), regles=[regle], aujourdhui=date(2026, 12, 1)
    )
    assert resultat[0].date_cible == date(2027, 1, 15)


# --- Cohérence du schéma ---------------------------------------------------

def test_schema_incoherent_est_rejete_a_la_construction():
    with pytest.raises(ValueError):
        RegleVaccinale(
            code_vaccin="X", libelle="X", rang=1, age_min_jours=60, age_cible_jours=30
        )

    with pytest.raises(ValueError):
        RegleVaccinale(
            code_vaccin="X", libelle="X", rang=0, age_min_jours=0, age_cible_jours=0
        )


def test_cible_mere_est_acceptee():
    regle = RegleVaccinale(
        code_vaccin="TD", libelle="Antitétanique", rang=1,
        age_min_jours=0, age_cible_jours=0, cible=Cible.MERE,
    )
    assert regle.cible is Cible.MERE