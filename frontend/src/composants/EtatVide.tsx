import type { ReactNode } from "react";

type Props = {
  titre: string;
  description?: string;
  action?: ReactNode;
};

/** Un écran vide invite à agir plutôt que de constater l'absence. */
export function EtatVide({ titre, description, action }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <svg viewBox="0 0 48 48" className="size-10 opacity-30" aria-hidden="true">
        <g transform="translate(1.5,1.5)">
          <rect width="20" height="20" rx="5" fill="#B9C4BC" />
          <rect x="25" width="20" height="20" rx="5" fill="#B9C4BC" />
          <rect y="25" width="20" height="20" rx="5" fill="#B9C4BC" />
          <rect x="26.5" y="26.5" width="17" height="17" rx="3.8" fill="none" stroke="#B9C4BC" strokeWidth="3" />
        </g>
      </svg>
      <p className="text-lg font-semibold text-texte">{titre}</p>
      {description && <p className="max-w-xs text-sm text-texte-faible">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
