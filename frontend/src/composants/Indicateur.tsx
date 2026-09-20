import type { ReactNode } from "react";
import { cn } from "./cn";

type Ton = "neutre" | "accent" | "alerte" | "succes";

const TONS: Record<Ton, { bordure: string; valeur: string }> = {
  neutre: { bordure: "border-bordure bg-white", valeur: "text-baobab" },
  accent: { bordure: "border-cuivre/25 bg-cuivre-clair", valeur: "text-cuivre" },
  alerte: { bordure: "border-retard/25 bg-retard-fond", valeur: "text-retard" },
  succes: { bordure: "border-baobab/20 bg-baobab-clair", valeur: "text-baobab" },
};

type Props = {
  libelle: string;
  valeur: string | number;
  unite?: string;
  precision?: string;
  ton?: Ton;
  icone?: ReactNode;
};

export function Indicateur({
  libelle,
  valeur,
  unite,
  precision,
  ton = "neutre",
  icone,
}: Props) {
  const style = TONS[ton];

  return (
    <div className={cn("rounded-lg border p-4", style.bordure)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-texte-faible">
          {libelle}
        </p>
        {icone && <span className="shrink-0 text-texte-faible/50">{icone}</span>}
      </div>

      <p className={cn("tabulaire mt-2 text-3xl font-bold leading-none", style.valeur)}>
        {valeur}
        {unite && <span className="ml-0.5 text-lg font-semibold">{unite}</span>}
      </p>

      {precision && (
        <p className="mt-1.5 text-xs text-texte-faible">{precision}</p>
      )}
    </div>
  );
}
