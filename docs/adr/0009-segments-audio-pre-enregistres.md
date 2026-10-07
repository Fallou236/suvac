# 0009 — Segments audio pré-enregistrés plutôt que synthèse vocale

## Statut
Révisée en octobre 2026. La décision initiale retenait les segments
pré-enregistrés ; la synthèse vocale est devenue la voie principale.

## Contexte
Le cœur du projet est un message vocal en wolof adressé à une mère qui ne
lit pas. Deux voies : synthétiser la parole, ou assembler des enregistrements.

## Décision
Des segments courts, enregistrés par une voix humaine wolophone, concaténés
par ffmpeg selon le message à produire.

Une quarantaine de segments : les amorces de phrase, les neuf vaccins, les
jours, les mois, les postes.

## Justification

**La qualité.** Une voix humaine qui connaît la langue est plus
intelligible qu'une synthèse, surtout sur un haut-parleur de téléphone
d'entrée de gamme.

**L'absence d'alternative fiable.** Aucun modèle de synthèse vocale wolof
n'est disponible avec une qualité suffisante.

**Le coût.** Assembler des fichiers ne demande aucun service externe, aucun
appel payant, aucune connexion au moment de l'envoi.

## Le prix à payer
Tout ce qui n'est pas enregistré ne peut être dit.

**Les prénoms**, en particulier. Le message dit « sa doom » — votre enfant —
complété du mois de naissance quand la mère en a plusieurs. Sans cela, elle
entendrait « votre enfant doit recevoir… » sans savoir lequel.

**Les postes** demandent un enregistrement à chaque nouveau déploiement.

**Les messages sont longs.** Le libellé du pentavalent énumère cinq
maladies. Un message peut atteindre trente secondes. C'est assumé : une mère
qui entend contre quoi le vaccin protège comprend pourquoi venir, là où un
sigle ne lui dirait rien.

Deux garde-fous limitent la dérive : un vaccin n'est jamais répété même avec
trois doses en retard, et au-delà de trois vaccins distincts le message
résume plutôt que d'énumérer.

## Mise en cache
Le nom du fichier produit dérive de l'empreinte des segments qui le
composent. Deux messages identiques réutilisent le même fichier plutôt que
d'être réassemblés à chaque balayage.

## Encapsulation vidéo
WhatsApp n'accepte ni audio ni document en en-tête de modèle. Le message
vocal est donc encapsulé dans une vidéo d'une image fixe aux couleurs de
l'application.

Le poids reste modeste — de l'ordre de deux cents kilooctets pour vingt
secondes — ce qui compte sur un réseau 2G.

## Risque ouvert
Les libellés ont été validés par un locuteur natif, mais les enregistrements
n'ont pas encore été réalisés. Tant qu'ils ne le sont pas, la chaîne
fonctionne avec des segments silencieux qui en vérifient le mécanisme, pas
le contenu.

## Révision — adoption de la synthèse vocale

### Ce qui a changé
Un modèle de synthèse wolof est devenu disponible : Kiriku-Wolof-TTS,
architecture VITS, publié par AI Hub Sénégal. La raison principale
d'écarter la synthèse — l'absence de modèle fiable — ne tenait plus.

### Ce qui a emporté la décision
Les segments pré-enregistrés ne disent que ce qui a été enregistré. Chaque
nouveau poste de santé aurait demandé un enregistrement supplémentaire, ce
qui ne tient pas quand le dispositif s'étend.

La synthèse prononce le texte composé, quel qu'il soit. Elle supprime cette
contrainte et rend les prénoms prononçables si on le souhaitait un jour.

### Le prix payé
Le modèle exige Python 3.11, PyTorch et une version ancienne de
`transformers`, incompatibles avec l'environnement de SUVAC qui tourne en
Python 3.13 avec Django 5.2.

D'où un service séparé, appelé en HTTP sur la machine locale. Plus de
pièces à déployer, mais l'alternative — rétrograder tout le projet — était
pire.

La génération coûte entre cinq et vingt secondes par message sur une
machine sans carte graphique. C'est trop pour la faire pendant l'envoi,
d'où deux parades : la génération en amont, et un cache indexé par
l'empreinte du texte. Les messages se répétant beaucoup d'une mère à
l'autre, un balayage produit une vingtaine de fichiers distincts, pas un
par bénéficiaire.

### Ce qui est conservé
L'assemblage de segments reste en place comme repli. Si le service de
synthèse ne répond pas, le message part assemblé plutôt que pas du tout.

C'est aussi ce qui justifie d'avoir écrit les deux : le travail sur les
segments n'est pas perdu, il devient la garantie de continuité.

### Limites connues
- Locuteur unique, aucun contrôle du débit ni de la voix.
- La fiche du modèle annonce les mots français au sein du wolof comme peu
  fiables ; les noms de vaccins en font partie. Le rendu a été jugé
  acceptable à l'écoute, sans évaluation formelle.
- Aucune métrique de qualité ne documente le modèle.
- La licence du jeu d'entraînement n'est pas précisée par ses auteurs.

### Ce qu'il faudrait pour aller plus loin
Une évaluation de compréhension auprès de mères wolophones : leur faire
écouter un message sans le texte et vérifier ce qu'elles en retiennent.
C'est le seul critère qui compte, et il n'a pas été mesuré.
