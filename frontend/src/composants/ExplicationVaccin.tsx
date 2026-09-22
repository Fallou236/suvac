import { Link } from "react-router-dom";
import type { FicheVaccin } from "@/api/requetes";

/**
 * Explication dépliable, placée sous chaque vaccin du carnet et de chaque
 * message. Repliée par défaut pour ne pas noyer le calendrier ; un geste
 * suffit pour comprendre à quoi sert le vaccin.
 *
 * L'élément <details> natif gère l'ouverture, le clavier et l'annonce aux
 * lecteurs d'écran sans une ligne de JavaScript.
 */
export function ExplicationVaccin({
  fiche,
  ouvert = false,
}: {
  fiche?: FicheVaccin;
  ouvert?: boolean;
}) {
  if (!fiche?.description) return null;

  return (
    <details
      open={ouvert}
      className="group mt-2 rounded-md border border-bordure bg-surface-basse"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-cuivre [&::-webkit-details-marker]:hidden">
        <span>Pourquoi ce vaccin ?</span>
        <svg
          viewBox="0 0 24 24"
          className="size-4 shrink-0 transition-transform duration-[120ms] group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <div className="border-t border-bordure px-3 py-3 text-sm leading-relaxed text-texte">
        {fiche.protege_contre && (
          <p className="mb-2 font-semibold text-baobab">
            Protège contre {fiche.protege_contre}.
          </p>
        )}
        {fiche.description.split("\n\n").map((paragraphe, index) => (
          <p key={index} className="mt-2 first:mt-0">
            {paragraphe}
          </p>
        ))}
        <Link
          to={`/vaccins?code=${fiche.code}`}
          className="mt-3 inline-block text-sm font-medium text-cuivre underline-offset-2 hover:underline"
        >
          Voir la fiche complète
        </Link>
      </div>
    </details>
  );
}
