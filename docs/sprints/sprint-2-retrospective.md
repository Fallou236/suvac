# Sprint 2 — Rétrospective

Thème : frontend React
Période : 11/09/2026 à 19/09/2026

## Livré

Les dix stories engagées sont terminées.

- Socle Vite, React, TypeScript, Tailwind 4 avec les jetons de l'identité
- Contrat d'API typé depuis le schéma OpenAPI
- Authentification JWT, routes protégées, rafraîchissement mutualisé
- File du jour en trois sections, avec calendrier vaccinal par étape d'âge
- Écran Bénéficiaires : recherche, mères, enfants, grossesses
- Saisie de dose avec clé d'idempotence côté client
- Internationalisation, périmètre restreint et assumé
- 73 tests frontend, 82,7 % de couverture

## Ce qui a bien marché

- **Le contrat d'API typé.** Les docstrings des vues Django se retrouvent en
  commentaires côté client. Plusieurs incohérences ont été détectées à la
  compilation plutôt qu'à l'exécution.
- **Tester l'écran principal.** Les huit tests de la file du jour ont fait
  passer la couverture de 50 à 77 %, parce qu'ils exercent au passage la
  coquille, la barre latérale, la frise et le modal.
- **Les seuils de couverture.** Posés à 70 %, ils ont bloqué deux fois : après
  l'ajout des écrans bénéficiaires, puis du formulaire de grossesse. Le
  garde-fou a fait exactement ce qu'on attendait de lui.
- **La revue critique de l'interface.** Le premier rendu était vide plutôt que
  sobre. Repartir sur une disposition de poste de travail a transformé
  l'application, et l'historique Git montre cette évolution.

## Ce qui a bloqué

- **Une pull request non fusionnée, encore.** Le travail sur la coquille est
  resté sur sa branche pendant qu'une nouvelle branche partait de `main`. Une
  étape entière a été menée sur une base incomplète. C'est le troisième
  incident du même type.
- **`--ours` et `--theirs` inversés.** Pendant un `stash pop`, `--theirs`
  désigne le stash et non la branche cible. Le fichier récupéré était l'ancien.
  Retenu : désigner explicitement la branche avec
  `git checkout main -- chemin`, qui ne laisse aucune ambiguïté.
- **Commits poussés sur `main` à deux reprises**, refusés par la protection de
  branche. Le réflexe manquant est d'enchaîner `git switch main`, `git pull`
  et `git switch -c` en trois commandes, jamais la dernière seule.
- **jsdom n'implémente pas l'API `<dialog>`.** Prothèse ajoutée dans la
  configuration de test.
- **Le Python du Microsoft Store**, réglé au sprint précédent, avait laissé un
  cache `virtualenv` corrompu.
- **Erreur de vocabulaire wolof.** Le nom retenu initialement, « Sunu Ñaw »,
  reposait sur une traduction inexacte : *ñaw* signifie « coudre », pas
  « vaccination ». Corrigé après vérification, et la graphie *ñakk* validée
  par le professeur Seck.

## Limites assumées

- **`wo.json` reste partiel**, par choix de périmètre documenté en ADR 0005.
- **Le chaînage entre grossesses n'existe pas** : chaque épisode repart de
  zéro, alors qu'une femme déjà vaccinée lors d'une grossesse précédente ne
  devrait pas recommencer la série Td. Question métier à soumettre.
- **`age_limite_jours` devient une limite stricte d'administration**, ce qui
  est discutable médicalement pour certains vaccins. À valider avec le schéma
  PEV (R-08).
- **L'interface d'administration Django supprime physiquement** alors que les
  modèles prévoient une suppression logique. Dette technique.
- **La suite de tests backend approche 100 secondes.** À surveiller.

## Actions pour le sprint 3

- Après chaque fusion supposée : `git switch main`, `git pull`,
  `git log --oneline -1`, et vérifier que le commit attendu est arrivé.
- Soumettre `docs/libelles-wolof-a-valider.md` au professeur Seck.
- Ouvrir le compte Meta Business et obtenir un numéro de test WhatsApp —
  action déjà inscrite au sprint 1 et toujours en attente (R-01).
- Confronter le schéma PEV à une source officielle (R-08).
- Rendre `mypy` bloquant en CI.
