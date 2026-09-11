import { api } from "./client";
import type { EcheanceFile, MereListe, EnfantListe, Page } from "./types";

export const requetes = {
  fileDuJour: (date?: string) =>
    api.get<EcheanceFile[]>("/echeances/file-du-jour/", { date }),

  rechercherMeres: (recherche: string) =>
    api.get<Page<MereListe>>("/meres/", { search: recherche }),

  rechercherEnfants: (recherche: string) =>
    api.get<Page<EnfantListe>>("/enfants/", { search: recherche }),
};
