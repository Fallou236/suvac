import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { requetes, type ActeAudit } from "@/api/requetes";
import { Coquille } from "@/composants/Coquille";
import { Recherche } from "@/composants/Recherche";
import { Etiquette } from "@/composants/Etiquette";
import { EtatVide } from "@/composants/EtatVide";
import { Chargement } from "@/composants/Chargement";
import { cn } from "@/composants/cn";
import { messageDErreur } from "@/etat/messages";

const TONS: Record<string, "neutre" | "accent" | "alerte" | "succes"> = {
  creation: "succes",
  reactivation: "succes",
  desactivation: "alerte",
  reinitialisation: "accent",
  transfert: "neutre",
  changement_role: "accent",
};

const FILTRES = [
  { cle: "", libelle: "Tous" },
  { cle: "creation", libelle: "Créations" },
  { cle: "reinitialisation", libelle: "Mots de passe" },
  { cle: "desactivation", libelle: "Désactivations" },
  { cle: "transfert", libelle: "Transferts" },
];

export default function Audit() {
  const [filtre, setFiltre] = useState("");
  const [recherche, setRecherche] = useState("");

  const { data, isPending, error } = useQuery({
    queryKey: ["audit"],
    queryFn: requetes.audit,
  });

  const actes = (data ?? []).filter((acte) => {
    const correspond = filtre === "" || acte.acte === filtre;
    const texte = `${acte.auteur_identifiant} ${acte.cible_identifiant} ${acte.detail}`;
    return correspond && texte.toLowerCase().includes(recherche.toLowerCase());
  });

  const parJour = grouperParJour(actes);

  return (
    <Coquille titre="Journal d'audit">
      <div className="defilement h-full overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-5 p-5 lg:p-8">
          <p className="text-sm leading-relaxed text-texte-faible">
            Tous les actes d'administration sur les comptes. Ce journal est en
            écriture seule : rien ne peut le modifier ni l'effacer.
          </p>

          <div className="flex flex-col gap-3">
            <Recherche
              valeur={recherche}
              onChanger={setRecherche}
              placeholder="Identifiant ou détail"
            />
            <div className="flex flex-wrap gap-1.5">
              {FILTRES.map((f) => (
                <button
                  key={f.cle}
                  onClick={() => setFiltre(f.cle)}
                  aria-pressed={filtre === f.cle}
                  className={cn(
                    "min-h-[34px] rounded-full border px-3 text-sm font-medium",
                    "transition-colors duration-[120ms]",
                    filtre === f.cle
                      ? "border-baobab bg-baobab text-white"
                      : "border-bordure bg-white text-texte hover:bg-surface-basse",
                  )}
                >
                  {f.libelle}
                </button>
              ))}
            </div>
          </div>

          {isPending ? (
            <Chargement />
          ) : error ? (
            <p className="py-10 text-center text-retard">
              {messageDErreur(error)}
            </p>
          ) : actes.length === 0 ? (
            <EtatVide
              titre="Aucun acte"
              description={
                recherche || filtre
                  ? "Aucun acte ne correspond à ces critères."
                  : "Les actes d'administration apparaîtront ici."
              }
            />
          ) : (
            <div className="flex flex-col gap-6">
              {parJour.map(({ jour, actes: duJour }) => (
                <section key={jour}>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-texte-faible">
                    {formatJour(jour)}
                  </h2>
                  <ol className="flex flex-col gap-1.5">
                    {duJour.map((acte) => (
                      <Ligne key={acte.id} acte={acte} />
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </Coquille>
  );
}

/* ---------------------------------------------------------------- */

function Ligne({ acte }: { acte: ActeAudit }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-bordure bg-white px-4 py-3">
      <span className="tabulaire shrink-0 pt-0.5 text-xs text-texte-faible">
        {formatHeure(acte.horodatage)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <Etiquette ton={TONS[acte.acte] ?? "neutre"}>
            {acte.acte_libelle}
          </Etiquette>
          <span className="tabulaire text-sm font-semibold text-texte">
            {acte.cible_identifiant}
          </span>
        </span>

        <span className="mt-1 block text-sm text-texte-faible">
          par <span className="tabulaire">{acte.auteur_identifiant || "—"}</span>
          {acte.detail && (
            <>
              <span aria-hidden="true"> · </span>
              {acte.detail}
            </>
          )}
        </span>
      </span>
    </li>
  );
}

/** Les actes se lisent par journée : c'est ainsi qu'on cherche un incident. */
function grouperParJour(actes: ActeAudit[]) {
  const groupes = new Map<string, ActeAudit[]>();

  for (const acte of actes) {
    const jour = acte.horodatage.slice(0, 10);
    const liste = groupes.get(jour) ?? [];
    liste.push(acte);
    groupes.set(jour, liste);
  }

  return [...groupes.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([jour, liste]) => ({ jour, actes: liste }));
}

function formatJour(iso: string): string {
  const date = new Date(iso);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  if (iso === aujourdhui) return "Aujourd'hui";

  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatHeure(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
