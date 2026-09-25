import type { FicheVaccin } from "@/api/requetes";
import type { StatutEcheance } from "@/api/types";
import { Pastille } from "@/composants/Pastille";
import { ExplicationVaccin } from "@/composants/ExplicationVaccin";
import { cn } from "@/composants/cn";
import { formatDate } from "./format";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
              {t("espace.dose", { rang })}
            </span>
          </p>
          {beneficiaire && (
            <p className="text-sm text-texte-faible">
              {t("espace.pour", { nom: beneficiaire })}
            </p>
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

function Precision({ statut, dateCible, dateAdministration, retardJours }) {
  const { t } = useTranslation();

  switch (statut) {
    case "administree":
      return (
        <span className="font-medium text-baobab">
          {t("statut.recuLe", { date: formatDate(dateAdministration ?? dateCible) })}
        </span>
      );
    case "en_retard":
      return (
        <span className="font-medium text-retard">
          {retardJours > 0
            ? t("statut.enRetardDepuis", {
                date: formatDate(dateCible),
                jours: retardJours,
              })
            : t("statut.aRattraper", { date: formatDate(dateCible) })}
        </span>
      );
    case "due":
      return (
        <span className="font-medium text-cuivre">
          {t("statut.aFaireMaintenant", { date: formatDate(dateCible) })}
        </span>
      );
    case "perimee":
      return <span className="text-texte-faible">{t("statut.perime")}</span>;
    case "annulee":
      return <span className="text-texte-faible">{t("statut.annule")}</span>;
    default:
      return (
        <span className="text-texte-faible">
          {t("statut.prevuLe", { date: formatDate(dateCible) })}
        </span>
      );
  }
}
