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
};
