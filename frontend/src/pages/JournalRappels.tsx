import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { requetes, type Rappel } from "@/api/requetes";
import { Coquille } from "@/composants/Coquille";
import { DeuxColonnes } from "@/composants/DeuxColonnes";
import { Recherche } from "@/composants/Recherche";
import { Indicateur } from "@/composants/Indicateur";
import { Etiquette } from "@/composants/Etiquette";
import { EtatVide } from "@/composants/EtatVide";
import { Chargement } from "@/composants/Chargement";
import { cn } from "@/composants/cn";
import { messageDErreur } from "@/etat/messages";

const FILTRES = [
  { cle: "", libelle: "Tous" },
  { cle: "envoye", libelle: "Envoyés" },
  { cle: "remis", libelle: "Remis" },
  { cle: "lu", libelle: "Lus" },
  { cle: "echec", libelle: "En échec" },
  { cle: "en_attente", libelle: "Non envoyés" },
];

const TONS: Record<string, "neutre" | "accent" | "alerte" | "succes"> = {
  en_attente: "neutre",
  envoye: "accent",
  remis: "accent",
  lu: "succes",
  echec: "alerte",
  abandonne: "alerte",
};

export default function JournalRappels() {
  const [statut, setStatut] = useState("");
  const [recherche, setRecherche] = useState("");
  const [choisi, setChoisi] = useState<string | null>(null);

  const synthese = useQuery({
    queryKey: ["rappels", "synthese"],
    queryFn: () => requetes.syntheseRappels(30),
  });

  const journal = useQuery({
    queryKey: ["rappels", statut, recherche],
    queryFn: () => requetes.rappels({ statut, search: recherche }),
  });

  const actif = journal.data?.results.find((r) => r.id === choisi) ?? null;

  return (
    <Coquille titre="Journal des rappels">
      <div className="flex h-full flex-col">
        {synthese.data && (
          <div className="shrink-0 border-b border-bordure bg-white px-5 py-4">
            <div className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Indicateur
                libelle="Rappels émis"
                valeur={synthese.data.total}
                precision={`Sur ${synthese.data.periode_jours} jours`}
              />
              <Indicateur
                libelle="Taux de remise"
                valeur={synthese.data.taux_remise}
                unite="%"
                ton={synthese.data.taux_remise >= 80 ? "succes" : "accent"}
                precision="Messages arrivés à destination"
              />
              <Indicateur
                libelle="Taux de lecture"
                valeur={synthese.data.taux_lecture}
                unite="%"
                precision="Messages ouverts par la mère"
              />
              <Indicateur
                libelle="Échecs"
                valeur={synthese.data.echecs + synthese.data.abandonnes}
                ton={
                  synthese.data.echecs + synthese.data.abandonnes > 0
                    ? "alerte"
                    : "neutre"
                }
                precision="Non acheminés"
              />
            </div>

            {synthese.data.motifs_echec.length > 0 && (
              <div className="mx-auto mt-4 max-w-5xl rounded-md border border-retard/25 bg-retard-fond px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-retard">
                  Motifs d'échec les plus fréquents
                </p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {synthese.data.motifs_echec.map((motif) => (
                    <li key={motif.erreur} className="text-sm text-texte">
                      <span className="tabulaire font-semibold text-retard">
                        {motif.occurrences}×
                      </span>{" "}
                      {motif.erreur}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1">
          <DeuxColonnes
            detailVisible={actif !== null}
            liste={
              <div>
                <div className="sticky top-0 z-10 border-b border-bordure bg-white p-3">
                  <Recherche
                    valeur={recherche}
                    onChanger={setRecherche}
                    placeholder="Nom ou téléphone"
                  />
                  <div className="mt-2 flex flex-wrap gap-1">
                    {FILTRES.map((filtre) => (
                      <button
                        key={filtre.cle}
                        onClick={() => setStatut(filtre.cle)}
                        aria-pressed={statut === filtre.cle}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-medium",
                          "transition-colors duration-[120ms]",
                          statut === filtre.cle
                            ? "border-baobab bg-baobab text-white"
                            : "border-bordure bg-white text-texte hover:bg-surface-basse",
                        )}
                      >
                        {filtre.libelle}
                      </button>
                    ))}
                  </div>
                </div>

                {journal.isPending && <Chargement />}

                {journal.error && (
                  <p className="px-4 py-6 text-center text-sm text-retard">
                    {messageDErreur(journal.error)}
                  </p>
                )}

                {journal.data?.results.length === 0 && (
                  <EtatVide
                    titre="Aucun rappel"
                    description={
                      recherche || statut
                        ? "Aucun rappel ne correspond à ces critères."
                        : "Les rappels apparaîtront ici après le premier balayage."
                    }
                  />
                )}

                <ul>
                  {journal.data?.results.map((rappel) => (
                    <li key={rappel.id}>
                      <Ligne
                        rappel={rappel}
                        actif={rappel.id === choisi}
                        onChoisir={() => setChoisi(rappel.id)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            }
            detail={
              actif ? (
                <Detail rappel={actif} onFermer={() => setChoisi(null)} />
              ) : (
                <Accueil />
              )
            }
          />
        </div>
      </div>
    </Coquille>
  );
}

/* ---------------------------------------------------------------- */

function Ligne({
  rappel,
  actif,
  onChoisir,
}: {
  rappel: Rappel;
  actif: boolean;
  onChoisir: () => void;
}) {
  const enEchec = rappel.statut === "echec" || rappel.statut === "abandonne";

  return (
    <button
      onClick={onChoisir}
      aria-current={actif ? "true" : undefined}
      className={cn(
        "flex w-full items-start gap-3 border-b border-bordure px-3.5 py-2.5 text-left",
        "transition-colors duration-[120ms]",
        actif ? "bg-cuivre-clair" : "hover:bg-surface-basse",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-1 size-2 shrink-0 rounded-full",
          enEchec
            ? "bg-retard"
            : rappel.statut === "lu"
              ? "bg-baobab"
              : "bg-cuivre",
        )}
      />

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold text-texte">
            {rappel.destinataire}
          </span>
          <span className="tabulaire shrink-0 text-xs text-texte-faible">
            {formatDate(rappel.planifie_pour)}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-texte-faible">
          {rappel.type_libelle}
          <span aria-hidden="true"> · </span>
          {rappel.canal}
          <span aria-hidden="true"> · </span>
          <span className={enEchec ? "font-medium text-retard" : ""}>
            {rappel.canal === "application" && rappel.statut === "en_attente"
              ? "Dans son espace"
              : rappel.statut_libelle}
          </span>
        </span>
      </span>
    </button>
  );
}

function Detail({ rappel, onFermer }: { rappel: Rappel; onFermer: () => void }) {
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-5 p-5 lg:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-texte">{rappel.destinataire}</h2>
            <Etiquette ton={TONS[rappel.statut] ?? "neutre"}>
              {rappel.canal === "application" && rappel.statut === "en_attente"
                ? "Dans son espace"
                : rappel.statut_libelle}
            </Etiquette>
          </div>
          <p className="tabulaire mt-1 text-sm text-texte-faible">
            {rappel.telephone || "Sans téléphone"}
            {rappel.village && (
              <>
                <span aria-hidden="true"> · </span>
                {rappel.village}
              </>
            )}
          </p>
        </div>
        <button
          onClick={onFermer}
          aria-label="Fermer"
          className="grid size-9 shrink-0 place-items-center rounded-md text-texte-faible hover:bg-surface-basse lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-texte-faible">
          Message envoyé
        </h3>
        <p className="rounded-lg border border-bordure bg-white px-4 py-3 text-sm leading-relaxed text-texte">
          {rappel.texte}
        </p>
        <p className="mt-1.5 text-xs text-texte-faible">
          Langue : {rappel.langue === "wo" ? "wolof" : "français"}
        </p>
      </section>

      {rappel.vaccins.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-texte-faible">
            Vaccins concernés
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {rappel.vaccins.map((vaccin) => (
              <li key={vaccin}>
                <Etiquette>{vaccin}</Etiquette>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-texte-faible">
          Acheminement
        </h3>

        {rappel.canal === "application" ? (
          <p className="rounded-lg border border-bordure bg-white px-4 py-3 text-sm text-texte">
            Consultable dans l'espace de la mère. Aucun envoi n'est effectué :
            elle a choisi de ne pas recevoir de message sur son téléphone.
          </p>
        ) : (
          <ol className="relative flex flex-col gap-3 border-l-2 border-bordure pl-5">
            <Etape titre="Planifié" date={rappel.planifie_pour} atteint />
            <Etape
              titre="Envoyé"
              date={rappel.envoye_le}
              atteint={Boolean(rappel.envoye_le)}
            />
            <Etape
              titre="Remis"
              date={rappel.remis_le}
              atteint={Boolean(rappel.remis_le)}
            />
            <Etape
              titre="Lu"
              date={rappel.statut === "lu" ? rappel.remis_le : null}
              atteint={rappel.statut === "lu"}
            />
          </ol>
        )}
      </section>

      {rappel.erreur && (
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-retard">
            Échec
          </h3>
          <p className="rounded-lg border border-retard/25 bg-retard-fond px-4 py-3 text-sm text-texte">
            {rappel.erreur}
          </p>
          {rappel.tentatives > 1 && (
            <p className="mt-1.5 text-xs text-texte-faible">
              {rappel.tentatives} tentatives
            </p>
          )}
        </section>
      )}
    </article>
  );
}

function Etape({
  titre,
  date,
  atteint,
}: {
  titre: string;
  date: string | null;
  atteint: boolean;
}) {
  return (
    <li className="relative">
      <span
        aria-hidden="true"
        className={cn(
          "absolute -left-[27px] top-1 size-3 rounded-full border-2",
          atteint ? "border-baobab bg-baobab" : "border-bordure bg-white",
        )}
      />
      <p
        className={cn(
          "text-sm font-medium",
          atteint ? "text-texte" : "text-texte-faible",
        )}
      >
        {titre}
      </p>
      {date && (
        <p className="tabulaire text-xs text-texte-faible">
          {formatHorodatage(date)}
        </p>
      )}
    </li>
  );
}

function Accueil() {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <p className="max-w-sm text-sm text-texte-faible">
        Sélectionnez un rappel pour voir le message envoyé, les vaccins
        concernés et son acheminement.
      </p>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function formatHorodatage(iso: string): string {
  const date = new Date(iso);
  if (iso.length <= 10) {
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  return date.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
