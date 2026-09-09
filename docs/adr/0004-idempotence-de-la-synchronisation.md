# 0004 — Clé d'idempotence fournie par le client

## Statut
Acceptée

## Contexte
L'agent de santé saisit des doses sans connexion (EF-52). Les opérations sont
placées dans une file locale et rejouées au retour du réseau (EF-53, EF-54).

Une requête peut aboutir côté serveur sans que la réponse parvienne au client :
réseau coupé après l'écriture, délai dépassé. Le client, ne sachant pas que
l'opération a réussi, la rejouera. Sans protection, une même dose serait
enregistrée deux fois — inacceptable pour un acte médical.

## Décision
Le champ `cle_idempotence` de `DoseAdministree` est un UUID généré par le
client au moment de la saisie, transmis avec la requête et unique en base.
Avant toute écriture, le service vérifie si cette clé existe déjà et retourne
la dose existante le cas échéant.

## Alternative écartée
Générer l'identifiant côté serveur, ce qui est l'usage habituel. Impossible
ici : un identifiant créé à la réception change à chaque rejeu, donc ne permet
jamais de reconnaître un doublon. Seule une clé née avant l'envoi, et
conservée par le client dans sa file, garde la même valeur d'une tentative à
l'autre.

Une déduplication par (échéance, date, agent) a également été envisagée. Elle
échoue dans un cas légitime rare mais réel : deux enregistrements distincts du
même acte après correction.

## Conséquences
Le client est responsable de générer la clé et de la conserver tant que
l'opération n'est pas confirmée. Le contrat d'API doit l'exposer clairement.

Deux tests encadrent le comportement : rejouer la même clé ne crée pas de
doublon, et deux clés distinctes créent bien deux doses — ce second test
garantit que c'est la clé qui agit, et non un effet de bord.