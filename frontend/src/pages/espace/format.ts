export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatAge(jours: number): string {
  if (jours < 60) return `${jours} jours`;
  if (jours < 730) return `${Math.floor(jours / 30.4)} mois`;
  return `${Math.floor(jours / 365)} ans`;
}
