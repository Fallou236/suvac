import { api } from "./client";
import type { Dose, EcheanceFile, MereListe, EnfantListe, Page } from "./types";

export type SaisieDose = {
  echeance_id: string;
  date_administration: string;
  numero_lot?: string;
  cle_idempotence: string;
  evenement_indesirable?: string;
};

export const requetes = {
  fileDuJour: (date?: string) =>
    api.get<EcheanceFile[]>("/echeances/file-du-jour/", { date }),

  fileDuJourComplete: (date?: string) =>
    api.get<EcheanceFile[]>("/echeances/file-du-jour-complete/", { date }),

  rechercherMeres: (recherche: string) =>
    api.get<Page<MereListe>>("/meres/", { search: recherche }),

  rechercherEnfants: (recherche: string) =>
    api.get<Page<EnfantListe>>("/enfants/", { search: recherche }),

  enregistrerDose: (saisie: SaisieDose) => api.post<Dose>("/doses/", saisie),
};
