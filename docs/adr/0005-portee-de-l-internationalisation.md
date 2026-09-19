# 0005 — Portée de l'internationalisation

## Statut
Acceptée

## Contexte
EF-70 exige une interface disponible en français et en wolof. L'infrastructure
`react-i18next` permet de tout traduire, mais représente environ cent cinquante
chaînes à faire valider par un locuteur natif.

La question posée n'est pas technique : faut-il traduire l'interface
professionnelle ?

## Décision
L'interface destinée aux agents de santé et aux superviseurs reste en français.
Le mécanisme d'internationalisation est en place, le sélecteur de langue
fonctionne, et `wo.json` reste volontairement partiel : toute clé manquante
retombe sur le français.

Le wolof est concentré là où il produit un effet réel : les messages vocaux
adressés aux mères, les libellés de vaccins qui y sont énoncés, et les phrases
de rappel.

## Justification
L'agent de santé est formé et travaille en français — c'est la langue de
l'administration sanitaire sénégalaise, des formulaires du PEV et du carnet de
vaccination lui-même. Traduire son interface a une valeur symbolique, pas
pratique.

La mère, elle, ne lit pas nécessairement, et certainement pas le français. Le
wolof lui est indispensable, et sous forme vocale plutôt qu'écrite. C'est là
que se joue l'utilité du projet, et c'est là que la validation par un locuteur
natif a de la valeur.

Concentrer l'effort de traduction sur une quinzaine de chaînes réellement
utiles vaut mieux que le disperser sur cent cinquante dont personne ne
bénéficiera.

## Alternative écartée
Traduire l'intégralité de l'interface. Écartée pour trois raisons : le coût de
validation, le risque de traductions approximatives faute de relecteur
disponible pour ce volume, et l'absence de bénéfice pour l'utilisateur visé.

Une traduction complète mais superficielle serait moins défendable qu'un
périmètre restreint et assumé.

## Conséquences
`wo.json` restera partiel jusqu'à validation. Ce n'est pas un travail
inachevé mais un choix de périmètre, à énoncer comme tel en soutenance.

Les libellés à valider sont rassemblés dans
`docs/libelles-wolof-a-valider.md`, à soumettre au professeur Michel Seck ou
à un agent de santé wolophone.

EF-70 doit être reformulée dans le cahier des charges : « l'interface est
disponible en français ; les messages adressés aux bénéficiaires sont en
wolof ». L'exigence initiale ne distinguait pas les deux publics.
