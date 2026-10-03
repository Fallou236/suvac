# 0007 — Authentification et administration du personnel

## Statut
Acceptée

## Contexte
Jusqu'ici, les comptes du personnel se créaient par l'interface
d'administration Django. Un superviseur qui accueille un nouvel agent devait
solliciter quelqu'un ayant accès au serveur.

Trois questions se posaient : qui crée les comptes, comment le mot de passe
initial parvient à son détenteur, et que faire quand il l'oublie.

## Décision

**Le superviseur crée les comptes de son poste** et choisit leur mot de
passe initial, qu'il transmet oralement. L'administrateur fait de même pour
tous les postes.

**Le mot de passe initial doit être changé à la première connexion.** Tant
qu'il ne l'est pas, l'API refuse toute requête hors du changement lui-même,
et l'interface impose un écran sans issue.

**Le mot de passe oublié se réinitialise par le superviseur**, pas par un
lien envoyé à une adresse électronique.

**Aucun compte n'est supprimé**, seulement désactivé. Personne ne peut
désactiver ni réinitialiser le sien.

## Justification

**Pas de mot de passe commun.** Un mot de passe partagé par tous les comptes
créés serait une faille : connaître un identifiant suffirait à entrer.

**Pas de courriel.** Il faudrait un serveur d'envoi, une troisième
dépendance après WhatsApp et SMS, et tous les agents d'un poste rural n'ont
pas d'adresse. Le superviseur est présent physiquement : c'est le canal le
plus sûr dont on dispose.

**Changement obligatoire.** Un mot de passe transmis par un tiers n'est pas
un secret. Sans cette règle, un agent travaillerait des mois avec celui que
son superviseur connaît.

**Pas de suppression.** Les doses administrées gardent la trace de leur
auteur (RG-10). Supprimer un compte rendrait ces actes anonymes.

**Pas d'auto-désactivation.** Un poste dont le superviseur s'est désactivé
par erreur ne pourrait plus créer de comptes.

## Sécurité des sessions
Un changement ou une réinitialisation met en liste noire les jetons de
rafraîchissement du compte. Si le mot de passe était compromis, les sessions
ouvertes ailleurs tombent.

Limite assumée : un jeton d'accès reste valable jusqu'à son expiration,
quinze minutes. C'est inhérent aux jetons sans état, et le prix du choix de
ne pas interroger la base à chaque requête.

## Limites connues
- Un mot de passe transmis oralement peut être noté, oublié, entendu.
- Un agent qui oublie le sien doit revenir au poste.
- Le superviseur connaît le mot de passe initial de ses agents, jusqu'à ce
  qu'ils le changent.

## Alternative écartée
L'envoi d'un code à usage unique par WhatsApp, comme prévu pour les
bénéficiaires au sprint 3. Écartée pour le personnel : un agent se connecte
chaque jour, et attendre un code à chaque fois serait un frein. Le mot de
passe personnel reste le bon compromis pour un usage quotidien.
