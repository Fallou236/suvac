import type { Echeance, StatutEcheance } from "@/api/types";
import { cn } from "./cn";

type Props = {
  echeances: Echeance[];
  compacte?: boolean;
};

const COULEURS: Record<StatutEcheance, string> = {
  administree: "bg-baobab border-baobab",
  due: "bg-white border-cuivre border-2",
  en_retard: "bg-retard border-retard",
  a_venir: "bg-white border-avenir",
  annulee: "bg-annule/20 border-annule/40",
};

/** Étapes du calendrier PEV, en jours depuis la date de référence. */
const ETAPES = [
  { seuil: 7, libelle: "Naissance" },
  { seuil: 49, libelle: "6 semaines" },
  { seuil: 77, libelle: "10 semaines" },
  { seuil: 112, libelle: "14 semaines" },
  { seuil: 200, libelle: "6 mois" },
  { seuil: 320, libelle: "9 mois" },
  { seuil: 500, libelle: "15 mois" },
  { seuil: Infinity, libelle: "Plus tard" },
];

type Etape = { libelle: string; echeances: Echeance[] };

function regrouperParAge(echeances: Echeance[]): Etape[] {
  const paniers = new Map<string, Echeance[]>();

  for (const echeance of echeances) {
    const age = echeance.age_cible_jours ?? 0;
    const etape = ETAPES.find((e) => age <= e.seuil) ?? ETAPES[ETAPES.length - 1];
    const panier = paniers.get(etape.libelle) ?? [];
    panier.push(echeance);
    paniers.set(etape.libelle, panier);
  }

  return ETAPES.filter((e) => paniers.has(e.libelle)).map((e) => ({
    libelle: e.libelle,
    echeances: paniers.get(e.libelle)!,
  }));
}

export function Frise({ echeances, compacte = false }: Props) {
  if (compacte) return <FriseCompacte echeances={echeances} />;

  const etapes = regrouperParAge(echeances);

  return (
    <div className="flex flex-wrap gap-x-7 gap-y-5">
      {etapes.map((etape) => (
        <div key={etape.libelle} className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-texte-faible">
            {etape.libelle}
          </span>
          <div className="flex gap-1.5">
            {etape.echeances.map((e) => (
              <Case key={e.id} echeance={e} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Case({ echeance }: { echeance: Echeance }) {
  const enRetard = echeance.statut === "en_retard";

  return (
    <div className="flex w-[46px] flex-col items-center gap-1">
      <span
        title={`${echeance.vaccin_libelle} — dose ${echeance.rang}`}
        className={cn(
          "grid h-9 w-full place-items-center rounded border",
          COULEURS[echeance.statut as StatutEcheance],
        )}
      >
        {echeance.statut === "administree" && (
          <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {enRetard && (
          <span className="text-[11px] font-bold text-white">!</span>
        )}
      </span>
      <span className="tabulaire text-center text-[10px] leading-tight text-texte-faible">
        {echeance.vaccin_code}
        <span className="opacity-55">-{echeance.rang}</span>
      </span>
    </div>
  );
}

function FriseCompacte({ echeances }: { echeances: Echeance[] }) {
  const faites = echeances.filter((e) => e.statut === "administree").length;
  const retards = echeances.filter((e) => e.statut === "en_retard").length;

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-[3px]">
        {echeances.map((e) => (
          <span
            key={e.id}
            title={`${e.vaccin_code}-${e.rang}`}
            className={cn(
              "size-2.5 rounded-[2px] border",
              COULEURS[e.statut as StatutEcheance],
            )}
          />
        ))}
      </div>
      <span className="tabulaire shrink-0 text-xs font-medium text-texte-faible">
        {faites}/{echeances.length}
        {retards > 0 && (
          <span className="ml-1 font-semibold text-retard">· {retards} en retard</span>
        )}
      </span>
    </div>
  );
}
