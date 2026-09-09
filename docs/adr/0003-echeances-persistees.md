# 0003 — Persister les échéances plutôt que les recalculer

## Statut
Acceptée

## Contexte
Le moteur de calendrier sait produire la liste complète des échéances d'un
bénéficiaire à partir de sa date de référence, du schéma vaccinal et des doses
déjà reçues. Rien n'oblige donc à stocker ces échéances : elles pourraient
être recalculées à chaque affichage.

## Décision
Les échéances sont écrites en base dans la table `Echeance`, et régénérées
après chaque événement susceptible de les modifier : création du bénéficiaire,
enregistrement d'une dose, annulation.

## Alternative écartée
Le recalcul à la volée est plus simple et garantit une cohérence permanente
avec le schéma. Il a été écarté pour deux raisons.

Le balayage quotidien des rappels (EF-40) doit répondre à la question « quelles
échéances sont dues aujourd'hui, tous bénéficiaires confondus ». Sans table à
interroger, il faudrait parcourir chaque enfant et recalculer son calendrier
entier — coût prohibitif au-delà de quelques milliers de bénéficiaires.

L'agent hors ligne (EF-51) doit disposer de sa file du jour sans embarquer le
moteur ni le référentiel dans le client.

## Conséquences
La base peut diverger du schéma si celui-ci change sans régénération. La
fonction `generer_echeances` est donc idempotente et rejouable ; un test le
vérifie.

La génération est déclenchée par un signal `post_save` plutôt que par un appel
explicite dans les vues. Les signaux rendent le comportement implicite, ce qui
est un vrai défaut de lisibilité. Ils ont été retenus parce qu'EF-20 exige que
le calendrier existe quelle que soit la voie de création — API, import,
interface d'administration, commande d'administration. Un appel explicite en
vue laisserait passer tous les autres chemins.