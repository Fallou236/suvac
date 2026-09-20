import { api } from "./client";
import type {
  Dose,
  EcheanceFile,
  Enfant,
  EnfantListe,
  Grossesse,
  Mere,
  MereListe,
  Page,
  Utilisateur,
} from "./types";

export type SaisieDose = {
  echeance_id: string;
  date_administration: string;
  numero_lot?: string;
  cle_idempotence: string;
  evenement_indesirable?: string;
};

export type SaisieMere = {
  prenom: string;
  nom: string;
  telephone?: string;
  langue?: string;
  village?: string;
  date_naissance?: string | null;
};

export type SaisieEnfant = {
  mere_id: string;
  prenom?: string;
  nom?: string;
  date_naissance: string;
  sexe: string;
  semaines_gestation?: number | null;
  poids_naissance_grammes?: number | null;
};

export type Synthese = {
  enfants_suivis: number;
  doses_du_mois: number;
  en_retard: number;
  perimees: number;
  couverture_globale: number;
  poste: string;
  arrete_au: string;
};

export type Couverture = {
  code: string;
  libelle: string;
  rang: number;
  attendus: number;
  administres: number;
  taux: number;
};

export type Abandon = {
  code: string;
  libelle: string;
  premiere_dose: number;
  derniere_dose: number;
  taux: number;
};

export type Activite = { mois: string; doses: number };

export type LigneRetard = {
  enfant_id: string;
  enfant: string;
  mere: string;
  telephone: string;
  village: string;
  vaccin: string;
  date_limite: string | null;
  retard_jours: number;
};

export const requetes = {
  fileDuJour: (date?: string) =>
    api.get<EcheanceFile[]>("/echeances/file-du-jour/", { date }),

  fileDuJourComplete: (date?: string) =>
    api.get<EcheanceFile[]>("/echeances/file-du-jour-complete/", { date }),

  rechercherMeres: (recherche: string) =>
    api.get<Page<MereListe>>("/meres/", { search: recherche }),

    rechercherEnfants: (recherche: string, mereId?: string) =>
    api.get<Page<EnfantListe>>("/enfants/", {
      search: recherche,
      mere: mereId,
    }),

  mere: (id: string) => api.get<Mere>(`/meres/${id}/`),

  creerMere: (saisie: SaisieMere) => api.post<Mere>("/meres/", saisie),

  creerEnfant: (saisie: SaisieEnfant) => api.post<Enfant>("/enfants/", saisie),

  creerGrossesse: (saisie: {
    mere_id: string;
    rang: number;
    date_reference: string;
    terme_estime?: string | null;
  }) => api.post<Grossesse>("/grossesses/", saisie),

  consentir: (idMere: string, canal: string) =>
    api.post(`/meres/${idMere}/consentement/`, { canal }),

  enregistrerDose: (saisie: SaisieDose) => api.post<Dose>("/doses/", saisie),

  grossessesDe: (mereId: string) =>
    api.get<Page<Grossesse>>("/grossesses/", { mere: mereId }),

  modifierProfil: (profil: {
    first_name?: string;
    last_name?: string;
    telephone?: string;
    langue?: string;
  }) => api.patch<Utilisateur>("/auth/profil/", profil),

  changerMotDePasse: (saisie: {
    ancien_mot_de_passe: string;
    nouveau_mot_de_passe: string;
  }) => api.post<void>("/auth/mot-de-passe/", saisie),

  synthese: () => api.get<Synthese>("/pilotage/synthese/"),
  couverture: () => api.get<Couverture[]>("/pilotage/couverture/"),
  abandon: () => api.get<Abandon[]>("/pilotage/abandon/"),
  activite: (mois = 12) => api.get<Activite[]>("/pilotage/activite/", { mois }),
  retards: (limite = 100) =>
    api.get<LigneRetard[]>("/pilotage/retards/", { limite }),
};
