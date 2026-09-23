# Sprint 3 — Planification

Thème : rappels vocaux en wolof
Période : … à …

## Objectif

Une mère qui ne lit pas doit recevoir, sur son téléphone, un message vocal
en wolof lui disant quel vaccin son enfant doit recevoir et quand venir.
Sans ouvrir l'application, sans lire un mot.

C'est ce qui distingue SUVAC d'un simple registre informatisé.

## Stories engagées

| Réf. | Story | Exigences | État |
|---|---|---|---|
| S3-01 | Celery et Beat en place, tâche de balayage quotidien | EF-40 | À faire |
| S3-02 | Un rappel est une entité tracée : destinataire, canal, statut, horodatage | EF-45, EF-46 | À faire |
| S3-03 | Abstraction des canaux, avec un canal de simulation pour les tests | — | À faire |
| S3-04 | Les échéances du jour d'un bénéficiaire tiennent en un seul message | RG-09 | À faire |
| S3-05 | Aucun rappel n'est émis sans consentement actif | EF-47 | À faire |
| S3-06 | Génération audio wolof par assemblage de segments enregistrés | EF-44 | À faire |
| S3-07 | Encapsulation de l'audio en vidéo pour l'en-tête de modèle WhatsApp | EF-43 | À faire |
| S3-08 | Envoi par WhatsApp Cloud API, avec repli SMS | EF-41, EF-48 | À faire |
| S3-09 | Suivi des accusés de réception par webhook | EF-46 | À faire |
| S3-10 | Connexion de la mère par code à usage unique, en remplacement du mot de passe | ADR 0006 | À faire |
| S3-11 | Le superviseur consulte le journal des rappels émis et leur statut | EF-49 | À faire |

## Critères de fin de sprint

- [ ] Un rappel vocal en wolof arrive sur un vrai téléphone
- [ ] Aucun rappel n'est émis sans consentement, vérifié par test
- [ ] Le balayage quotidien tourne sans intervention
- [ ] Couverture backend ≥ 85 %, frontend ≥ 70 %
- [ ] Le mot de passe des bénéficiaires est remplacé par le code à usage unique

## Acquis avant le sprint

Le compte Meta Business est ouvert et un message de test a été reçu sur un
numéro sénégalais. Le risque R-01 est levé.

Trois identifiants sont en place : numéro d'expédition, compte WhatsApp
Business, et un destinataire déclaré. Le numéro de test est gratuit pendant
quatre-vingt-dix jours.

## Risques

- **R-02, non levé.** La vidéo encapsulant l'audio n'a jamais été testée sur
  un téléphone d'entrée de gamme. À faire dès que le premier fichier est
  produit, avant de construire dessus.
- **Les libellés wolof manquent toujours.** `docs/libelles-wolof-a-valider.md`
  n'a pas été soumis. Sans eux, les segments audio ne peuvent être
  enregistrés. C'est le chemin critique du sprint.
- **Les modèles de message doivent être approuvés par Meta.** Délai
  imprévisible, de quelques minutes à quelques heures. À soumettre tôt.
- **Le numéro de test n'atteint que cinq destinataires déclarés.** Suffisant
  pour la démonstration, mais aucune charge réelle ne peut être éprouvée.

## Ordre de travail

L'infrastructure d'abord, l'audio ensuite : le canal de simulation permet de
tout tester sans dépendre des enregistrements wolof, qui arriveront quand les
libellés seront validés.
