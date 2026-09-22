/** Rôles du personnel soignant : accès aux écrans professionnels. */
export const PERSONNEL = ["agent", "superviseur", "admin"];

/** Page d'arrivée selon le rôle, après connexion ou refus d'accès. */
export function accueilPour(role?: string): string {
  return role === "beneficiaire" ? "/mon-espace" : "/";
}
