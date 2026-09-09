# 0002 — Stratégie de branchement en développement solo

## Statut
Acceptée

## Contexte
Le cahier des charges (section 12.1) impose une branche `main` protégée, une
pull request par unité de travail et une revue approuvée avant fusion. Ces
règles supposent une équipe. Le projet est mené par une seule personne : la
revue croisée est matériellement impossible.

Par ailleurs, les premiers commits du sprint 0 ont été poussés directement sur
`main`, en écart avec cette règle.

## Décision
Le flux par branches et pull requests est conservé intégralement. Une branche
par unité de travail, préfixée selon sa nature : `feat/`, `fix/`, `refactor/`,
`test/`, `docs/`, `chore/`. Fusion en squash pour garder un commit par
fonctionnalité sur `main`.

L'exigence d'approbation est ramenée à zéro approbateur, faute de second
relecteur. Elle est remplacée par une auto-revue différée : la pull request
n'est pas fusionnée immédiatement après ouverture. Le diff est relu dans
l'onglet « Files changed » de GitHub, dans une interface distincte de
l'éditeur, après un temps d'écart.

La protection de branche exige la réussite du job « Backend — qualité et
tests ». C'est ce contrôle automatique qui remplace le regard humain absent.

## Alternative écartée
Travailler directement sur `main`, ce qui est courant en solo. Écarté parce
que la CI ne s'exécuterait alors qu'après coup : une régression atteindrait la
branche principale avant d'être détectée. La pull request déplace la
vérification avant l'intégration, ce qui est tout son intérêt.

## Conséquences
L'historique du sprint 0 conserve cinq commits poussés directement sur `main`.
Ils n'ont pas été réécrits : une réécriture rétroactive aurait produit un
historique conforme mais mensonger. L'écart est consigné dans la rétrospective
du sprint 0.

La protection de branche a d'abord été configurée sans effet — le ruleset
n'avait pas été enregistré. L'écart n'a été détecté que par un test de
contournement délibéré : un push direct sur `main`, qui a d'abord réussi. Un
garde-fou dont on n'a jamais constaté le refus n'est pas un garde-fou vérifié.