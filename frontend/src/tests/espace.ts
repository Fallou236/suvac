import { useAuthentification } from "@/etat/authentification";
import { serveur, http, HttpResponse } from "./serveur";

export function connecterMere() {
  useAuthentification.getState().definirUtilisateur({
    id: "m1",
    username: "rokh.ba",
    first_name: "Rokhaya",
    last_name: "Ba",
    nom_complet: "Rokhaya Ba",
    role: "beneficiaire",
    poste: null,
    langue: "fr",
    telephone: "",
  } as never);
}

export const FICHES = [
  {
    code: "BCG",
    libelle: "BCG",
    protege_contre: "la tuberculose",
    description: "Premier paragraphe du BCG.\n\nSecond paragraphe du BCG.",
    voie: "intradermique",
  },
  {
    code: "VPO",
    libelle: "Polio oral",
    protege_contre: "la poliomyélite",
    description: "La polio peut paralyser.",
    voie: "orale",
  },
  {
    code: "PENTA",
    libelle: "Pentavalent",
    protege_contre: "cinq maladies à la fois",
    description: "Trois doses sont nécessaires.",
    voie: "intramusculaire",
  },
  {
    code: "ROTA",
    libelle: "Rotavirus",
    protege_contre: "les diarrhées sévères",
    description: "À donner tôt.",
    voie: "orale",
  },
  {
    code: "TD",
    libelle: "Antitétanique",
    protege_contre: "le tétanos, pour vous et votre bébé",
    description: "Protège aussi le nouveau-né.",
    voie: "intramusculaire",
  },
];

export const RAPPELS = [
  {
    id: "r1",
    beneficiaire: "Sokhna Ba",
    beneficiaire_id: "e1",
    vaccin: "Polio oral",
    code: "VPO",
    protege_contre: "la poliomyélite",
    rang: 1,
    date_cible: "2026-07-05",
    statut: "en_retard",
    retard_jours: 0,
    poste: "Poste de Santé de Ndondol",
  },
  {
    id: "r2",
    beneficiaire: "Rokhaya Ba",
    beneficiaire_id: "g1",
    vaccin: "Antitétanique",
    code: "TD",
    protege_contre: "le tétanos, pour vous et votre bébé",
    rang: 1,
    date_cible: "2026-08-20",
    statut: "due",
    retard_jours: 0,
    poste: "Poste de Santé de Ndondol",
  },
];

export const BENEFICIAIRES = {
  enfants: [
    {
      id: "e1",
      nom: "Sokhna Ba",
      date_naissance: "2026-07-05",
      sexe: "F",
      age_jours: 79,
    },
  ],
  grossesses: [
    {
      id: "g1",
      rang: 2,
      date_reference: "2026-08-20",
      terme_estime: "2027-03-01",
      statut: "en_cours",
    },
  ],
};

export const CARNETS: Record<string, unknown> = {
  e1: {
    id: "e1",
    nom: "Sokhna Ba",
    type: "enfant",
    date_reference: "2026-07-05",
    echeances: [
      {
        id: "x1", vaccin: "BCG", code: "BCG", protege_contre: "la tuberculose",
        rang: 1, date_cible: "2026-07-05", statut: "administree",
        age_cible_jours: 0, date_administration: "2026-07-05",
      },
      {
        id: "x2", vaccin: "Polio oral", code: "VPO", protege_contre: "la poliomyélite",
        rang: 1, date_cible: "2026-07-05", statut: "en_retard",
        age_cible_jours: 0, date_administration: null,
      },
      {
        id: "x3", vaccin: "Pentavalent", code: "PENTA", protege_contre: "cinq maladies",
        rang: 1, date_cible: "2026-10-28", statut: "a_venir",
        age_cible_jours: 42, date_administration: null,
      },
      {
        id: "x4", vaccin: "Rotavirus", code: "ROTA", protege_contre: "les diarrhées",
        rang: 1, date_cible: "2026-08-16", statut: "perimee",
        age_cible_jours: 42, date_administration: null,
      },
    ],
  },
  g1: {
    id: "g1",
    nom: "Rokhaya Ba",
    type: "grossesse",
    date_reference: "2026-08-20",
    echeances: [
      {
        id: "y1", vaccin: "Antitétanique", code: "TD", protege_contre: "le tétanos",
        rang: 1, date_cible: "2026-08-20", statut: "due",
        age_cible_jours: 0, date_administration: null,
      },
      {
        id: "y2", vaccin: "Antitétanique", code: "TD", protege_contre: "le tétanos",
        rang: 2, date_cible: "2026-10-18", statut: "a_venir",
        age_cible_jours: 59, date_administration: null,
      },
    ],
  },
};

/**
 * Sert toutes les routes de l'espace. La barre latérale charge les rappels
 * pour son compteur : sans ce simulateur, chaque test échouerait sur une
 * requête non interceptée.
 */
export function servirEspace({ rappels = RAPPELS } = {}) {
  serveur.use(
    http.get("/api/mon-dossier/rappels/", () => HttpResponse.json(rappels)),
    http.get("/api/mon-dossier/beneficiaires/", () =>
      HttpResponse.json(BENEFICIAIRES),
    ),
    http.get("/api/mon-dossier/carnet/:id/", ({ params }) =>
      HttpResponse.json(CARNETS[params.id as string]),
    ),
    http.get("/api/vaccins/", () => HttpResponse.json(FICHES)),
  );
}
