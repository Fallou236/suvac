import { useTranslation } from "react-i18next";
import { cn } from "./cn";

const LANGUES = [
  { code: "fr", libelle: "FR", titre: "Français" },
  { code: "wo", libelle: "WO", titre: "Wolof" },
];

export function SelecteurLangue({ compact }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const active = i18n.resolvedLanguage ?? "fr";

  if (compact) return null;

  return (
    <div
      role="group"
      aria-label="Langue de l'interface"
      className="flex gap-1 rounded-md border border-white/15 p-0.5"
    >
      {LANGUES.map((langue) => (
        <button
          key={langue.code}
          onClick={() => i18n.changeLanguage(langue.code)}
          aria-pressed={active === langue.code}
          title={langue.titre}
          className={cn(
            "flex-1 rounded px-2 py-1 text-[11px] font-bold transition-colors duration-[120ms]",
            active === langue.code
              ? "bg-white/15 text-white"
              : "text-white/50 hover:text-white/80",
          )}
        >
          {langue.libelle}
        </button>
      ))}
    </div>
  );
}
