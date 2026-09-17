import { useEffect, useState } from "react";

type Props = {
  valeur: string;
  onChanger: (valeur: string) => void;
  placeholder?: string;
};

/**
 * Champ de recherche avec temporisation : sans elle, chaque frappe
 * déclencherait une requête. Sur une connexion lente, taper « Ndiaye »
 * en enverrait six.
 */
export function Recherche({ valeur, onChanger, placeholder }: Props) {
  const [saisie, setSaisie] = useState(valeur);

  useEffect(() => {
    const minuterie = setTimeout(() => onChanger(saisie), 300);
    return () => clearTimeout(minuterie);
  }, [saisie, onChanger]);

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texte-faible"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
        </svg>
      </span>

      <input
        type="search"
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        placeholder={placeholder ?? "Rechercher…"}
        aria-label={placeholder ?? "Rechercher"}
        className="min-h-[38px] w-full rounded-md border border-bordure bg-white pl-9 pr-3 text-sm text-texte transition-colors duration-[120ms] placeholder:text-texte-faible focus:border-cuivre"
      />
    </div>
  );
}
