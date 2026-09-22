"""Descriptions des vaccins à l'intention des mères.

Ces textes sont lus par des femmes dont une partie n'a pas été scolarisée
longtemps. Ils répondent à trois questions dans cet ordre : contre quoi ce
vaccin protège, pourquoi c'est grave sans lui, et ce qu'il faut savoir du
geste lui-même.

AVERTISSEMENT — ces textes sont rédigés à partir de connaissances générales
en santé publique. Ils doivent être relus par un professionnel de santé avant
toute mise en service réelle, au même titre que le schéma vaccinal (R-08).
"""

from django.core.management.base import BaseCommand

from apps.vaccination.models import Vaccin

DESCRIPTIONS = {
    "BCG": {
        "protege": "la tuberculose",
        "texte": (
            "Le BCG protège votre enfant contre les formes graves de la "
            "tuberculose, une maladie des poumons qui peut aussi atteindre "
            "le cerveau chez le tout-petit.\n\n"
            "Il se donne dès la naissance, en une seule fois. Une petite "
            "boule apparaît au bras dans les semaines qui suivent, puis une "
            "cicatrice : c'est normal, cela montre que le vaccin a pris."
        ),
    },
    "VPO": {
        "protege": "la poliomyélite",
        "texte": (
            "La polio est une maladie qui peut paralyser les jambes d'un "
            "enfant pour toute sa vie. Il n'existe aucun traitement : seul "
            "le vaccin protège.\n\n"
            "Ce vaccin se donne en gouttes dans la bouche. Il faut plusieurs "
            "doses pour que la protection soit complète."
        ),
    },
    "VPI": {
        "protege": "la poliomyélite",
        "texte": (
            "Ce vaccin complète les gouttes contre la polio. Il se donne en "
            "piqûre et renforce la protection de votre enfant.\n\n"
            "Les deux formes sont nécessaires : elles ne protègent pas "
            "exactement de la même façon."
        ),
    },
    "PENTA": {
        "protege": "cinq maladies à la fois",
        "texte": (
            "Le pentavalent protège contre cinq maladies en une seule "
            "piqûre : la diphtérie, le tétanos, la coqueluche, l'hépatite B "
            "et une infection grave appelée Hib.\n\n"
            "Il faut trois doses, espacées d'au moins quatre semaines. Un "
            "enfant qui n'en reçoit qu'une ou deux n'est pas protégé.\n\n"
            "Une fièvre légère peut apparaître le soir même. Elle passe en "
            "un ou deux jours."
        ),
    },
    "PNEUMO": {
        "protege": "les pneumonies graves",
        "texte": (
            "Le pneumocoque est une bactérie qui provoque des pneumonies et "
            "des méningites. C'est l'une des premières causes de décès chez "
            "les enfants de moins de cinq ans.\n\n"
            "Trois doses sont nécessaires. Elles se donnent en même temps "
            "que le pentavalent."
        ),
    },
    "ROTA": {
        "protege": "les diarrhées sévères",
        "texte": (
            "Le rotavirus provoque des diarrhées très fortes qui "
            "déshydratent rapidement le nourrisson. C'est une cause "
            "fréquente d'hospitalisation.\n\n"
            "Ce vaccin se donne en gouttes dans la bouche. Attention : il "
            "doit être donné tôt. Passé un certain âge, il ne peut plus être "
            "administré."
        ),
    },
    "RR": {
        "protege": "la rougeole et la rubéole",
        "texte": (
            "La rougeole est très contagieuse. Elle peut entraîner une "
            "pneumonie, une atteinte du cerveau, ou rendre aveugle.\n\n"
            "La rubéole est bénigne chez l'enfant, mais grave pour une femme "
            "enceinte : elle peut provoquer de lourdes malformations chez le "
            "bébé à naître.\n\n"
            "Deux doses sont nécessaires, la première vers neuf mois."
        ),
    },
    "VAA": {
        "protege": "la fièvre jaune",
        "texte": (
            "La fièvre jaune se transmet par les moustiques. Elle peut "
            "entraîner des hémorragies et atteindre le foie.\n\n"
            "Une seule dose suffit à protéger votre enfant pour longtemps."
        ),
    },
    "TD": {
        "protege": "le tétanos, pour vous et votre bébé",
        "texte": (
            "Ce vaccin vous protège du tétanos, et il protège aussi votre "
            "bébé pendant ses premières semaines de vie.\n\n"
            "Le tétanos du nouveau-né survient quand la plaie du cordon "
            "s'infecte. Il est presque toujours mortel. Quand vous êtes "
            "vaccinée, votre corps transmet la protection à votre enfant "
            "avant sa naissance.\n\n"
            "Cinq doses au total assurent une protection durable, valable "
            "aussi pour vos grossesses suivantes."
        ),
    },
}


class Command(BaseCommand):
    help = "Charge les descriptions des vaccins destinées aux bénéficiaires."

    def handle(self, *args, **options):
        misAJour = 0

        for code, contenu in DESCRIPTIONS.items():
            vaccin = Vaccin.objects.filter(code=code).first()
            if vaccin is None:
                self.stdout.write(self.style.WARNING(f"Vaccin {code} absent du référentiel."))
                continue

            vaccin.protege_contre = contenu["protege"]
            vaccin.description = contenu["texte"]
            vaccin.save(update_fields=["protege_contre", "description", "modifie_le"])
            misAJour += 1

        self.stdout.write(f"Descriptions chargées : {misAJour}.")
        self.stdout.write(
            self.style.WARNING(
                "Textes rédigés à partir de connaissances générales. À faire "
                "relire par un professionnel de santé avant usage réel."
            )
        )
