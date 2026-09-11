# Sprint 2 — Planification

Thème : frontend React
Période : … à …

## Objectif

Un agent de santé doit pouvoir se connecter, rechercher un bénéficiaire,
enregistrer une mère et un enfant, consulter un calendrier vaccinal et saisir
une dose — le tout depuis une interface utilisable sur un téléphone d'entrée
de gamme.

## Stories engagées

| Réf. | Story | Exigences | État |
|---|---|---|---|
| S2-01 | Socle React, TypeScript et Vite avec les jetons de design | — | À faire |
| S2-02 | Client d'API typé généré depuis le schéma OpenAPI | — | À faire |
| S2-03 | En tant qu'agent, je me connecte et reste authentifié | EF-01, EF-04, ENF-11 | À faire |
| S2-04 | En tant qu'agent, je consulte ma file du jour | EF-42 | À faire |
| S2-05 | En tant qu'agent, je recherche un bénéficiaire | EF-14 | À faire |
| S2-06 | En tant qu'agent, j'enregistre une mère et son consentement | EF-10, ENF-21 | À faire |
| S2-07 | En tant qu'agent, j'enregistre un enfant | EF-12 | À faire |
| S2-08 | En tant qu'agent, je consulte un calendrier vaccinal | EF-20, EF-24 | À faire |
| S2-09 | En tant qu'agent, je saisis une dose et vois les erreurs expliquées | EF-30, EF-31 | À faire |
| S2-10 | L'interface est disponible en français et en wolof | EF-70, EF-71 | À faire |

## Critères de fin de sprint

- [ ] Toutes les stories terminées au sens de la Definition of Done
- [ ] Couverture frontend ≥ 70 %
- [ ] Job frontend ajouté au pipeline et bloquant
- [ ] Aucune erreur `tsc --noEmit`
- [ ] Le parcours complet — connexion, enregistrement, calendrier, dose —
      fonctionne sur un écran de 360 px

## Risques

- Le temps passé sur l'interface au détriment du reste (R-04). Contre-mesure :
  composants shadcn/ui sans personnalisation, aucune animation.
- Le contrat d'API typé n'a jamais été mis en place. Si la génération pose
  problème, ne pas s'acharner : typer à la main les quelques réponses
  utilisées et noter la dette.
