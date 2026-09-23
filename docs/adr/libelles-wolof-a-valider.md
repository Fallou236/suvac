# Libellés wolof

Statut : **validés** le 23/09/2026 par Fallou Diouck

## Principe

Ces libellés sont **prononcés à voix haute** dans les rappels vocaux, pas lus.
La question n'est pas « quelle est la traduction correcte » mais « qu'est-ce
qu'une mère de Ndondol comprendra en l'entendant ».

Un emprunt au français que tout le monde reconnaît vaut mieux qu'un terme
savant exact que personne n'emploie. C'est pourquoi *Poliomyélite*,
*Rougeole*, *Roubeole* et *Tatanos* restent en français dans les libellés
wolof : ce sont les mots employés au poste de santé.

## Décisions de conception

**Messages longs assumés.** Le libellé d'un vaccin est une phrase entière —
le pentavalent énumère les cinq maladies. Les messages vocaux dépasseront
donc parfois trente secondes. C'est un choix : une mère qui entend contre
quoi le vaccin protège comprend pourquoi venir, là où un sigle ne lui dirait
rien.

**Une seule graphie.** `ñakk` partout, dans les libellés comme dans les
phrases. Deux orthographes concurrentes rendraient les segments audio et les
futures traductions incohérents.

## 1. Les neuf vaccins

| Code | Français | Wolof |
|---|---|---|
| BCG | BCG | ñakk bu lay aar ci tuberculose |
| VPO | Polio oral | naanu bu lay aar ci Poliomyelite |
| VPI | Polio injectable | ñakk bu lay aar ci Poliomyelite |
| PENTA | Pentavalent | ñakk bu lay aar ci juroom i feebar yu bokkul : diphtérie, tétanos, coqueluche, l'hépatite B ak infection bu garaw ñu koy woowe Hib |
| PNEUMO | Pneumocoque | ñakk bu lay aar ci ay pneumonies yu garaw |
| ROTA | Rotavirus | ñakk bu lay aar ci Biir buy daw ba jéggi dayo |
| RR | Rougeole-Rubéole | ñakk bu lay aar ci Rougeole ak Roubeole |
| VAA | Fièvre jaune | ñakk bu lay aar ci Peuyis |
| TD | Antitétanique | ñakk bu lay aar ci Tatanos yaw ak sa doom |

Le VPO se distingue des autres : *naanu* et non *ñakk*, parce qu'il se boit
au lieu de se piquer. La mère entend donc ce qui va réellement se passer.

## 2. Les phrases de rappel

Les variables entre crochets sont remplacées à l'envoi.

### Rappel avant l'échéance

> **Français** — Bonjour. [Prénom] doit recevoir le vaccin [vaccin] le
> [date]. Venez au poste de santé de [poste].
>
> **Wolof** — Nanga def. [Prenom] dafa wara ñakk u [vaccin] ci [date].
> Ñëwal ci postu wérgi-yaram bu [poste].

### Rappel le jour même

> **Français** — Bonjour. [Prénom] doit recevoir le vaccin [vaccin]
> aujourd'hui. Venez au poste de santé de [poste].
>
> **Wolof** — Nanga def. [Prenom] dafa wara ñakk u [vaccin] tay. Ñëwal ci
> postu wérgi-yaram bu [poste].

### Relance après retard

> **Français** — Bonjour. [Prénom] n'a pas reçu le vaccin [vaccin] prévu le
> [date]. Venez au poste de santé dès que possible.
>
> **Wolof** — Nanga def. [Prenom] jotul ñakk [vaccin] bi ñu ko waroon a jox
> [date]. Nanga ñëw ci postu wérgi-yaram bi ci nimu gëna gaawe.

### Confirmation après administration

> **Français** — [Prénom] a bien reçu le vaccin [vaccin]. Prochain
> rendez-vous le [date].
>
> **Wolof** — [Prenom] jot na ñakk [vaccin] bi. Randewu bi ci topp : [date].

### Rappel pour la mère (antitétanique)

> **Français** — Bonjour. Vous devez recevoir votre vaccin antitétanique le
> [date]. Venez au poste de santé de [poste].
>
> **Wolof** — Nanga def. Danga wara am sa ñakku tetanus ci [date]. Ñëwal ci
> postu wérgi-yaram bu [poste].

## 3. Segments à enregistrer

Chaque message est assemblé à partir de segments enregistrés séparément, ce
qui évite de réenregistrer une phrase entière à chaque changement de date ou
de prénom.

**Segments fixes** — un enregistrement par élément :

- les cinq amorces et clôtures de phrase ci-dessus, découpées autour des
  variables ;
- les neuf libellés de vaccins ;
- les rangs de dose : première, deuxième, troisième, quatrième, cinquième ;
- les jours du mois, les mois de l'année ;
- les noms des postes de santé couverts.

**Segments variables** — les prénoms ne peuvent pas être enregistrés à
l'avance. Deux options restent ouvertes : les omettre du message vocal, ou
recourir à la synthèse vocale pour ce seul segment. À trancher au moment de
l'implémentation.

## 4. Ce qui reste à faire

- [ ] Enregistrer les segments par une voix féminine wolophone
- [ ] Éprouver la longueur réelle d'un message assemblé, pentavalent compris
- [ ] Vérifier la lecture sur un téléphone d'entrée de gamme (risque R-02)
