# 0006 — Authentification des bénéficiaires

## Statut
Acceptée, transitoire. À remplacer au sprint 3.

## Contexte
Les mères accèdent désormais à un espace personnel : carnets de leurs
enfants, messages de rappel, fiches des vaccins. Il faut les authentifier.

Le public impose ses contraintes. Une partie des mères lit peu ou pas le
français, beaucoup partagent un téléphone, et aucune n'a d'adresse
électronique à laquelle envoyer un lien de réinitialisation.

## Décision
Pour l'instant, l'agent de santé ouvre l'accès depuis la fiche de la mère :
il choisit un identifiant et un mot de passe et les lui transmet oralement,
au poste. La mère se connecte ensuite comme n'importe quel utilisateur.

Fermer l'accès désactive le compte sans le supprimer : les actes restent
rattachés à un auteur identifiable (RG-10).

## Pourquoi cette solution d'attente
La solution juste est un code à usage unique envoyé par WhatsApp : rien à
retenir, rien à transmettre. Mais elle dépend du canal construit au
sprint 3. L'attendre aurait bloqué tout l'espace bénéficiaire.

## Limites connues
- Un mot de passe transmis oralement est fragile : il peut être noté,
  oublié, entendu par un tiers.
- Une mère qui oublie son mot de passe doit revenir au poste.
- Rouvrir un accès fermé crée un second compte au lieu de réactiver le
  premier.
- Aucun mécanisme n'empêche un agent de connaître le mot de passe d'une mère,
  puisque c'est lui qui le choisit.

## Sécurité, indépendamment du mode d'authentification
Le cloisonnement ne dépend pas de la façon dont la mère se connecte :
- une mère ne voit que son propre dossier, jamais celui d'une autre, même
  rattachée au même poste ;
- un identifiant valide mais étranger reçoit la même réponse qu'un
  identifiant inconnu ;
- les écrans professionnels refusent explicitement le rôle bénéficiaire.

Ces garanties resteront valables quand le code à usage unique remplacera le
mot de passe.

## Remplacement prévu
Au sprint 3 : l'agent enregistre seulement le numéro de la mère. À chaque
connexion, elle reçoit un code à six chiffres valable dix minutes sur
WhatsApp, ou par SMS en secours. Plus aucun mot de passe n'est choisi ni
transmis.
