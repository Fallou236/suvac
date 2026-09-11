import type { components } from "./genere";

type S = components["schemas"];

export type Utilisateur = S["Utilisateur"];
export type PosteSante = S["PosteSante"];
export type Mere = S["Mere"];
export type MereListe = S["MereListe"];
export type Enfant = S["Enfant"];
export type EnfantListe = S["EnfantListe"];
export type Grossesse = S["Grossesse"];
export type Echeance = S["Echeance"];
export type EcheanceFile = S["EcheanceFile"];
export type Dose = S["Dose"];

export type Page<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type StatutEcheance =
  | "a_venir"
  | "due"
  | "en_retard"
  | "administree"
  | "annulee";

export type MereRequest = S["MereRequest"];
export type EnfantRequest = S["EnfantRequest"];
export type GrossesseRequest = S["GrossesseRequest"];
export type CreationDoseRequest = S["CreationDoseRequest"];
