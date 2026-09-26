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
  PosteSante,
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

export type MonBeneficiaire = {
  id: string;
  nom: string;
  date_naissance?: string;
  sexe?: string;
  age_jours?: number;
  rang?: number;
  date_reference?: string;
  terme_estime?: string | null;
  statut?: string;
};

export type MonCarnet = {
  id: string;
  nom: string;
  type: "enfant" | "grossesse";
  date_reference: string;
  echeances: {
    id: string;
    vaccin: string;
    code: string;
    protege_contre: string;
    rang: number;
    date_cible: string;
    statut: string;
    age_cible_jours: number;
    date_administration: string | null;
  }[];
};

export type MonRappel = {
  id: string;
  type: string;
  statut: string;
  texte: string;
  langue: string;
  date: string;
  lu: boolean;
  beneficiaire: string;
  beneficiaire_id: string;
  vaccins: {
    code: string;
    libelle: string;
    protege_contre: string;
    rang: number;
    statut: string;
  }[];
};

export type FicheVaccin = {
  code: string;
  libelle: string;
  protege_contre: string;
  description: string;
  voie: string;
};

export type Rappel = {
  id: string;
  destinataire: string;
  telephone: string;
  village: string;
  type: string;
  type_libelle: string;
  canal: string;
  langue: string;
  statut: string;
  statut_libelle: string;
  texte: string;
  vaccins: string[];
  planifie_pour: string;
  envoye_le: string | null;
  remis_le: string | null;
  erreur: string;
  tentatives: number;
};

export type SyntheseRappels = {
  total: number;
  en_attente: number;
  envoyes: number;
  remis: number;
  lus: number;
  echecs: number;
  abandonnes: number;
  taux_remise: number;
  taux_lecture: number;
  par_canal: { canal: string; total: number; echecs: number }[];
  motifs_echec: { erreur: string; occurrences: number }[];
  periode_jours: number;
  depuis: string;
};

export type FiltresRappels = {
  statut?: string;
  canal?: string;
  type?: string;
  search?: string;
};

export type Agent = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  nom_complet: string;
  telephone: string;
  langue: string;
  role: string;
  role_libelle: string;
  poste: { id: string; nom: string; district: string; region: string } | null;
  is_active: boolean;
  doit_changer_mot_de_passe: boolean;
  derniere_connexion: string | null;
  date_joined: string;
};

export type SaisieAgent = {
  username: string;
  first_name: string;
  last_name: string;
  telephone?: string;
  role: string;
  mot_de_passe: string;
  poste_id?: string;
};

export type ActeAudit = {
  id: number;
  acte: string;
  acte_libelle: string;
  auteur_identifiant: string;
  cible_identifiant: string;
  detail: string;
  horodatage: string;
};

export type RegleVaccinale = {
  id: number;
  vaccin_code: string;
  vaccin_libelle: string;
  voie: string;
  cible: string;
  rang: number;
  age_min_jours: number;
  age_cible_jours: number;
  age_limite_jours: number | null;
  intervalle_min_jours: number | null;
  actif: boolean;
};

export type SchemaVaccinal = {
  enfant: RegleVaccinale[];
  mere: RegleVaccinale[];
  vaccins: number;
  regles: number;
  avertissement: string;
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
  }) =>
    api.post<{ access: string; refresh: string }>(
      "/auth/mot-de-passe/",
      saisie,
    ),
  synthese: () => api.get<Synthese>("/pilotage/synthese/"),
  couverture: () => api.get<Couverture[]>("/pilotage/couverture/"),
  abandon: () => api.get<Abandon[]>("/pilotage/abandon/"),
  activite: (mois = 12) => api.get<Activite[]>("/pilotage/activite/", { mois }),
  retards: (limite = 100) =>
    api.get<LigneRetard[]>("/pilotage/retards/", { limite }),

    monProfil: () => api.get<Mere>("/mon-dossier/profil/"),

  modifierMonProfil: (donnees: {
    telephone?: string;
    village?: string;
    langue?: string;
  }) => api.patch<Mere>("/mon-dossier/profil/", donnees),

  mesBeneficiaires: () =>
    api.get<{ enfants: MonBeneficiaire[]; grossesses: MonBeneficiaire[] }>(
      "/mon-dossier/beneficiaires/",
    ),

  monCarnet: (id: string) => api.get<MonCarnet>(`/mon-dossier/carnet/${id}/`),

  mesRappels: () => api.get<MonRappel[]>("/mon-dossier/rappels/"),

  ouvrirAcces: (idMere: string, identifiant: string, motDePasse: string) =>
    api.post<{ identifiant: string }>(`/meres/${idMere}/ouvrir-acces/`, {
      identifiant,
      mot_de_passe: motDePasse,
    }),

  fermerAcces: (idMere: string) =>
    api.post<void>(`/meres/${idMere}/fermer-acces/`),

  vaccins: () => api.get<FicheVaccin[]>("/vaccins/"),

  rappels: (filtres: FiltresRappels = {}) =>
    api.get<Page<Rappel>>("/rappels/", filtres),

  syntheseRappels: (jours = 30) =>
    api.get<SyntheseRappels>("/rappels/synthese/", { jours }),

    marquerRappelsLus: () => api.post<void>("/mon-dossier/rappels/"),

  monRappel: (id: string) => api.get<MonRappel>(`/mon-dossier/rappels/${id}/`),

    agents: (actifs?: boolean) =>
    api.get<Page<Agent>>("/agents/", { actifs: actifs ? "true" : undefined }),

  creerAgent: (saisie: SaisieAgent) => api.post<Agent>("/agents/", saisie),

  reinitialiserAgent: (id: string, motDePasse: string) =>
    api.post<void>(`/agents/${id}/reinitialiser/`, { mot_de_passe: motDePasse }),

  transfererAgent: (id: string, posteId: string) =>
    api.post<Agent>(`/agents/${id}/transferer/`, { poste_id: posteId }),

  basculerActivation: (id: string) =>
    api.post<Agent>(`/agents/${id}/basculer-activation/`),

  postes: () => api.get<Page<PosteSante>>("/postes/"),

  audit: () => api.get<ActeAudit[]>("/audit/"),

  schemaVaccinal: () => api.get<SchemaVaccinal>("/schema-vaccinal/"),
};
