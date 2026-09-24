"""Produit la vignette affichée dans les messages vocaux WhatsApp.

Elle doit être lisible en miniature dans une conversation : le symbole,
le nom, la signature des rappels. Rien d'autre — une vignette chargée
devient illisible à cette taille.
"""

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from PIL import Image, ImageDraw, ImageFont

BAOBAB = (20, 67, 46)
CUIVRE = (217, 146, 79)
BLANC = (255, 255, 255)

COTE = 720


class Command(BaseCommand):
    help = "Génère la vignette des messages vocaux."

    def handle(self, *args, **options):
        dossier = Path(settings.BASE_DIR) / "apps" / "rappels" / "ressources"
        dossier.mkdir(parents=True, exist_ok=True)
        sortie = dossier / "vignette.png"

        image = Image.new("RGB", (COTE, COTE), BAOBAB)
        dessin = ImageDraw.Draw(image)

        # Le symbole : trois carrés pleins, un quatrième en contour cuivre,
        # comme le logo de l'application.
        cote_carre = 84
        ecart = 21
        origine_x = (COTE - (2 * cote_carre + ecart)) // 2
        origine_y = 190
        rayon = 20

        positions = [
            (origine_x, origine_y),
            (origine_x + cote_carre + ecart, origine_y),
            (origine_x, origine_y + cote_carre + ecart),
        ]
        for x, y in positions:
            dessin.rounded_rectangle(
                [x, y, x + cote_carre, y + cote_carre], radius=rayon, fill=BLANC
            )

        x = origine_x + cote_carre + ecart
        y = origine_y + cote_carre + ecart
        dessin.rounded_rectangle(
            [x + 6, y + 6, x + cote_carre - 6, y + cote_carre - 6],
            radius=rayon - 5,
            outline=CUIVRE,
            width=13,
        )

        titre = self._police(88)
        signature = self._police(40)

        self._centrer(dessin, "SUVAC", 480, titre, BLANC)
        self._centrer(dessin, "Kaay Ñakku", 548, signature, CUIVRE)

        image.save(sortie, "PNG", optimize=True)
        self.stdout.write(self.style.SUCCESS(f"Vignette écrite : {sortie}"))

    def _police(self, taille: int):
        """Une police système, avec repli sur la police par défaut.

        Le repli produit un rendu médiocre mais fonctionnel : la vignette
        n'est qu'un support, le message est dans le son.
        """
        for nom in ("arialbd.ttf", "DejaVuSans-Bold.ttf", "arial.ttf"):
            try:
                return ImageFont.truetype(nom, taille)
            except OSError:
                continue
        return ImageFont.load_default()

    def _centrer(self, dessin, texte, y, police, couleur):
        gauche, haut, droite, bas = dessin.textbbox((0, 0), texte, font=police)
        dessin.text(
            ((COTE - (droite - gauche)) // 2, y - (bas - haut) // 2),
            texte,
            font=police,
            fill=couleur,
        )
