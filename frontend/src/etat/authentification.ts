import { create } from "zustand";
import { api, definirJetons, effacerJetons } from "@/api/client";
import type { Utilisateur } from "@/api/types";
import i18n from "@/i18n";
import { PERSONNEL } from "@/etat/navigation";

type ReponseConnexion = {
  access: string;
  refresh: string;
  utilisateur: Utilisateur;
};

type EtatAuthentification = {
  utilisateur: Utilisateur | null;
  connecte: boolean;
  connexion: (identifiant: string, motDePasse: string) => Promise<void>;
  deconnexion: () => void;
  definirUtilisateur: (utilisateur: Utilisateur | null) => void;
};

/**
 * L'interface professionnelle est en français (ADR 0005). Le choix de
 * langue d'une bénéficiaire ne doit pas suivre l'agent qui se connecte
 * ensuite sur le même appareil — au poste de santé, le téléphone est
 * souvent partagé.
 */
function appliquerLangue(utilisateur: Utilisateur | null): void {
  if (!utilisateur) return;
  const langue = PERSONNEL.includes(utilisateur.role)
    ? "fr"
    : (utilisateur.langue ?? "wo");
  if (i18n.resolvedLanguage !== langue) i18n.changeLanguage(langue);
}

export const useAuthentification = create<EtatAuthentification>((set) => ({
  utilisateur: null,
  connecte: false,

  connexion: async (identifiant, motDePasse) => {
    const reponse = await api.post<ReponseConnexion>("/auth/connexion/", {
      username: identifiant,
      password: motDePasse,
    });

    definirJetons(reponse.access, reponse.refresh);
    appliquerLangue(reponse.utilisateur);
    set({ utilisateur: reponse.utilisateur, connecte: true });
  },

  deconnexion: () => {
    effacerJetons();
    set({ utilisateur: null, connecte: false });
  },

    definirUtilisateur: (utilisateur) => {
    appliquerLangue(utilisateur);
    set({ utilisateur, connecte: utilisateur !== null });
  },
}));
