"""Composition du texte des rappels.

Les formulations wolof ont été validées par un locuteur natif ; elles sont
reproduites telles quelles. Voir `docs/libelles-wolof.md`.

Le ton importe autant que le contenu : une relance après retard dit qu'il
est encore temps plutôt que de rappeler la faute. Une mère culpabilisée ne
revient pas.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from apps.suivi.models import Echeance

from .models import TypeRappel

PREFIXES_POSTE = (
    "Poste de Santé de ",
    "Poste de Sante de ",
    "Poste de Santé ",
    "Poste de ",
)

MOIS_FR = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
]

MOIS_WO = [
    "sanwiye",
    "fewriye",
    "mars",
    "awril",
    "me",
    "suwe",
    "sulet",
    "ut",
    "sattumbar",
    "oktoobar",
    "nowambar",
    "desambar",
]


def formater_date(jour: date, langue: str) -> str:
    mois = MOIS_WO if langue == "wo" else MOIS_FR
    return f"{jour.day} {mois[jour.month - 1]}"


@dataclass(frozen=True, slots=True)
class Message:
    texte: str
    langue: str


def _enumerer_vaccins(echeances: list[Echeance], langue: str) -> str:
    """Énumère les vaccins sans répétition et sans noyer le message.

    Un enfant qui a trois doses de pentavalent en retard doit entendre
    « le pentavalent », pas trois fois le même mot. Et au-delà de trois
    vaccins distincts, le détail dessert : la mère retient qu'il y en a
    beaucoup, pas lesquels.
    """
    libelles: list[str] = []
    for echeance in echeances:
        libelle = echeance.vaccin.libelle(langue)
        if libelle not in libelles:
            libelles.append(libelle)

    if len(libelles) <= 3:
        return ", ".join(libelles)

    reste = len(libelles) - 2
    debut = ", ".join(libelles[:2])
    if langue == "wo":
        return f"{debut} ak {reste} ñakk yu des"
    return f"{debut} et {reste} autres vaccins"


def nom_court_poste(nom: str) -> str:
    """Retire le préfixe administratif du nom d'un poste.

    « Poste de Santé de Ndondol » devient « Ndondol » : le message dit déjà
    « postu wérgi-yaram », répéter serait absurde à l'oral.
    """
    for prefixe in PREFIXES_POSTE:
        if nom.startswith(prefixe):
            return nom[len(prefixe) :]
    return nom


def composer(
    echeances: list[Echeance],
    type_rappel: str,
    langue: str,
    nom_beneficiaire: str,
    nom_poste: str,
    pour_elle_meme: bool = False,
) -> Message:
    """Assemble le texte d'un rappel portant sur une ou plusieurs échéances.

    RG-09 : toutes les échéances du jour d'un bénéficiaire tiennent en un
    seul message. Recevoir cinq notifications pour une même visite serait
    perçu comme du harcèlement.
    """
    vaccins = _enumerer_vaccins(echeances, langue)
    # Pour une relance, on cite la plus ancienne : c'est celle qui presse.
    dates = sorted(e.date_cible for e in echeances)
    reference = dates[0] if type_rappel == TypeRappel.RELANCE else dates[-1]
    jour = formater_date(reference, langue)

    poste_court = nom_court_poste(nom_poste)

    if langue == "wo":
        texte = _wolof(type_rappel, nom_beneficiaire, vaccins, jour, poste_court, pour_elle_meme)
    else:
        texte = _francais(type_rappel, nom_beneficiaire, vaccins, jour, poste_court, pour_elle_meme)

    return Message(texte=texte, langue=langue)


def _wolof(
    type_rappel: str,
    nom: str,
    vaccins: str,
    jour: str,
    poste: str,
    pour_elle_meme: bool,
) -> str:
    if pour_elle_meme:
        if type_rappel == TypeRappel.RELANCE:
            return (
                f"Nanga def. Jotoo woon sa ñakku tetanus bi ñu ko waroon a jox {jour}. "
                f"Nanga ñëw ci postu wérgi-yaram bi ci nimu gëna gaawe."
            )
        return (
            f"Nanga def. Danga wara am sa ñakku tetanus ci {jour}. "
            f"Ñëwal ci postu wérgi-yaram bu {poste}."
        )

    if type_rappel == TypeRappel.RELANCE:
        return (
            f"Nanga def. {nom} jotul ñakk {vaccins} bi ñu ko waroon a jox {jour}. "
            f"Nanga ñëw ci postu wérgi-yaram bi ci nimu gëna gaawe."
        )

    if type_rappel == TypeRappel.JOUR_MEME:
        return (
            f"Nanga def. {nom} dafa wara ñakk u {vaccins} tay. "
            f"Ñëwal ci postu wérgi-yaram bu {poste}."
        )

    if type_rappel == TypeRappel.CONFIRMATION:
        return f"{nom} jot na ñakk {vaccins} bi. Randewu bi ci topp : {jour}."

    return (
        f"Nanga def. {nom} dafa wara ñakk u {vaccins} ci {jour}. "
        f"Ñëwal ci postu wérgi-yaram bu {poste}."
    )


def _francais(
    type_rappel: str,
    nom: str,
    vaccins: str,
    jour: str,
    poste: str,
    pour_elle_meme: bool,
) -> str:
    if pour_elle_meme:
        if type_rappel == TypeRappel.RELANCE:
            return (
                f"Bonjour. Vous n'avez pas encore reçu votre vaccin antitétanique, "
                f"prévu le {jour}. Il est encore temps : venez au poste de santé "
                f"dès que possible."
            )
        return (
            f"Bonjour. Vous devez recevoir votre vaccin antitétanique le {jour}. "
            f"Venez au poste de santé de {poste}."
        )

    if type_rappel == TypeRappel.RELANCE:
        return (
            f"Bonjour. {nom} n'a pas encore reçu le vaccin {vaccins}, prévu le "
            f"{jour}. Il est encore temps : venez au poste de santé dès que possible."
        )

    if type_rappel == TypeRappel.JOUR_MEME:
        return (
            f"Bonjour. {nom} doit recevoir le vaccin {vaccins} aujourd'hui. "
            f"Venez au poste de santé de {poste}."
        )

    if type_rappel == TypeRappel.CONFIRMATION:
        return f"{nom} a bien reçu le vaccin {vaccins}. Prochain rendez-vous le {jour}."

    return (
        f"Bonjour. {nom} doit recevoir le vaccin {vaccins} le {jour}. "
        f"Venez au poste de santé de {poste}."
    )
