import { create } from "zustand";
import { api, definirJetons, effacerJetons } from "@/api/client";
import type { Utilisateur } from "@/api/types";

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

export const useAuthentification = create<EtatAuthentification>((set) => ({
  utilisateur: null,
  connecte: false,

  connexion: async (identifiant, motDePasse) => {
    const reponse = await api.post<ReponseConnexion>("/auth/connexion/", {
      username: identifiant,
      password: motDePasse,
    });

    definirJetons(reponse.access, reponse.refresh);
    set({ utilisateur: reponse.utilisateur, connecte: true });
  },

  deconnexion: () => {
    effacerJetons();
    set({ utilisateur: null, connecte: false });
  },

  definirUtilisateur: (utilisateur) =>
    set({ utilisateur, connecte: utilisateur !== null }),
}));
