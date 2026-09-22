import type { FicheVaccin } from "@/api/requetes";
import type { StatutEcheance } from "@/api/types";
import { Pastille } from "@/composants/Pastille";
import { ExplicationVaccin } from "@/composants/ExplicationVaccin";
import { cn } from "@/composants/cn";
import { formatDate } from "./format";

type Props = {
  vaccin: string;
  rang: number;
  statut: string;
  dateCible: string;
  dateAdministration?: string | null;
  retardJours?: number;
  beneficiaire?: string;
  fiche?: FicheVaccin;
};

export function LigneVaccin({
  vaccin,
  rang,
  statut,
  dateCible,
  dateAdministration,
  retardJours = 0,
  beneficiaire,
  fiche,
}: Props) {
  const enRetard = statut === "en_retard";
  const perimee = statut === "perimee";

  return (
    <li
      className={cn(
        "rounded-lg border px-4 py-3",
        enRetard ? "border-retard/25 bg-retard-fond" : "border-bordure bg-white",
        perimee && "bg-surface-basse",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">
          <Pastille statut={statut as StatutEcheance} taille="grand" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-texte">
            {vaccin}
            <span className="ml-1.5 text-sm font-normal text-texte-faible">
              dose {rang}
            </span>
          </p>
          {beneficiaire && (
            <p className="text-sm text-texte-faible">pour {beneficiaire}</p>
          )}
          <p className="tabulaire mt-0.5 text-sm">
            <Precision
              statut={statut}
              dateCible={dateCible}
              dateAdministration={dateAdministration}
              retardJours={retardJours}
            />
          </p>
        </div>
      </div>

      <ExplicationVaccin fiche={fiche} />
    </li>
  );
}

function Precision({
  statut,
  dateCible,
  dateAdministration,
  retardJours,
}: {
  statut: string;
  dateCible: string;
  dateAdministration?: string | null;
  retardJours: number;
}) {
  switch (statut) {
    case "administree":
      return (
        <span className="font-medium text-baobab">
          Reçu le {formatDate(dateAdministration ?? dateCible)}
        </span>
      );
    case "en_retard":
      return (
        <span className="font-medium text-retard">
          Prévu le {formatDate(dateCible)}
          {retardJours > 0
            ? ` — ${retardJours} jours de retard`
            : " — à rattraper dès que possible"}
        </span>
      );
    case "due":
      return (
        <span className="font-medium text-cuivre">
          À faire maintenant — prévu le {formatDate(dateCible)}
        </span>
      );
    case "perimee":
      return (
        <span className="text-texte-faible">
          Ne peut plus être administré : l'âge limite est dépassé
        </span>
      );
    case "annulee":
      return <span className="text-texte-faible">Annulé</span>;
    default:
      return (
        <span className="text-texte-faible">Prévu le {formatDate(dateCible)}</span>
      );
  }
}
