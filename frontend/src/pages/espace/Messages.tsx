import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { requetes, type MonRappel } from "@/api/requetes";
import { Coquille } from "@/composants/Coquille";
import { Chargement } from "@/composants/Chargement";
import { EtatVide } from "@/composants/EtatVide";
import { ExplicationVaccin } from "@/composants/ExplicationVaccin";
import { cn } from "@/composants/cn";
import { messageDErreur } from "@/etat/messages";
import { useAuthentification } from "@/etat/authentification";
import { indexerFiches, useFichesVaccins } from "@/etat/vaccins";
import { formatDate } from "./format";

type Filtre = "tous" | "retard" | "afaire";

const FILTRES: { cle: Filtre; libelle: string }[] = [
  { cle: "tous", libelle: "Tous" },
  { cle: "retard", libelle: "En retard" },
  { cle: "afaire", libelle: "À faire" },
];

export default function Messages() {
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const utilisateur = useAuthentification((e) => e.utilisateur);
  const { data, isPending, error } = useQuery({
    queryKey: ["mon-dossier", "rappels"],
    queryFn: requetes.mesRappels,
  });
  const { data: fiches } = useFichesVaccins();
  const index = indexerFiches(fiches);

  const messages = [...(data ?? [])]
    .filter((m) =>
      filtre === "tous" ? true : filtre === "retard" ? m.statut === "en_retard" : m.statut === "due",
    )
    // Les retards d'abord, du plus ancien au plus récent.
    .sort((a, b) => {
      if (a.statut !== b.statut) return a.statut === "en_retard" ? -1 : 1;
      return b.retard_jours - a.retard_jours || a.date_cible.localeCompare(b.date_cible);
    });

  return (
    <Coquille titre="Messages">
      <div className="defilement h-full overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 p-5 lg:p-8">
          <div role="tablist" aria-label="Filtrer les messages" className="flex gap-1.5">
            {FILTRES.map((f) => (
              <button
                key={f.cle}
                role="tab"
                aria-selected={filtre === f.cle}
                onClick={() => setFiltre(f.cle)}
                className={cn(
                  "min-h-[36px] rounded-full border px-3.5 text-sm font-medium transition-colors duration-[120ms]",
                  filtre === f.cle
                    ? "border-baobab bg-baobab text-white"
                    : "border-bordure bg-white text-texte hover:bg-surface-basse",
                )}
              >
                {f.libelle}
              </button>
            ))}
          </div>

          {isPending ? (
            <Chargement />
          ) : error ? (
            <p className="py-10 text-center text-retard">{messageDErreur(error)}</p>
          ) : messages.length === 0 ? (
            <EtatVide
              titre="Aucun message"
              description="Vous recevrez un message ici avant chaque vaccin à faire."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {messages.map((m) => (
                <Message
                  key={m.id}
                  message={m}
                  pourElleMeme={m.beneficiaire === utilisateur?.nom_complet}
                  fiche={index[m.code]}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Coquille>
  );
}

/* ---------------------------------------------------------------- */

function Message({
  message,
  pourElleMeme,
  fiche,
}: {
  message: MonRappel;
  pourElleMeme: boolean;
  fiche?: ReturnType<typeof indexerFiches>[string];
}) {
  const enRetard = message.statut === "en_retard";

  return (
    <li
      className={cn(
        "rounded-lg border bg-white p-4",
        enRetard ? "border-retard/25" : "border-bordure",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full",
            enRetard ? "bg-retard text-white" : "bg-cuivre-clair text-cuivre",
          )}
        >
          {enRetard ? (
            <span className="text-lg font-bold">!</span>
          ) : (
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-base font-semibold text-texte">
              {enRetard ? "Vaccin à rattraper" : "Vaccin à faire"}
            </p>
            <p className="tabulaire shrink-0 text-xs text-texte-faible">
              {formatDate(message.date_cible)}
            </p>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-texte">
            {texte(message, pourElleMeme)}
          </p>
        </div>
      </div>

      <ExplicationVaccin fiche={fiche} />
    </li>
  );
}

/**
 * Le ton compte : un retard se signale sans culpabiliser. On dit qu'il est
 * encore temps plutôt que de rappeler la faute.
 */
function texte(m: MonRappel, pourElleMeme: boolean): string {
  const sujet = pourElleMeme ? "Vous devez" : `${m.beneficiaire} doit`;
  const dose = m.rang > 1 ? ` (dose ${m.rang})` : "";

  if (m.statut === "en_retard") {
    const sujetPasse = pourElleMeme
      ? "Vous n'avez pas encore reçu"
      : `${m.beneficiaire} n'a pas encore reçu`;
    return `${sujetPasse} le vaccin ${m.vaccin}${dose}, prévu le ${formatDate(m.date_cible)}. Il est encore temps de le faire : rendez-vous au ${m.poste} dès que possible.`;
  }

  return `${sujet} recevoir le vaccin ${m.vaccin}${dose}. Rendez-vous au ${m.poste} avec le carnet.`;
}
