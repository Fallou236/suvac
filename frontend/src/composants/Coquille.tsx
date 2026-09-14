import { useEffect, useState, type ReactNode } from "react";
import { BarreLaterale } from "./BarreLaterale";
import { Logo } from "./Logo";

type Props = {
  titre: string;
  actions?: ReactNode;
  children: ReactNode;
};

const CLE_REPLIEE = "suvac.laterale.repliee";

export function Coquille({ titre, actions, children }: Props) {
  const [menuMobile, setMenuMobile] = useState(false);
  const [repliee, setRepliee] = useState(
    () => sessionStorage.getItem(CLE_REPLIEE) === "1",
  );

  useEffect(() => {
    sessionStorage.setItem(CLE_REPLIEE, repliee ? "1" : "0");
  }, [repliee]);

  return (
    <div className="flex h-dvh overflow-hidden bg-surface-basse">
      <BarreLaterale
        ouverte={menuMobile}
        repliee={repliee}
        onFermer={() => setMenuMobile(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-barre shrink-0 items-center gap-2 border-b border-bordure bg-white px-3">
          <button
            onClick={() => setMenuMobile(true)}
            aria-label="Ouvrir le menu"
            className="grid size-9 place-items-center rounded-md text-texte-faible transition-colors duration-[120ms] hover:bg-surface-basse lg:hidden"
          >
            <IconeMenu />
          </button>

          <button
            onClick={() => setRepliee((r) => !r)}
            aria-label={repliee ? "Déplier le panneau" : "Replier le panneau"}
            title={repliee ? "Déplier le panneau" : "Replier le panneau"}
            aria-pressed={repliee}
            className="hidden size-9 place-items-center rounded-md text-texte-faible transition-colors duration-[120ms] hover:bg-surface-basse lg:grid"
          >
            <IconePanneau replie={repliee} />
          </button>

          <span className="lg:hidden">
            <Logo taille={20} fond="clair" />
          </span>

          <h1 className="ml-1 min-w-0 flex-1 truncate text-base font-semibold text-texte">
            {titre}
          </h1>

          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>

        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

function IconeMenu() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

function IconePanneau({ replie }: { replie: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      {!replie && <path d="M6 9l-1.5 3L6 15" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
