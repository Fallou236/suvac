# 0001 — Langue du code et du domaine

## Statut
Acceptée

## Contexte
Le projet mêle un domaine métier francophone (postes de santé, échéances,
doses) et un cadre technique anglophone (Django, DRF, React). Une première
tentative de tout franciser a produit une collision : un gestionnaire nommé
`objets` là où Django et tout son écosystème attendent `objects`.

## Décision
Le vocabulaire du domaine est en français : noms de modèles, de champs, de
méthodes métier, messages destinés aux utilisateurs.

Le vocabulaire du cadre technique reste dans sa langue d'origine : `objects`,
`Meta`, `save`, `get_queryset`, noms de hooks React, etc.

Les commentaires et la documentation sont en français.

## Alternatives écartées
Tout franciser : impose de retenir des correspondances arbitraires, casse les
réflexes acquis, et rend le code illisible pour un relecteur extérieur habitué
à Django.

Tout angliciser : éloigne le code du vocabulaire métier réel des utilisateurs
et complique la relecture par un encadrant ou un professionnel de santé.

## Conséquences
Une règle simple à énoncer, mais qui demande de la vigilance aux frontières.
En cas de doute : si Django, DRF ou React donne déjà un nom à la chose, on
garde le leur.
