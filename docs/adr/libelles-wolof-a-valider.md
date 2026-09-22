# Libellés wolof à valider

À soumettre à un locuteur natif, de préférence familier du vocabulaire
sanitaire.

## Principe

Ces libellés seront **prononcés à voix haute** dans les rappels vocaux, pas lus.
La question n'est donc pas « quelle est la traduction correcte » mais
« qu'est-ce qu'une mère de Ndondol comprendra en l'entendant ».

Un emprunt au français que tout le monde reconnaît vaut mieux qu'un terme
savant exact que personne n'emploie.

## 1. Les neuf vaccins

| Code | Français | Proposition wolof | Validé ? |
|---|---|---|---|
| BCG | BCG | | |
| VPO | Polio oral | | |
| VPI | Polio injectable | | |
| PENTA | Pentavalent | | |
| PNEUMO | Pneumocoque | | |
| ROTA | Rotavirus | | |
| RR | Rougeole-Rubéole | | |
| VAA | Fièvre jaune | | |
| TD | Antitétanique | | |

Question à poser pour chacun : **comment l'agent de santé l'annonce-t-il
à la mère au poste ?** C'est ce terme-là qu'il faut, pas celui du manuel.

## 2. Les phrases de rappel

Les variables entre crochets seront remplacées à l'envoi.

**Rappel avant l'échéance**
> Français : « Bonjour. [Prénom] doit recevoir le vaccin [vaccin] le [date].
> Venez au poste de santé de [poste]. »
> Wolof : « Nanga def. [Prenom] dafa wara ñaq u [vaccin] ci [date].
> Ñëwal ci postu wérgi-yaram bu [poste]. »

**Rappel le jour même**
> Français : « Bonjour. [Prénom] doit recevoir le vaccin [vaccin] aujourd'hui.
> Venez au poste de santé de [poste]. »
> Wolof : « Nanga def. [Prenom] dafa wara ñaq u [vaccin] tay. »
> ñëwal ci postu wérgi-yaram bu [poste] »

**Relance après retard**
> Français : « Bonjour. [Prénom] n'a pas reçu le vaccin [vaccin] prévu le
> [date]. Venez au poste de santé dès que possible. »
> Wolof : « Nanga def. [Prenom] jotul ñaq [vaccin] bi ñu ko waroon a jox [date]. Nanga ñëw ci
> postu wérgi-yaram bi ci nimu gëna gaawe. »

**Confirmation après administration**
> Français : « [Prénom] a bien reçu le vaccin [vaccin]. Prochain rendez-vous
> le [date]. »
> Wolof : « [Prenom] jot na ñakk [vaccin] bi. Randewu bi ci topp: [date]. »

**Rappel pour la mère (antitétanique)**
> Français : « Bonjour. Vous devez recevoir votre vaccin antitétanique le
> [date]. Venez au poste de santé de [poste]. »
> Wolof : « Nanga def. Danga wara am sa ñaqu tetanus ci [date]. Ñëwal ci postu wérgi-yaram bu
> [poste]. »

## 3. Questions de formulation à trancher

**Le ton.** Faut-il vouvoyer ? Le wolof a des marques de respect qui n'ont pas
d'équivalent direct en français. Comment s'adresse-t-on à une mère qu'on ne
connaît pas ?

**La relance après retard.** Comment dire qu'une dose a été manquée sans que
la mère se sente jugée ? C'est le message le plus délicat : mal formulé, il
décourage au lieu d'inciter.

**Les dates.** Dit-on « le 12 mars » ou « dans trois jours » ? La seconde forme
est sans doute plus naturelle à l'oral et plus facile à assembler à partir de
segments audio.

**Les nombres.** Les rangs de dose — première, deuxième, troisième — doivent
être énoncés. Quelle forme ?

## 4. Une fois validé

- Les neuf libellés vont dans le champ `libelle_wo` du modèle `Vaccin`,
  modifiable depuis l'interface d'administration.
- Les phrases deviennent les gabarits des messages vocaux du sprint 3.
- Chaque segment sera enregistré par une voix humaine, puis assemblé
  automatiquement.
