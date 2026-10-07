# Service de synthèse vocale wolof

Produit les messages vocaux de SUVAC à partir de texte wolof.

## Pourquoi un service séparé

Le modèle exige Python 3.11, PyTorch et `transformers` 4.33 — incompatibles
avec l'environnement de SUVAC, qui tourne en Python 3.13 avec Django 5.2.
Les faire cohabiter demanderait de rétrograder tout le projet.

Le service est appelé en HTTP sur la machine locale. Si l'appel échoue, le
backend retombe sur l'assemblage de segments pré-enregistrés.

## Installation

Le paquet `TTS` compile des extensions C : il faut les outils de
compilation Microsoft C++ sous Windows, et travailler depuis l'invite
« x64 Native Tools Command Prompt ».


## Modèle

Kiriku-Wolof-TTS, publié par AI Hub Sénégal sur Hugging Face. Architecture
VITS, locuteur unique, 952 Mo. L'accès demande d'accepter les conditions sur
la page du modèle.


Le dossier `checkpoints/` n'est pas versionné.

## Lancement


Le modèle est chargé au démarrage ; comptez quelques secondes avant que le
service ne réponde.

## Durées observées

Entre cinq et vingt secondes selon la longueur du message, sur un portable
sans carte graphique. Le message du pentavalent, le plus long, est le plus
coûteux.

C'est pourquoi la génération se fait en tâche de fond et non pendant
l'envoi, et pourquoi le cache par empreinte du texte est essentiel : deux
mères recevant le même message partagent le fichier.

## Limites

- Locuteur unique, aucun contrôle de la voix ni du débit.
- Les mots français au sein du wolof sont annoncés comme peu fiables par la
  fiche du modèle ; les noms de vaccins en font partie.
- Aucune métrique de qualité n'accompagne le modèle.
