/**
 * Palette des graphiques, dérivée des jetons de l'identité visuelle.
 * Recharts n'accepte pas les variables CSS dans tous ses réglages, d'où
 * ces valeurs en dur — à tenir synchronisées avec `tokens.css`.
 */
export const COULEURS = {
  baobab: "#14432E",
  cuivre: "#8E4A1E",
  retard: "#8C1410",
  avenir: "#B9C4BC",
  bordure: "#D5E0D9",
  texteFaible: "#4F6659",
} as const;

/** Un taux de couverture se lit par paliers, pas en dégradé continu. */
export function couleurTaux(taux: number): string {
  if (taux >= 90) return COULEURS.baobab;
  if (taux >= 70) return "#4A7C5F";
  if (taux >= 50) return COULEURS.cuivre;
  return COULEURS.retard;
}

export function formatMois(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    month: "short",
    year: "2-digit",
  });
}
