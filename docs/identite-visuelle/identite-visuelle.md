# SUVAC — identité visuelle

Version 1.0 — Septembre 2026

Ce document accompagne les fichiers graphiques du dossier. Il explique les choix
plutôt que de les décréter : vous devrez les défendre en soutenance.

---

## Le principe directeur

L'application remplace un objet physique : le carnet de vaccination papier, une grille
de cases que l'agent remplit dose après dose. Toute l'identité part de là. Ce n'est pas
une décoration ajoutée après coup, c'est la traduction visuelle de ce que fait le
produit.

Conséquence pratique : **la couleur sert d'abord à lire un statut**, pas à embellir un
écran. L'agent de santé consulte sa file du jour debout, sur un téléphone d'entrée de
gamme, parfois en plein soleil. S'il doit lire le texte pour savoir qui est en retard,
l'interface a échoué.

---

## Le symbole

Une grille de quatre cases : trois pleines, une encore ouverte. C'est le carnet, et
c'est un enfant à quatre doses sur cinq. Le contour cuivre de la quatrième case
signale la prochaine échéance.

Aucune seringue, aucune aiguille. C'est délibéré : l'imagerie de la piqûre alimente la
réticence vaccinale et effraie précisément le public que vous cherchez à rassurer. Vous
communiquez sur un suivi et une protection, pas sur un geste médical.

Le symbole reste lisible à 16 px, ce que j'ai vérifié en le rendant à cette taille. Il
fonctionne aussi en aplat monochrome (`logo-suvac-mark-mono.svg`, qui hérite de la
couleur du texte environnant via `currentColor`).

### Fichiers

| Fichier | Usage |
|---|---|
| `logo-suvac.svg` | Verrouillage complet : symbole et nom. En-tête, documents, page de connexion |
| `logo-suvac-mark.svg` | Symbole seul, en couleur |
| `logo-suvac-mark-mono.svg` | Symbole seul, monochrome, prend la couleur du contexte |
| `icone-app.svg` + `icon-192.png`, `icon-512.png` | Icône de la PWA installée sur le téléphone |
| `apple-touch-icon-180.png` | Écran d'accueil iOS |
| `favicon.ico`, `favicon-32.png`, `favicon-16.png` | Onglet du navigateur |
| `couverture-whatsapp.svg` / `.png` | Image fixe des vidéos de rappel envoyées aux mères |

> Le fichier `logo-suvac.svg` contient le mot SUVAC sous forme de texte, avec une pile de
> polices de repli. Une fois Public Sans installée, convertissez ce texte en tracés
> (Inkscape : *Chemin → Objet en chemin*) pour que le logo s'affiche identiquement partout.

---

## La palette

Vert baobab et cuivre. Le vert profond du feuillage de saison des pluies, le cuivre
patiné des ustensiles. Un vert sombre en couleur principale est rare sur un outil de
gestion, et c'est précisément ce qui rend l'interface reconnaissable au premier coup
d'œil.

### Marque

| Nom | Hex | Contraste sur blanc | Rôle |
|---|---|---|---|
| Baobab | `#14432E` | 11,2:1 | Navigation, titres, texte, doses administrées |
| Baobab foncé | `#0D2E20` | 14,7:1 | État survolé |
| Baobab clair | `#E4EDE8` | — | Fond d'un élément principal |
| Cuivre | `#8E4A1E` | 6,7:1 | Accent unique : boutons, liens, focus, anneau « due » |
| Cuivre clair | `#F5EBE2` | — | Fond d'un élément accentué |
| Cuivre lumière | `#D9924F` | — | **Uniquement sur fond baobab** : icône, couverture WhatsApp |

Un seul accent. C'est une contrainte volontaire : quand tout est mis en avant, plus rien
ne l'est. Le cuivre signale « ici, vous pouvez agir », et nulle part ailleurs.

**Pourquoi ce cuivre-là et pas un plus clair.** Le premier cuivre envisagé, `#C2703D`,
ne tenait que 3,7:1 avec du texte blanc — sous le seuil AA de 4,5:1. Un bouton
« Enregistrer la dose » dans cette teinte aurait violé votre propre exigence ENF-41.
Assombri à `#8E4A1E`, il monte à 6,7:1 et garde son caractère. C'est exactement le genre
d'arbitrage à raconter en soutenance : un choix esthétique passé au crible d'une mesure.

### Statuts vaccinaux

| Statut | Traitement | Couleur |
|---|---|---|
| Administré | Pastille pleine — la case du carnet est tamponnée | `#14432E` |
| À venir | Pastille vide — la case attend | contour `#B9C4BC` |
| Due aujourd'hui | Pastille pleine cerclée de cuivre | `#14432E` + anneau `#8E4A1E` |
| En retard | Pastille pleine **et** icône d'alerte | `#8C1410` sur `#F6E7E6` |
| Annulée | Pastille barrée | `#6B7A82` |

**Le point à défendre en soutenance.** Le rouge d'alerte a été poussé jusqu'à `#8C1410`,
un rouge très sombre, pour s'éloigner franchement du cuivre en luminosité. Cuivre et
rouge restent voisins en teinte — c'est la faiblesse assumée de cette palette. Elle est
compensée par deux garde-fous : l'écart de luminosité, et surtout le fait qu'un retard
porte **toujours** une icône d'alerte en plus de sa couleur.

C'est le principe général : **le remplissage et la forme portent l'information autant que
la teinte**. Pleine contre vide se distingue sans aucune perception des couleurs. Aucun
statut n'est signalé par la couleur seule — l'exigence ENF-41 devient ici une règle
concrète et vérifiable.

Si un test sur le terrain révélait une confusion entre le bouton cuivre et une alerte,
la parade est prête : basculer les boutons d'action en baobab et réserver le cuivre aux
liens et aux anneaux. Le cuivre n'apparaît alors plus jamais en aplat à côté d'un
rouge. C'est une seule ligne à changer dans `tokens.css`.

### Surfaces

`#FFFFFF` pour les cartes, `#FAFBFA` pour le fond de page et les lignes alternées,
`#D5E0D9` pour les bordures. Texte `#0F2A1E` à 14,8:1, texte secondaire `#4F6659` à
6,0:1 — les deux largement au-dessus du seuil AA.

---

## La typographie

**Public Sans**, une seule famille, en poids 400, 600 et 700.

Ce n'est pas la police que l'on choisit par défaut, et c'est le but. Elle a été dessinée
pour les services publics numériques : lisibilité à petite taille, formes ouvertes,
distinction nette entre le 1, le l et le I — ce qui compte quand on lit un numéro de lot
de vaccin. Elle est libre, et sa couverture Latin Extended inclut les caractères dont
vous avez besoin en wolof : **ñ, à, ë, ó, ŋ**.

Vérifiez ce point avant toute substitution : beaucoup de polices populaires rendent mal
le **ŋ**, et vos libellés wolof deviendraient illisibles.

| Rôle | Taille | Poids |
|---|---|---|
| Nom de l'enfant sur sa fiche | 32 px | 700 |
| Titre d'écran | 24 px | 700 |
| Sous-titre | 18 px | 600 |
| Texte courant | 16 px | 400 |
| Tableaux denses, libellés | 14 px | 400 / 600 |
| Mentions | 12 px | 400 |

Jamais en dessous de 14 px sur mobile, jamais en dessous de 16 px pour du texte que la
mère doit lire.

**Chiffres tabulaires.** Activez `font-variant-numeric: tabular-nums` sur tous les
tableaux. Les dates et les rangs de dose s'alignent alors en colonnes, et l'œil balaye
une liste de trente enfants sans effort. C'est déjà dans `tokens.css`.

---

## Règles d'interface

**Cible tactile : 48 px minimum.** L'agent est debout, parfois avec des gants. Aucun
bouton en dessous de cette taille.

**Un seul bouton principal par écran.** En cuivre plein. Tout le reste est secondaire :
contour ou texte simple.

**L'état de connexion est permanent.** Une barre discrète indique en ligne, hors ligne,
ou *n opérations en attente*. L'agent ne doit jamais se demander si sa saisie est partie.

**Les erreurs disent quoi faire.** Pas « Une erreur est survenue », mais « La date de
naissance ne peut pas être future. Corrigez-la pour continuer. »

**Les écrans vides invitent à agir.** Une file du jour vide affiche « Aucun enfant
attendu aujourd'hui », avec un bouton pour enregistrer un nouveau bénéficiaire.

---

## Les deux registres

**SUVAC** habille l'interface professionnelle : agents, superviseurs, documents,
dépôt de code.

**Kaay Ñakku** signe les messages adressés aux mères. La couverture WhatsApp porte ce
nom, le symbole, et un pictogramme de lecture.

Notez la retenue du texte sur cette couverture : elle accompagne un message vocal en
wolof destiné à des femmes qui, pour une partie d'entre elles, ne lisent pas. L'image
doit fonctionner sans être lue. Le triangle de lecture dit « écoutez », et c'est tout ce
qu'elle a besoin de dire.

---

## Ce qui n'est pas dans ce dossier, et volontairement

Pas de dégradés, pas d'ombres portées, pas d'illustrations, pas d'animations décoratives,
pas de seconde police. Rien de tout cela n'améliorerait la lecture d'une file de
vaccination, et chaque heure passée dessus est une heure retirée au moteur de calendrier
— le risque R-04 du cahier des charges.

Vous avez une palette, un symbole, une police et huit règles. Appliquez-les avec les
composants shadcn/ui tels qu'ils sont livrés, et arrêtez-vous là.
