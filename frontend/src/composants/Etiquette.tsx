import type { ReactNode } from "react";
import { cn } from "./cn";

type Ton = "neutre" | "accent" | "alerte" | "succes";

const TONS: Record<Ton, string> = {
  neutre: "bg-surface-basse text-texte-faible border-bordure",
  accent: "bg-cuivre-clair text-cuivre border-cuivre/25",
  alerte: "bg-retard-fond text-retard border-retard/25",
  succes: "bg-baobab-clair text-baobab border-baobab/20",
};

export function Etiquette({
  ton = "neutre",
  children,
}: {
  ton?: Ton;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "tabulaire inline-flex items-center gap-1 rounded border px-1.5 py-0.5",
        "text-[11px] font-semibold leading-none",
        TONS[ton],
      )}
    >
      {children}
    </span>
  );
}
