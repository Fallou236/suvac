# Sprint 1 — Rétrospective

Thème : backend métier et API
Période : 09/09/2026 à 10/09/2026

## Livré

- Modèle de données complet : postes, utilisateurs et rôles, référentiel
  vaccinal, bénéficiaires, échéances, doses, consentements
- Moteur de calendrier isolé de Django, 20 tests unitaires, couverture 97 %
- Schéma PEV chargé par commande d'administration idempotente
- API REST : authentification JWT, bénéficiaires, calendriers, file du jour,
  enregistrement des doses, annulation
- 132 tests, couverture globale 98 %
- Schéma OpenAPI complet, consultable via Swagger

Les onze stories engagées sont terminées.

## Ce qui a bien marché

- **Construire le moteur en premier.** Isolé de Django, il se teste en une
  fraction de seconde sans base de données. Les vingt cas ont été écrits avant
  que quoi que ce soit ne s'appuie dessus, et aucune régression n'est apparue
  ensuite malgré trois couches ajoutées par-dessus.
- **Les contraintes en base plutôt qu'en formulaire.** Elles ont détecté des
  erreurs qu'un contrôle applicatif aurait laissé passer, notamment lors du
  chargement du schéma.
- **La couverture comme outil de repérage.** La chute à 91 % après l'ajout de
  `services.py` a signalé le trou de tests avant qu'il ne s'installe.

## Ce qui a bloqué

- **Une pull request jamais fusionnée.** Le travail sur l'API des bénéficiaires
  est resté sur sa branche pendant qu'une nouvelle branche était créée depuis
  `main`. Une étape entière a été menée sur une base incomplète avant que
  l'absence de deux fichiers ne le révèle. Le signal existait pourtant : un
  `git pull` sur `main` qui ne rapatrie aucun fichier signifie qu'aucune
  fusion n'a eu lieu.
- **Python installé depuis le Microsoft Store.** Sa couche de redirection de
  fichiers a rendu `pre-commit` inutilisable et le cache `virtualenv`
  irréparable. Réinstallation depuis python.org, environnement recréé.
  Bénéfice inattendu : la suite de tests est passée de 38 à 20 secondes.
- **La limitation de débit contre la suite de tests.** Les compteurs DRF vivent
  dans le cache, qui persiste entre les tests alors que la base est
  réinitialisée. Le trente-et-unième test à se connecter recevait un 429. La
  limitation est désormais neutralisée en test via un drapeau explicite.
- **Un `noqa` neutralisé par le formateur.** `black` avait découpé la ligne
  concernée, déplaçant le commentaire hors de la ligne signalée par Ruff.
- **Deux erreurs de conception détectées par les tests.** Le prénom de l'enfant
  était obligatoire, alors qu'un nourrisson est souvent nommé au baptême. Et
  `cle_idempotence` était déclarée optionnelle sans valeur par défaut, ce qui
  faisait planter la vue quand le client ne l'envoyait pas.

## Limites assumées

- **ENF-15 n'est plus couvert automatiquement.** La limitation de débit est
  vérifiée manuellement. Deux tentatives de test automatisé ont échoué, l'une
  contre le cache partagé, l'autre contre la configuration mise en cache par
  DRF. Un test bancal aurait moins de valeur qu'une limite reconnue.
- **`mypy` reste non bloquant en CI.** À traiter avant la fin du sprint 3.
- **R-08 toujours ouvert.** Le schéma PEV chargé est une reconstitution, non
  validé par une source officielle. Bloquant avant toute démonstration
  crédible.
- **Les libellés wolof des vaccins sont vides.** Ils alimenteront les messages
  vocaux : à faire renseigner avant le sprint 3.
- **La suite met 88 secondes.** Les tests d'API se connectent chacun, ce qui
  hache un mot de passe et signe un jeton à chaque fois. À optimiser si le seuil
  des deux minutes est franchi.

## Actions pour le sprint 2

- Vérifier systématiquement, après `git pull` sur `main`, que la fusion
  attendue est bien arrivée avant de créer une branche.
- Renseigner les libellés wolof auprès d'un locuteur natif.
- Ouvrir le compte Meta Business et obtenir un numéro de test WhatsApp — le
  délai d'approbation ne dépend pas de nous (risque R-01).
- Confronter le schéma PEV à une source officielle.
