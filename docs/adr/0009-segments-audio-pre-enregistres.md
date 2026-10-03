# 0009 — Segments audio pré-enregistrés plutôt que synthèse vocale

## Statut
Acceptée

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
