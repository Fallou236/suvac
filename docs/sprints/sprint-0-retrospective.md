# Sprint 0 — Rétrospective

Période : 08/09/2026 à 09/09/2026
Objectif : socle technique opérationnel, pipeline vert, documentation de cadrage.

## Atteint

- Cahier des charges rédigé, validé, versionné dans le dépôt
- Identité visuelle définie et appliquée
- Django 5.2, PostgreSQL et Redis opérationnels, point de santé exposé
- Modèle utilisateur personnalisé, rôles et postes de santé
- Moteur de calendrier vaccinal : 20 tests, couverture 97 %
- Pipeline GitHub Actions vert, branche main protégée

## Ce qui a bloqué

- `createsuperuser` violait la contrainte imposant un poste à tout agent.
  Corrigé au bon endroit — le gestionnaire de modèle — plutôt qu'en
  assouplissant la contrainte. Verrouillé par un test.
- Gestionnaire nommé `objets` au lieu de `objects` : collision avec la
  convention Django. A donné lieu à l'ADR 0001 sur la langue du code.
- `conftest.py` mal placé : les fixtures n'étaient pas découvertes.

## Écart de processus

Les cinq premiers commits ont été poussés directement sur `main`, alors que
le cahier des charges impose une pull request. L'écart a été identifié et
corrigé : le pipeline est passé par une branche et une PR, et `main` est
désormais protégée. Les commits d'amorçage restent en l'état, l'historique
n'a pas été réécrit.

## Décisions pour le sprint 1

- Une branche par unité de travail, sans exception
- `mypy` à rendre bloquant avant la fin du sprint 2
- …