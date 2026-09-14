import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { requetes } from "@/api/requetes";
import { Coquille } from "@/composants/Coquille";
import { DeuxColonnes } from "@/composants/DeuxColonnes";
import { Frise } from "@/composants/Frise";
import { Etiquette } from "@/composants/Etiquette";
import { EtatVide } from "@/composants/EtatVide";
import { Chargement } from "@/composants/Chargement";
import { Bouton } from "@/composants/Bouton";
import { cn } from "@/composants/cn";
import { messageDErreur } from "@/etat/messages";
import type { EcheanceFile } from "@/api/types";
import {
  grouperParBeneficiaire,
  SECTIONS,
  type GroupeBeneficiaire,
} from "./fileDuJour.utils";

const AUJOURDHUI = new Date().toISOString().slice(0, 10);

export default function FileDuJour() {
  const [choisi, setChoisi] = useState<string | null>(null);

  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ["file-du-jour-complete"],
    queryFn: () => requetes.fileDuJourComplete(),
  });

  if (isPending) {
    return (
      <Coquille titre="File du jour">
        <Chargement />
      </Coquille>
    );
  }

  if (error) {
    return (
      <Coquille titre="File du jour">
        <div className="px-6 py-16 text-center">
          <p className="text-retard">{messageDErreur(error)}</p>
          <Bouton variante="secondaire" taille="compact" className="mt-4" onClick={() => refetch()}>
            Réessayer
          </Bouton>
        </div>
      </Coquille>
    );
  }

  const groupes = grouperParBeneficiaire(data, AUJOURDHUI);
  const actif = groupes.find((g) => g.id === choisi) ?? null;

  const parSection = SECTIONS.map((section) => ({
    ...section,
    groupes: groupes.filter((g) => g.section === section.cle),
  })).filter((s) => s.groupes.length > 0);

  const compte = (cle: string) =>
    groupes.filter((g) => g.section === cle).length;

  return (
    <Coquille
      titre="File du jour"
      actions={
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-1.5 sm:flex">
            {compte("aujourdhui") > 0 && (
              <Etiquette ton="accent">{compte("aujourdhui")} aujourd'hui</Etiquette>
            )}
            {compte("retard") > 0 && (
              <Etiquette ton="alerte">{compte("retard")} en retard</Etiquette>
            )}
            {compte("rattrapage") > 0 && (
              <Etiquette>{compte("rattrapage")} à rattraper</Etiquette>
            )}
          </div>
          <Bouton
            variante="secondaire"
            taille="compact"
            chargement={isFetching}
            onClick={() => refetch()}
          >
            Actualiser
          </Bouton>
        </div>
      }
    >
      {groupes.length === 0 ? (
        <EtatVide
          titre="Aucun bénéficiaire attendu"
          description="La file se remplira à mesure que des échéances arrivent à terme."
        />
      ) : (
        <DeuxColonnes
          detailVisible={actif !== null}
          liste={
            <div>
              {parSection.map((section) => (
                <section key={section.cle}>
                  <h2
                    className={cn(
                      "sticky top-0 z-10 border-b border-bordure px-3.5 py-1.5",
                      "text-[11px] font-bold uppercase tracking-wide backdrop-blur",
                      section.ton === "alerte"
                        ? "bg-retard-fond/90 text-retard"
                        : section.ton === "accent"
                          ? "bg-cuivre-clair/90 text-cuivre"
                          : "bg-surface-basse/90 text-texte-faible",
                    )}
                  >
                    {section.titre}
                    <span className="ml-1.5 font-semibold opacity-70">
                      {section.groupes.length}
                    </span>
                  </h2>
                  <ul>
                    {section.groupes.map((groupe) => (
                      <Ligne
                        key={groupe.id}
                        groupe={groupe}
                        actif={groupe.id === choisi}
                        onChoisir={() => setChoisi(groupe.id)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          }
          detail={
            actif ? (
              <Detail groupe={actif} onFermer={() => setChoisi(null)} />
            ) : (
              <Accueil groupes={groupes} />
            )
          }
        />
      )}
    </Coquille>
  );
}
/* ---------------------------------------------------------------- */

function Ligne({
  groupe,
  actif,
  onChoisir,
}: {
  groupe: GroupeBeneficiaire;
  actif: boolean;
  onChoisir: () => void;
}) {
  const teinte =
    groupe.section === "retard"
      ? "bg-retard"
      : groupe.section === "aujourdhui"
        ? "bg-cuivre"
        : "bg-bordure";

  return (
    <li>
      <button
        onClick={onChoisir}
        aria-current={actif ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-3 border-b border-bordure px-3.5 py-2.5 text-left",
          "transition-colors duration-[120ms]",
          actif ? "bg-cuivre-clair" : "hover:bg-surface-basse",
        )}
      >
        <span aria-hidden="true" className={cn("h-9 w-[3px] shrink-0 rounded-full", teinte)} />

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold text-texte">
              {groupe.nom}
            </span>
            {groupe.retardMaximal > 0 && (
              <span className="tabulaire shrink-0 text-xs font-bold text-retard">
                +{groupe.retardMaximal} j
              </span>
            )}
          </span>
          <span className="mt-1.5 block">
            <Frise echeances={groupe.calendrier} compacte />
          </span>
        </span>

        <span className="tabulaire shrink-0 text-xs font-semibold text-texte-faible">
          {groupe.aFaire.length}
        </span>
      </button>
    </li>
  );
}

function Detail({
  groupe,
  onFermer,
}: {
  groupe: GroupeBeneficiaire;
  onFermer: () => void;
}) {
  const administrables = groupe.aFaire.filter((e) => e.administrable);
  const bloquees = groupe.aFaire.filter((e) => !e.administrable);

  return (
    <div className="flex flex-col">
      <div className="border-b border-bordure bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-xl font-bold text-texte">{groupe.nom}</h2>
              {groupe.section === "retard" && (
                <Etiquette ton="alerte">En retard</Etiquette>
              )}
              {groupe.section === "aujourdhui" && (
                <Etiquette ton="accent">Aujourd'hui</Etiquette>
              )}
            </div>
            <p className="mt-1 text-sm text-texte-faible">
              {groupe.type === "enfant" ? "Enfant" : "Grossesse"}
              <span aria-hidden="true"> · </span>
              <span className="tabulaire">
                {groupe.dosesFaites}/{groupe.calendrier.length} doses reçues
              </span>
            </p>
          </div>

          <button
            onClick={onFermer}
            aria-label="Fermer la fiche"
            className="grid size-9 shrink-0 place-items-center rounded-md text-texte-faible transition-colors duration-[120ms] hover:bg-surface-basse lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {(groupe.mereNom || groupe.telephone) && (
          <p className="mt-2.5 flex flex-wrap items-center gap-x-1.5 text-sm text-texte-faible">
            <span className="font-medium text-texte">Mère</span>
            <span aria-hidden="true">·</span>
            <span>{groupe.mereNom}</span>
            {groupe.telephone && (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={`tel:${groupe.telephone}`}
                  className="tabulaire font-semibold text-cuivre underline-offset-2 hover:underline"
                >
                  {groupe.telephone}
                </a>
              </>
            )}
          </p>
        )}
      </div>

      <div className="flex max-w-3xl flex-col gap-6 p-5">
        <section>
          <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-texte-faible">
            Administrable aujourd'hui
          </h3>
          {administrables.length === 0 ? (
            <p className="rounded-md border border-bordure bg-white px-3 py-2.5 text-sm text-texte-faible">
              Aucune dose administrable aujourd'hui.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {administrables.map((e) => (
                <LigneDose key={e.id} echeance={e} administrable />
              ))}
            </ul>
          )}
        </section>

        {bloquees.length > 0 && (
          <section>
            <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-texte-faible">
              Prochaines séances
              <span className="ml-1.5 font-semibold opacity-70">{bloquees.length}</span>
            </h3>
            <ul className="flex flex-col gap-1.5">
              {bloquees.map((e) => (
                <LigneDose key={e.id} echeance={e} />
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-texte-faible">
            Calendrier vaccinal
          </h3>
          <div className="rounded-lg border border-bordure bg-white p-4">
            <Frise echeances={groupe.calendrier} />
            <Legende />
          </div>
        </section>
      </div>
    </div>
  );
}

const MOTIFS: Record<string, string> = {
  age_minimal_non_atteint: "âge minimal non atteint",
  intervalle_minimal_non_respecte: "intervalle depuis la dose précédente",
  dose_precedente_manquante: "dose précédente non administrée",
  age_limite_depasse: "âge limite dépassé",
  dose_deja_administree: "dose déjà enregistrée",
};

function LigneDose({
  echeance,
  administrable,
}: {
  echeance: EcheanceFile;
  administrable?: boolean;
}) {
  const enRetard = echeance.statut === "en_retard";
  const motifs = (echeance.motif_non_administrable ?? [])
    .map((m) => MOTIFS[m] ?? m)
    .join(", ");

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2",
        administrable && enRetard
          ? "border-retard/25 bg-retard-fond"
          : administrable
            ? "border-bordure bg-white"
            : "border-bordure/60 bg-surface-basse",
      )}
    >
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm font-semibold",
            administrable ? "text-texte" : "text-texte-faible",
          )}
        >
          {echeance.vaccin_libelle}
          <span className="ml-1.5 font-normal text-texte-faible">
            dose {echeance.rang}
          </span>
        </span>
        <span className="tabulaire mt-0.5 block text-xs text-texte-faible">
          {administrable ? (
            <>
              prévue le {formatDate(echeance.date_cible)}
              {(echeance.retard_jours ?? 0) > 0 && (
                <span className="ml-1.5 font-semibold text-retard">
                  · {echeance.retard_jours} jours de retard
                </span>
              )}
            </>
          ) : (
            <>Pas encore administrable — {motifs}</>
          )}
        </span>
      </span>

      {administrable && (
        <Bouton variante="secondaire" taille="compact">
          Administrer
        </Bouton>
      )}
    </li>
  );
}

function Legende() {
  const entrees = [
    { classe: "bg-baobab border-baobab", libelle: "Administrée" },
    { classe: "bg-white border-cuivre border-2", libelle: "Due" },
    { classe: "bg-retard border-retard", libelle: "En retard" },
    { classe: "bg-white border-avenir", libelle: "À venir" },
  ];

  return (
    <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-bordure pt-3">
      {entrees.map((e) => (
        <li key={e.libelle} className="flex items-center gap-1.5">
          <span className={cn("size-3 rounded-[2px] border", e.classe)} aria-hidden="true" />
          <span className="text-xs text-texte-faible">{e.libelle}</span>
        </li>
      ))}
    </ul>
  );
}

function Accueil({ groupes }: { groupes: GroupeBeneficiaire[] }) {
  const chiffres = SECTIONS.map((s) => ({
    titre: s.titre,
    nombre: groupes.filter((g) => g.section === s.cle).length,
    ton: s.ton,
  })).filter((c) => c.nombre > 0);

  return (
    <div className="grid h-full place-items-center px-6">
      <div className="w-full max-w-md">
        <div className="grid grid-cols-3 gap-3">
          {chiffres.map((c) => (
            <div
              key={c.titre}
              className={cn(
                "rounded-lg border px-3 py-3 text-center",
                c.ton === "alerte"
                  ? "border-retard/25 bg-retard-fond"
                  : c.ton === "accent"
                    ? "border-cuivre/25 bg-cuivre-clair"
                    : "border-bordure bg-white",
              )}
            >
              <p
                className={cn(
                  "tabulaire text-2xl font-bold leading-none",
                  c.ton === "alerte"
                    ? "text-retard"
                    : c.ton === "accent"
                      ? "text-cuivre"
                      : "text-baobab",
                )}
              >
                {c.nombre}
              </p>
              <p className="mt-1 text-xs text-texte-faible">{c.titre}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-texte-faible">
          Sélectionnez un bénéficiaire dans la liste pour voir son calendrier
          vaccinal et enregistrer une dose.
        </p>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
