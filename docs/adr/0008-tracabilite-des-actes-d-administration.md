# 0008 — Traçabilité des actes d'administration

## Statut
Acceptée

## Contexte
Le superviseur peut désormais créer des comptes, réinitialiser des mots de
passe, transférer des agents et fermer des postes. Ces actes donnent ou
retirent l'accès à des données de santé.

Sans trace, une question comme « qui a créé ce compte qui a consulté le
dossier de cette femme ? » resterait sans réponse.

## Décision
Un journal en écriture seule enregistre chaque acte d'administration :
l'acte, son auteur, sa cible, un détail libre et l'horodatage.

Rien ne le modifie ni ne l'efface. Il est consultable par l'administrateur
seul.

Les identifiants de l'auteur et de la cible y sont copiés en clair, en plus
des clés étrangères : si un compte est un jour supprimé en base, la trace
doit rester lisible.

## Ce qui est journalisé
Création et désactivation de compte, réinitialisation de mot de passe,
transfert vers un autre poste, création et modification structurante d'un
poste.

## Ce qui ne l'est pas
La correction d'un téléphone ou d'une localisation. Le journal doit rester
lisible : y verser chaque modification mineure le rendrait inutilisable au
moment où l'on en aurait besoin.

## Pourquoi réservé à l'administrateur
Un superviseur ne doit pas pouvoir vérifier ce que ses pairs ont fait. Le
journal sert au contrôle, et celui qui est contrôlé ne contrôle pas.

## Pourquoi la journalisation ne peut pas échouer bruyamment
La fonction d'écriture ne lève jamais : un journal indisponible ne doit pas
empêcher un superviseur de créer le compte dont son poste a besoin. L'échec
est écrit dans les traces applicatives.

C'est un arbitrage assumé entre traçabilité et continuité de service. Dans
un contexte où la perte d'une trace est moins grave qu'un poste bloqué, la
continuité l'emporte.

## Conséquence sur ENF-26
Le cahier des charges exige déjà la journalisation des accès aux données de
santé. Ce journal-ci couvre les actes d'administration, pas les
consultations. ENF-26 reste à satisfaire séparément.
