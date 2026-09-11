import { ErreurApi } from "@/api/client";

/** Violations renvoyées par le moteur de calendrier (EF-31). */
const VIOLATIONS: Record<string, string> = {
  age_minimal_non_atteint:
    "L'enfant est trop jeune pour ce vaccin.",
  intervalle_minimal_non_respecte:
    "Le délai depuis la dose précédente est insuffisant.",
  dose_precedente_manquante:
    "La dose précédente de cette série n'a pas été administrée.",
  dose_deja_administree:
    "Cette dose a déjà été enregistrée.",
  date_future:
    "Une dose ne peut pas être enregistrée à une date future.",
};

export function messageDErreur(erreur: unknown): string {
  if (!(erreur instanceof ErreurApi)) {
    return "Impossible de joindre le serveur. Vérifiez votre connexion.";
  }

  const donnees = erreur.donnees as Record<string, unknown> | null;

  // Refus du moteur de calendrier : on explique la règle enfreinte.
  if (donnees && Array.isArray(donnees.violations)) {
    const explications = (donnees.violations as string[])
      .map((v) => VIOLATIONS[v] ?? v)
      .join(" ");
    return explications;
  }

  if (erreur.statut === 401) return "Identifiant ou mot de passe incorrect.";
  if (erreur.statut === 403) return "Vous n'avez pas les droits pour cette action.";
  if (erreur.statut === 404) return "Élément introuvable.";
  if (erreur.statut === 429) return "Trop de tentatives. Réessayez dans une minute.";
  if (erreur.statut >= 500) return "Le serveur a rencontré un problème. Réessayez.";

  // Erreurs de validation champ par champ.
  if (donnees && typeof donnees === "object") {
    const premier = Object.values(donnees)[0];
    if (Array.isArray(premier) && typeof premier[0] === "string") {
      return premier[0];
    }
    if (typeof donnees.detail === "string") return donnees.detail;
  }

  return "Une erreur est survenue.";
}

/** Erreurs par champ, pour les afficher sous les entrées concernées. */
export function erreursParChamp(erreur: unknown): Record<string, string> {
  if (!(erreur instanceof ErreurApi) || erreur.statut !== 400) return {};

  const donnees = erreur.donnees as Record<string, unknown> | null;
  if (!donnees || typeof donnees !== "object") return {};

  const resultat: Record<string, string> = {};
  for (const [champ, valeur] of Object.entries(donnees)) {
    if (Array.isArray(valeur) && typeof valeur[0] === "string") {
      resultat[champ] = valeur[0];
    }
  }
  return resultat;
}
