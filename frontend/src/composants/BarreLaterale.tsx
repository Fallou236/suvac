import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { SelecteurLangue } from "./SelecteurLangue";
import { cn } from "./cn";
import { useAuthentification } from "@/etat/authentification";

type Entree = {
  vers: string;
  cle: string;
  icone: ReactNode;
  roles?: string[];
};

const ENTREES: Entree[] = [
  { vers: "/", cle: "navigation.fileDuJour", icone: <IconeFile /> },
  {
    vers: "/beneficiaires",
    cle: "navigation.beneficiaires",
    icone: <IconePersonnes />,
  },
  {
    vers: "/pilotage",
    cle: "navigation.pilotage",
    icone: <IconeGraphique />,
    roles: ["superviseur", "admin"],
  },
];

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
                  end={entree.vers === "/"}
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
                  <span className="grid size-5 shrink-0 place-items-center">
                    {entree.icone}
                  </span>
                  {!repliee && (
                    <span className="whitespace-nowrap">{t(entree.cle)}</span>
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
                {utilisateur?.poste?.nom ?? t("navigation.aucunPoste")}
              </p>

              <div className="mt-2">
                <SelecteurLangue />
              </div>

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
