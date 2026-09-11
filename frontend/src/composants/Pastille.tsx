import type { StatutEcheance } from "@/api/types";

type Props = {
  statut: StatutEcheance;
  taille?: "normal" | "grand";
};

const LIBELLES: Record<StatutEcheance, string> = {
  a_venir: "À venir",
  due: "Due",
  en_retard: "En retard",
  administree: "Administrée",
  annulee: "Annulée",
};

/**
 * La couleur ne porte jamais l'information seule (ENF-41) :
 *   administrée → disque plein
 *   à venir     → cercle vide
 *   due         → disque plein cerclé de cuivre
 *   en retard   → disque plein + point d'exclamation
 *   annulée     → disque barré
 */
export function Pastille({ statut, taille = "normal" }: Props) {
  const d = taille === "grand" ? 28 : 20;

  return (
    <span
      role="img"
      aria-label={LIBELLES[statut]}
      title={LIBELLES[statut]}
      className="inline-flex shrink-0"
    >
      <svg width={d} height={d} viewBox="0 0 28 28" aria-hidden="true">
        {statut === "a_venir" && (
          <circle cx="14" cy="14" r="9" fill="none" stroke="#B9C4BC" strokeWidth="2.5" />
        )}

        {statut === "administree" && <circle cx="14" cy="14" r="10" fill="#14432E" />}

        {statut === "due" && (
          <>
            <circle cx="14" cy="14" r="12.5" fill="none" stroke="#8E4A1E" strokeWidth="2.5" />
            <circle cx="14" cy="14" r="8" fill="#14432E" />
          </>
        )}

        {statut === "en_retard" && (
          <>
            <circle cx="14" cy="14" r="10" fill="#8C1410" />
            <rect x="12.6" y="8" width="2.8" height="7" rx="1.4" fill="#fff" />
            <circle cx="14" cy="18.5" r="1.7" fill="#fff" />
          </>
        )}

        {statut === "annulee" && (
          <>
            <circle cx="14" cy="14" r="9" fill="none" stroke="#6B7A82" strokeWidth="2.5" />
            <line x1="7" y1="21" x2="21" y2="7" stroke="#6B7A82" strokeWidth="2.5" />
          </>
        )}
        </svg>
      <span className="sr-only">{LIBELLES[statut]}</span>
    </span>
  );
}
