# Sprint 1 — Planification

Thème : backend métier et API
Période : … à …

## Note sur ce document

Ce document est rédigé en cours de sprint et non à son ouverture. L'écart est
consigné plutôt que masqué : la première partie du sprint a été menée sans
objectif formalisé, ce qui a d'ailleurs conduit au débordement de périmètre
décrit plus bas.

## Objectif

Disposer d'un backend complet et testé : un agent doit pouvoir enregistrer un
bénéficiaire, voir son calendrier vaccinal se générer automatiquement, et
saisir une dose que le système valide puis répercute sur les échéances
suivantes.

## Écart avec le découpage initial

Le cahier des charges prévoyait un sprint 1 « Socle » avec les écrans de base,
et un sprint 2 « Cœur métier » portant le moteur de calendrier. La réalité a
inversé cet ordre : le moteur a été construit dès le sprint 1, et le frontend
reporté.

La raison est que le moteur ne dépend de rien alors que tout dépend de lui —
l'API comme les écrans. Le construire en premier, isolé et testable sans base
de données, a permis de le couvrir exhaustivement avant que quoi que ce soit
ne s'appuie dessus.

Le découpage des sprints est révisé en conséquence (avenant à la section 13.3) :

| Sprint | Thème révisé |
|---|---|
| 1 | Backend métier et API |
| 2 | Frontend React |
| 3 | Communication : Celery, audio wolof, WhatsApp |
| 4 | Hors ligne et pilotage |
| 5 | Consolidation |

## Stories engagées

| Réf. | Story | Exigences | État |
|---|---|---|---|
| S1-01 | En tant qu'agent, je m'authentifie pour accéder à l'application | EF-01, EF-04 | Fait |
| S1-02 | En tant qu'agent, je n'accède qu'aux données de mon poste | EF-02, EF-03 | Fait |
| S1-03 | En tant qu'administrateur, je paramètre le schéma vaccinal sans redéploiement | EF-25 | Fait |
| S1-04 | En tant qu'agent, j'enregistre une mère et recueille son consentement | EF-10, ENF-21 | Fait |
| S1-05 | En tant qu'agent, j'enregistre un enfant et son calendrier se génère | EF-12, EF-20 | Fait |
| S1-06 | En tant qu'agent, j'enregistre une grossesse et son calendrier antitétanique | EF-11, EF-21 | Fait |
| S1-07 | En tant qu'agent, je recherche un bénéficiaire | EF-14 | Fait |
| S1-08 | En tant qu'agent, je consulte le calendrier d'un enfant | EF-22, EF-24 | En cours |
| S1-09 | En tant qu'agent, j'enregistre une dose et le système la valide | EF-30, EF-31 | En cours |
| S1-10 | En tant qu'agent, je consulte ma file du jour | EF-42 | En cours |
| S1-11 | En tant qu'agent, j'annule une échéance avec motif | EF-27 | En cours |

## Critères de fin de sprint

- [ ] Toutes les stories ci-dessus sont terminées au sens de la Definition of Done
- [ ] Les neuf cas de test du moteur de calendrier (section 11.3) passent
- [ ] Couverture backend ≥ 80 %
- [ ] Pipeline vert sur `main`
- [ ] Schéma OpenAPI complet, consultable via Swagger

## Risques identifiés en cours de sprint

- R-08 reste ouvert : le schéma PEV chargé est une reconstitution, non validé
  par une source officielle. Bloquant avant toute démonstration crédible.
- Les libellés wolof des vaccins sont vides. Ils alimenteront les messages
  vocaux du sprint 3 : à faire renseigner par un locuteur natif d'ici là.
