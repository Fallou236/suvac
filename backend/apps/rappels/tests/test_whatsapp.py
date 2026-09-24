"""Tests du canal WhatsApp.

Aucun appel réseau : les réponses de Meta sont simulées. Ce qu'on vérifie
ici, c'est la forme des requêtes envoyées et surtout l'interprétation des
refus — distinguer ce qui peut réussir plus tard de ce qui est perdu.
"""

from unittest.mock import MagicMock, patch

import pytest

from apps.rappels.canaux.base import MessageSortant
from apps.rappels.canaux.whatsapp import CanalWhatsApp, _normaliser, _tronquer


@pytest.fixture
def canal(settings):
    settings.WHATSAPP_NUMERO_ID = "1377731125416606"
    settings.WHATSAPP_JETON = "jeton-de-test"
    settings.WHATSAPP_MODELE_RAPPEL = "rappel_vaccinal"
    settings.WHATSAPP_LANGUE_MODELE = "fr"
    return CanalWhatsApp()


def reponse(code: int, corps: dict) -> MagicMock:
    fausse = MagicMock()
    fausse.status_code = code
    fausse.json.return_value = corps
    fausse.text = str(corps)
    return fausse


# --- Normalisation des numéros ----------------------------------------------


def test_un_numero_perd_son_plus_et_ses_espaces():
    assert _normaliser("+221 77 123 45 67") == "221771234567"


def test_un_numero_sans_indicatif_recoit_celui_du_senegal():
    """Les agents saisissent souvent le numéro tel qu'il se dit."""
    assert _normaliser("771234567") == "221771234567"


def test_un_numero_vide_est_rejete():
    assert _normaliser("") == ""
    assert _normaliser("abc") == ""


def test_une_variable_de_modele_ne_contient_pas_de_saut_de_ligne():
    """Meta refuse un paramètre multiligne."""
    assert "\n" not in _tronquer("Sokhna\nBa")


def test_une_variable_vide_devient_un_tiret():
    """Un paramètre vide fait échouer l'envoi côté Meta."""
    assert _tronquer("") == "—"


# --- Disponibilité -----------------------------------------------------------


def test_le_canal_sans_jeton_est_indisponible(settings):
    settings.WHATSAPP_NUMERO_ID = ""
    settings.WHATSAPP_JETON = ""

    assert not CanalWhatsApp().disponible()


def test_un_canal_non_configure_echoue_definitivement(settings):
    """Réessayer ne configurera pas le canal tout seul."""
    settings.WHATSAPP_NUMERO_ID = ""
    settings.WHATSAPP_JETON = ""

    resultat = CanalWhatsApp().envoyer(MessageSortant(destinataire="221771234567", texte="test"))

    assert not resultat.reussi
    assert resultat.definitif


def test_un_numero_invalide_echoue_definitivement(canal):
    resultat = canal.envoyer(MessageSortant(destinataire="???", texte="test"))

    assert not resultat.reussi
    assert resultat.definitif


# --- Envoi réussi ------------------------------------------------------------


def test_un_envoi_reussi_rapporte_l_identifiant_du_message(canal):
    with patch("apps.rappels.canaux.whatsapp.requests.post") as poster:
        poster.return_value = reponse(200, {"messages": [{"id": "wamid.ABC"}]})

        resultat = canal.envoyer(MessageSortant(destinataire="221771234567", texte="Bonjour"))

    assert resultat.reussi
    assert resultat.identifiant_externe == "wamid.ABC"


def test_un_message_sans_video_part_en_texte_libre(canal):
    with patch("apps.rappels.canaux.whatsapp.requests.post") as poster:
        poster.return_value = reponse(200, {"messages": [{"id": "wamid.ABC"}]})

        canal.envoyer(MessageSortant(destinataire="221771234567", texte="Bonjour"))

    corps = poster.call_args.kwargs["json"]
    assert corps["type"] == "text"


def test_une_video_est_televersee_avant_l_envoi(canal, tmp_path):
    """Meta veut un identifiant de média, pas un fichier dans le message."""
    video = tmp_path / "message.mp4"
    video.write_bytes(b"contenu")

    with patch("apps.rappels.canaux.whatsapp.requests.post") as poster:
        poster.side_effect = [
            reponse(200, {"id": "media-123"}),
            reponse(200, {"messages": [{"id": "wamid.ABC"}]}),
        ]

        resultat = canal.envoyer(
            MessageSortant(
                destinataire="221771234567",
                texte="Rappel",
                chemin_audio=str(video),
                variables=("Sokhna Ba",),
            )
        )

    assert resultat.reussi
    assert poster.call_count == 2

    corps = poster.call_args.kwargs["json"]
    assert corps["type"] == "template"
    entete = corps["template"]["components"][0]
    assert entete["parameters"][0]["video"]["id"] == "media-123"


def test_le_nom_du_beneficiaire_est_passe_au_modele(canal, tmp_path):
    video = tmp_path / "message.mp4"
    video.write_bytes(b"contenu")

    with patch("apps.rappels.canaux.whatsapp.requests.post") as poster:
        poster.side_effect = [
            reponse(200, {"id": "media-123"}),
            reponse(200, {"messages": [{"id": "wamid.ABC"}]}),
        ]

        canal.envoyer(
            MessageSortant(
                destinataire="221771234567",
                texte="Rappel",
                chemin_audio=str(video),
                variables=("Sokhna Ba",),
            )
        )

    corps = poster.call_args.kwargs["json"]
    corps_modele = corps["template"]["components"][1]
    assert corps_modele["parameters"][0]["text"] == "Sokhna Ba"


def test_une_video_absente_echoue_definitivement(canal):
    resultat = canal.envoyer(
        MessageSortant(
            destinataire="221771234567",
            texte="Rappel",
            chemin_audio="/introuvable/message.mp4",
        )
    )

    assert not resultat.reussi
    assert resultat.definitif


# --- Interprétation des refus ------------------------------------------------


def test_un_modele_absent_est_un_echec_definitif(canal):
    """Réessayer n'approuvera pas le modèle."""
    with patch("apps.rappels.canaux.whatsapp.requests.post") as poster:
        poster.return_value = reponse(
            404,
            {"error": {"code": 132001, "message": "Template name does not exist"}},
        )

        resultat = canal.envoyer(MessageSortant(destinataire="221771234567", texte="test"))

    assert not resultat.reussi
    assert resultat.definitif
    assert "132001" in resultat.erreur


def test_un_destinataire_injoignable_est_definitif(canal):
    with patch("apps.rappels.canaux.whatsapp.requests.post") as poster:
        poster.return_value = reponse(
            400, {"error": {"code": 131026, "message": "Receiver incapable"}}
        )

        resultat = canal.envoyer(MessageSortant(destinataire="221771234567", texte="test"))

    assert resultat.definitif


def test_une_panne_serveur_peut_etre_reessayee(canal):
    """Meta sera peut-être disponible dans une heure."""
    with patch("apps.rappels.canaux.whatsapp.requests.post") as poster:
        poster.return_value = reponse(500, {"error": {"code": 1, "message": "Internal error"}})

        resultat = canal.envoyer(MessageSortant(destinataire="221771234567", texte="test"))

    assert not resultat.reussi
    assert not resultat.definitif


def test_un_delai_depasse_peut_etre_reessaye(canal):
    import requests

    with patch("apps.rappels.canaux.whatsapp.requests.post") as poster:
        poster.side_effect = requests.Timeout()

        resultat = canal.envoyer(MessageSortant(destinataire="221771234567", texte="test"))

    assert not resultat.reussi
    assert not resultat.definitif


def test_le_canal_ne_leve_jamais(canal):
    """Un canal indisponible est un cas courant, pas une erreur de
    programmation : l'appelant doit pouvoir décider quoi faire."""
    import requests

    with patch("apps.rappels.canaux.whatsapp.requests.post") as poster:
        poster.side_effect = requests.ConnectionError("réseau coupé")

        resultat = canal.envoyer(MessageSortant(destinataire="221771234567", texte="test"))

    assert not resultat.reussi
