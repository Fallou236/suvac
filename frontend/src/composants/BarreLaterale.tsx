import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { SelecteurLangue } from "./SelecteurLangue";
import { cn } from "./cn";
import { useAuthentification } from "@/etat/authentification";
import { useQuery } from "@tanstack/react-query";
import { requetes } from "@/api/requetes";
import { PERSONNEL } from "@/etat/navigation";

type Entree = {
  vers: string;
  cle: string;
  icone: ReactNode;
  roles?: string[];
  compteur?: "rappels";
};

const ENTREES: Entree[] = [
  { vers: "/", cle: "navigation.fileDuJour", icone: <IconeFile />, roles: PERSONNEL },
  {
    vers: "/beneficiaires",
    cle: "navigation.beneficiaires",
    icone: <IconePersonnes />,
    roles: PERSONNEL,
  },
  {
    vers: "/pilotage",
    cle: "navigation.pilotage",
    icone: <IconeGraphique />,
    roles: ["superviseur", "admin"],
  },
  {
    vers: "/rappels",
    cle: "navigation.rappels",
    icone: <IconeEnvoi />,
    roles: ["superviseur", "admin"],
  },
  {
    vers: "/mon-espace",
    cle: "navigation.aujourdhui",
    icone: <IconeCalendrier />,
    roles: ["beneficiaire"],
  },
  {
    vers: "/mon-espace/carnets",
    cle: "navigation.carnets",
    icone: <IconeCarnet />,
    roles: ["beneficiaire"],
  },
  {
    vers: "/mon-espace/messages",
    cle: "navigation.messages",
    icone: <IconeMessage />,
    roles: ["beneficiaire"],
    compteur: "rappels",
  },
  { vers: "/vaccins", cle: "navigation.vaccins", icone: <IconeBouclier /> },
  { vers: "/parametres", cle: "navigation.parametres", icone: <IconeReglages /> },
];

/** Routes dont les sous-pages ont leur propre entrée : activation exacte. */
const EXACTES = new Set(["/", "/mon-espace"]);

export function BarreLaterale({
  ouverte,
  repliee,
  onFermer,
}: {
  ouverte: boolean;
  repliee: boolean;
  onFermer: () => void;
}) {
  const { t } = useTranslation();
  const utilisateur = useAuthentification((e) => e.utilisateur);
  const deconnexion = useAuthentification((e) => e.deconnexion);
  const estBeneficiaire = utilisateur?.role === "beneficiaire";

  // Le compteur de messages n'est chargé que pour une bénéficiaire.
  const { data: rappels } = useQuery({
    queryKey: ["mon-dossier", "rappels"],
    queryFn: requetes.mesRappels,
    enabled: estBeneficiaire,
  });

  const nombreRappels = (rappels ?? []).filter((r) => !r.lu).length;

  const entrees = ENTREES.filter(
    (e) => !e.roles || (utilisateur && e.roles.includes(utilisateur.role)),
  );

  return (
    <>
      {ouverte && (
        <button
          onClick={onFermer}
          aria-label={t("navigation.fermerMenu")}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-baobab",
          "transition-[transform,width] duration-[200ms] ease-[cubic-bezier(0.2,0,0.2,1)]",
          "lg:static lg:translate-x-0",
          ouverte ? "translate-x-0" : "-translate-x-full",
          repliee ? "w-laterale lg:w-[60px]" : "w-laterale",
        )}
      >
        <div className="flex h-barre shrink-0 items-center gap-2.5 overflow-hidden border-b border-white/10 px-4">
          <Logo taille={22} />
          {!repliee && (
            <span className="whitespace-nowrap text-[15px] font-bold tracking-wide text-white">
              SUVAC
            </span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="flex flex-col gap-0.5">
            {entrees.map((entree) => (
              <li key={entree.vers}>
                <NavLink
                  to={entree.vers}
                  end={EXACTES.has(entree.vers)}
                  onClick={onFermer}
                  title={repliee ? t(entree.cle) : undefined}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 overflow-hidden rounded-md px-3 py-2",
                      "text-sm font-medium transition-colors duration-[120ms]",
                      isActive
                        ? "bg-white/12 text-white"
                        : "text-white/65 hover:bg-white/6 hover:text-white",
                    )
                  }
                >
                  <span className="relative grid size-5 shrink-0 place-items-center">
                    {entree.icone}
                    {entree.compteur && nombreRappels > 0 && repliee && (
                      <span
                        aria-hidden="true"
                        className="absolute -right-1 -top-1 size-2 rounded-full bg-cuivre-lumiere"
                      />
                    )}
                  </span>
                  {!repliee && (
                    <>
                      <span className="flex-1 whitespace-nowrap">{t(entree.cle)}</span>
                      {entree.compteur && nombreRappels > 0 && (
                        <span
                          className="tabulaire grid min-w-5 place-items-center rounded-full bg-cuivre-lumiere px-1.5 text-[11px] font-bold text-baobab-fonce"
                          aria-label={`${nombreRappels} message${nombreRappels > 1 ? "s" : ""}`}
                        >
                          {nombreRappels}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="shrink-0 overflow-hidden border-t border-white/10 p-3">
          {repliee ? (
            <button
              onClick={deconnexion}
              aria-label={t("navigation.deconnexion")}
              title={t("navigation.deconnexion")}
              className="grid size-9 place-items-center rounded-md text-white/65 transition-colors duration-[120ms] hover:bg-white/10 hover:text-white"
            >
              <IconeSortie />
            </button>
          ) : (
            <>
              <p className="truncate text-sm font-medium text-white">
                {utilisateur?.nom_complet ?? "—"}
              </p>
              <p className="truncate text-xs text-white/55">
                {estBeneficiaire
                  ? "Espace personnel"
                  : utilisateur?.poste?.nom ?? t("navigation.aucunPoste")}
              </p>

              {/* L'interface professionnelle reste en français : c'est la
                  langue de l'administration sanitaire, des formulaires du
                  PEV et du carnet. Voir ADR 0005. */}
              {estBeneficiaire && (
                <div className="mt-2">
                  <SelecteurLangue />
                </div>
              )}


              <button
                onClick={deconnexion}
                className="mt-2 w-full rounded-md border border-white/15 py-1.5 text-xs font-medium text-white/70 transition-colors duration-[120ms] hover:border-white/30 hover:text-white"
              >
                {t("navigation.deconnexion")}
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

/* ---- icônes, trait de 1.75 pour rester lisible à 20 px ---- */

function IconeFile() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
    </svg>
  );
}

function IconePersonnes() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
    </svg>
  );
}

function IconeGraphique() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M3 3v18h18" strokeLinecap="round" />
      <path d="M7 15l4-5 3 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeSortie() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeReglages() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeCalendrier() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconeCarnet() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z" strokeLinejoin="round" />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" strokeLinejoin="round" />
      <path d="M9 8h7M9 12h5" strokeLinecap="round" />
    </svg>
  );
}

function IconeMessage() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconeBouclier() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeEnvoi() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
