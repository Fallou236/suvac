"""Tests de la décomposition des messages en segments.

L'assemblage lui-même dépend de ffmpeg et des fichiers audio ; ce qui se
teste ici, c'est la logique : quels segments, dans quel ordre, et pourquoi.
"""

from datetime import date

import pytest
from django.core.management import call_command

from apps.beneficiaires.models import Enfant, Grossesse, Mere, Sexe
from apps.rappels.audio import (
    CODES_VACCINS,
    segments_du_message,
    segments_pour_date,
    segments_pour_poste,
)
from apps.rappels.models import TypeRappel
from apps.suivi.models import Echeance

pytestmark = pytest.mark.django_db

AUJOURDHUI = date(2026, 6, 15)


@pytest.fixture
def schema():
    call_command("charger_schema_pev", verbosity=0)


@pytest.fixture
def enfant(schema, poste):
    mere = Mere.objects.create(prenom="Awa", nom="Ndiaye", poste=poste)
    return Enfant.objects.create(
        mere=mere,
        prenom="Moussa",
        date_naissance=date(2025, 10, 8),
        sexe=Sexe.MASCULIN,
        poste=poste,
    )


def echeance_de(enfant, code, rang=1):
    return Echeance.objects.get(enfant=enfant, vaccin__code=code, rang=rang)


# --- Les briques -------------------------------------------------------------


def test_une_date_se_dit_en_deux_segments():
    assert segments_pour_date(date(2026, 10, 12)) == ["nombre_12", "mois_10"]


def test_le_poste_perd_son_prefixe_administratif():
    """Le message dit déjà « postu wérgi-yaram » : répéter serait absurde."""
    assert segments_pour_poste("Poste de Santé de Ndondol") == ["poste_ndondol"]


def test_les_accents_sont_normalises_dans_le_nom_de_fichier():
    assert segments_pour_poste("Poste de Santé de Thiénaba") == ["poste_thienaba"]


def test_chaque_vaccin_du_schema_a_son_segment(schema):
    """Un vaccin sans segment audio produirait un message amputé."""
    from apps.vaccination.models import Vaccin

    codes = set(Vaccin.objects.filter(actif=True).values_list("code", flat=True))
    assert codes <= set(CODES_VACCINS)


# --- Désignation du bénéficiaire --------------------------------------------


def test_un_enfant_unique_se_dit_votre_enfant(enfant, poste):
    segments = segments_du_message(
        [echeance_de(enfant, "BCG")],
        TypeRappel.JOUR_MEME,
        poste.nom,
        pour_elle_meme=False,
        plusieurs_enfants=False,
    )

    assert "beneficiaire_votre_enfant" in segments
    assert "liaison_ne_en" not in segments


def test_avec_plusieurs_enfants_le_mois_de_naissance_leve_l_ambiguite(enfant, poste):
    """Sans cette précision, une mère de deux enfants entendrait « votre
    enfant doit recevoir… » sans savoir lequel."""
    segments = segments_du_message(
        [echeance_de(enfant, "BCG")],
        TypeRappel.JOUR_MEME,
        poste.nom,
        pour_elle_meme=False,
        plusieurs_enfants=True,
    )

    position = segments.index("beneficiaire_votre_enfant")
    assert segments[position + 1] == "liaison_ne_en"
    # L'enfant est né en octobre 2025.
    assert segments[position + 2] == "mois_10"


def test_un_rappel_de_grossesse_s_adresse_a_la_mere(schema, poste):
    mere = Mere.objects.create(prenom="Awa", nom="Ndiaye", poste=poste)
    grossesse = Grossesse.objects.create(mere=mere, rang=1, date_reference=AUJOURDHUI)
    echeance = Echeance.objects.filter(grossesse=grossesse).first()

    segments = segments_du_message([echeance], TypeRappel.JOUR_MEME, poste.nom, pour_elle_meme=True)

    assert "mere_doit_recevoir" in segments
    assert "beneficiaire_votre_enfant" not in segments


# --- Structure des messages --------------------------------------------------


def test_un_message_commence_par_la_salutation(enfant, poste):
    segments = segments_du_message(
        [echeance_de(enfant, "BCG")], TypeRappel.JOUR_MEME, poste.nom, False
    )
    assert segments[0] == "amorce_salutation"


def test_un_rappel_du_jour_dit_aujourd_hui_et_non_une_date(enfant, poste):
    segments = segments_du_message(
        [echeance_de(enfant, "BCG")], TypeRappel.JOUR_MEME, poste.nom, False
    )

    assert "liaison_aujourdhui" in segments
    assert not any(s.startswith("nombre_") for s in segments)


def test_un_preavis_annonce_la_date(enfant, poste):
    segments = segments_du_message(
        [echeance_de(enfant, "BCG")], TypeRappel.AVANT_ECHEANCE, poste.nom, False
    )

    assert "liaison_le" in segments
    assert any(s.startswith("nombre_") for s in segments)


def test_une_relance_finit_par_l_invitation_a_venir_vite(enfant, poste):
    segments = segments_du_message(
        [echeance_de(enfant, "BCG")], TypeRappel.RELANCE, poste.nom, False
    )
    assert segments[-1] == "liaison_venez_vite"


def test_une_relance_cite_le_retard_le_plus_ancien(enfant, poste):
    """C'est celui qui presse : la fenêtre de rattrapage s'y referme en
    premier."""
    echeances = [
        echeance_de(enfant, "PENTA", 2),
        echeance_de(enfant, "BCG"),
    ]

    segments = segments_du_message(echeances, TypeRappel.RELANCE, poste.nom, False)

    # BCG est dû à la naissance, en octobre 2025.
    assert "mois_10" in segments


# --- Énumération des vaccins -------------------------------------------------


def test_un_vaccin_n_est_jamais_repete(enfant, poste):
    """Trois doses de pentavalent se disent « le pentavalent », une fois."""
    echeances = [echeance_de(enfant, "PENTA", rang) for rang in (1, 2, 3)]

    segments = segments_du_message(echeances, TypeRappel.RELANCE, poste.nom, False)

    assert segments.count("vaccin_penta") == 1


def test_au_dela_de_trois_vaccins_le_message_resume(enfant, poste):
    """Un message vocal qui énumère dix vaccins dure une minute et personne
    ne l'écoute jusqu'au bout."""
    echeances = [echeance_de(enfant, code) for code in ("BCG", "VPO", "PENTA", "PNEUMO", "ROTA")]

    segments = segments_du_message(echeances, TypeRappel.RELANCE, poste.nom, False)

    assert "liaison_et_autres" in segments
    assert "liaison_vaccins_restants" in segments
    # Deux vaccins nommés, trois résumés.
    assert "nombre_03" in segments


def test_trois_vaccins_sont_encore_enumeres(enfant, poste):
    echeances = [echeance_de(enfant, code) for code in ("BCG", "VPO", "PENTA")]

    segments = segments_du_message(echeances, TypeRappel.RELANCE, poste.nom, False)

    assert "liaison_et_autres" not in segments
    assert {"vaccin_bcg", "vaccin_vpo", "vaccin_penta"} <= set(segments)
