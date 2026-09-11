import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type Variante = "principal" | "secondaire" | "discret" | "danger";
type Taille = "normal" | "compact";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  taille?: Taille;
  chargement?: boolean;
  children: ReactNode;
};

const VARIANTES: Record<Variante, string> = {
  principal:
    "bg-cuivre text-white hover:bg-[#7a3f19] active:bg-[#6b3715] " +
    "disabled:bg-bordure disabled:text-texte-faible",
  secondaire:
    "bg-white text-texte border border-bordure hover:bg-surface-basse " +
    "active:bg-baobab-clair",
  discret:
    "bg-transparent text-cuivre hover:bg-cuivre-clair active:bg-[#ecdccd]",
  danger: "bg-retard text-white hover:bg-[#75100d] active:bg-[#600d0b]",
};

const TAILLES: Record<Taille, string> = {
  // 48 px : l'agent travaille debout, parfois avec des gants (ENF-43).
  normal: "min-h-tactile px-5 text-base",
  compact: "min-h-[40px] px-3 text-sm",
};

export function Bouton({
  variante = "principal",
  taille = "normal",
  chargement = false,
  disabled,
  className,
  children,
  ...reste
}: Props) {
  return (
    <button
      {...reste}
      disabled={disabled || chargement}
      aria-busy={chargement || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold",
        "transition-colors duration-[120ms] ease-[cubic-bezier(0.2,0,0.2,1)]",
        "disabled:cursor-not-allowed",
        VARIANTES[variante],
        TAILLES[taille],
        className,
      )}
    >
      {chargement && <Rotateur />}
      {children}
    </button>
  );
}

function Rotateur() {
  return (
    <span
      aria-hidden="true"
      className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
