import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requetes, type MonRappel } from "@/api/requetes";
import { Coquille } from "@/composants/Coquille";
import { DeuxColonnes } from "@/composants/DeuxColonnes";
import { Chargement } from "@/composants/Chargement";
import { EtatVide } from "@/composants/EtatVide";
import { ExplicationVaccin } from "@/composants/ExplicationVaccin";
import { Bouton } from "@/composants/Bouton";
import { Etiquette } from "@/composants/Etiquette";
import { cn } from "@/composants/cn";
import { messageDErreur } from "@/etat/messages";
import { indexerFiches, useFichesVaccins } from "@/etat/vaccins";
import { formatDate } from "./format";

type Filtre = "tous" | "nonlus" | "retard";

const FILTRES: { cle: Filtre; libelle: string }[] = [
  { cle: "tous", libelle: "Tous" },
  { cle: "nonlus", libelle: "Non lus" },
  { cle: "retard", libelle: "En retard" },
];

export default function Messages() {
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const client = useQueryClient();

  const { data, isPending, error } = useQuery({
    queryKey: ["mon-dossier", "rappels"],
    queryFn: requetes.mesRappels,
  });

  /**
   * L'ouverture d'un message le marque comme lu, côté serveur : c'est le
   * geste qui vaut accusé de lecture, pas un bouton séparé.
   */
  const detail = useQuery({
    queryKey: ["mon-dossier", "rappel", ouvert],
    queryFn: () => requetes.monRappel(ouvert!),
    enabled: ouvert !== null,
  });

  const { data: fiches } = useFichesVaccins();
  const index = indexerFiches(fiches);

  const marquerTousLus = useMutation({
    mutationFn: requetes.marquerRappelsLus,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["mon-dossier", "rappels"] }),
  });

  // La liste se rafraîchit dès qu'un message est lu, pour que le compteur
  // de la barre latérale suive.
  if (detail.isSuccess && detail.data.lu) {
    const dansLaListe = data?.find((m) => m.id === detail.data.id);
    if (dansLaListe && !dansLaListe.lu) {
      client.invalidateQueries({ queryKey: ["mon-dossier", "rappels"] });
    }
  }

  const messages = (data ?? []).filter((m) =>
    filtre === "tous" ? true : filtre === "nonlus" ? !m.lu : m.type === "relance",
  );

  const nonLus = (data ?? []).filter((m) => !m.lu).length;
  const actif = detail.data ?? null;

  return (
    <Coquille
      titre="Messages"
      actions={
        nonLus > 0 && (
          <Bouton
            variante="secondaire"
            taille="compact"
            chargement={marquerTousLus.isPending}
            onClick={() => marquerTousLus.mutate()}
          >
            Tout marquer comme lu
          </Bouton>
        )
      }
    >
      {isPending ? (
        <Chargement />
      ) : error ? (
        <p className="px-6 py-16 text-center text-retard">
          {messageDErreur(error)}
        </p>
      ) : (
        <DeuxColonnes
          detailVisible={ouvert !== null}
          liste={
            <div>
              <div className="sticky top-0 z-10 border-b border-bordure bg-white p-3">
                <div role="tablist" aria-label="Filtrer" className="flex gap-1.5">
                  {FILTRES.map((f) => (
                    <button
                      key={f.cle}
                      role="tab"
                      aria-selected={filtre === f.cle}
                      onClick={() => setFiltre(f.cle)}
                      className={cn(
                        "min-h-[34px] flex-1 rounded-full border px-3 text-sm font-medium",
                        "transition-colors duration-[120ms]",
                        filtre === f.cle
                          ? "border-baobab bg-baobab text-white"
                          : "border-bordure bg-white text-texte hover:bg-surface-basse",
                      )}
                    >
                      {f.libelle}
                      {f.cle === "nonlus" && nonLus > 0 && (
                        <span className="tabulaire ml-1.5 font-bold">
                          {nonLus}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {messages.length === 0 ? (
                <EtatVide
                  titre={filtre === "nonlus" ? "Tout est lu" : "Aucun message"}
                  description={
                    filtre === "nonlus"
                      ? "Vous avez lu tous vos messages."
                      : "Vous recevrez un message ici avant chaque vaccin à faire."
                  }
                />
              ) : (
                <ul>
                  {messages.map((message) => (
                    <li key={message.id}>
                      <LigneMessage
                        message={message}
                        actif={message.id === ouvert}
                        onOuvrir={() => setOuvert(message.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          }
          detail={
            detail.isPending && ouvert ? (
              <Chargement />
            ) : actif ? (
              <DetailMessage
                message={actif}
                fiches={index}
                onFermer={() => setOuvert(null)}
              />
            ) : (
              <Accueil nonLus={nonLus} />
            )
          }
        />
      )}
    </Coquille>
  );
}

/* ---------------------------------------------------------------- */

function LigneMessage({
  message,
  actif,
  onOuvrir,
}: {
  message: MonRappel;
  actif: boolean;
  onOuvrir: () => void;
}) {
  const enRetard = message.type === "relance";

  return (
    <button
      onClick={onOuvrir}
      aria-current={actif ? "true" : undefined}
      className={cn(
        "flex w-full items-start gap-3 border-b border-bordure px-3.5 py-3 text-left",
        "transition-colors duration-[120ms]",
        actif ? "bg-cuivre-clair" : "hover:bg-surface-basse",
        !message.lu && !actif && "bg-white",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 size-2.5 shrink-0 rounded-full",
          message.lu ? "bg-transparent" : enRetard ? "bg-retard" : "bg-cuivre",
        )}
      />

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "truncate text-sm",
              message.lu ? "font-medium text-texte-faible" : "font-bold text-texte",
            )}
          >
            {enRetard ? "Vaccin à rattraper" : "Vaccin à faire"}
          </span>
          <span className="tabulaire shrink-0 text-xs text-texte-faible">
            {formatDate(message.date)}
          </span>
        </span>

        <span className="mt-0.5 block truncate text-sm text-texte-faible">
          {message.beneficiaire}
          {(message.vaccins ?? []).length > 0 && (
            <>
              <span aria-hidden="true"> · </span>
              {message.vaccins.map((v) => v.libelle).join(", ")}
            </>
          )}
        </span>
      </span>
    </button>
  );
}

function DetailMessage({
  message,
  fiches,
  onFermer,
}: {
  message: MonRappel;
  fiches: ReturnType<typeof indexerFiches>;
  onFermer: () => void;
}) {
  const enRetard = message.type === "relance";

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-5 p-5 lg:p-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-texte">
              {enRetard ? "Vaccin à rattraper" : "Vaccin à faire"}
            </h2>
            {enRetard && <Etiquette ton="alerte">En retard</Etiquette>}
          </div>
          <p className="tabulaire mt-1 text-sm text-texte-faible">
            {formatDate(message.date)}
            <span aria-hidden="true"> · </span>
            {message.beneficiaire}
          </p>
        </div>

        <button
          onClick={onFermer}
          aria-label="Fermer le message"
          className="grid size-9 shrink-0 place-items-center rounded-md text-texte-faible hover:bg-surface-basse lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div
        className={cn(
          "rounded-lg border px-4 py-4",
          enRetard ? "border-retard/25 bg-retard-fond" : "border-bordure bg-white",
        )}
      >
        <p className="text-base leading-relaxed text-texte">{message.texte}</p>
      </div>

      {(message.vaccins ?? []).length > 0 && (
        <section>
          <h3 className="mb-2.5 text-sm font-bold uppercase tracking-wide text-texte-faible">
            {message.vaccins.length > 1 ? "Les vaccins concernés" : "Le vaccin concerné"}
          </h3>
          <div className="flex flex-col gap-3">
            {(message.vaccins ?? []).map((vaccin) => (
              <div
                key={`${vaccin.code}-${vaccin.rang}`}
                className="rounded-lg border border-bordure bg-white px-4 py-3"
              >
                <p className="text-base font-semibold text-texte">
                  {vaccin.libelle}
                  {vaccin.rang > 1 && (
                    <span className="ml-1.5 text-sm font-normal text-texte-faible">
                      dose {vaccin.rang}
                    </span>
                  )}
                </p>
                {vaccin.protege_contre && (
                  <p className="mt-0.5 text-sm text-texte-faible">
                    Protège contre {vaccin.protege_contre}.
                  </p>
                )}
                <ExplicationVaccin fiche={fiches[vaccin.code]} />
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

function Accueil({ nonLus }: { nonLus: number }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div className="max-w-xs">
        {nonLus > 0 ? (
          <>
            <p className="tabulaire text-4xl font-bold text-cuivre">{nonLus}</p>
            <p className="mt-1 text-sm font-medium text-texte">
              message{nonLus > 1 ? "s" : ""} non lu{nonLus > 1 ? "s" : ""}
            </p>
          </>
        ) : (
          <p className="text-base font-semibold text-texte">Tout est lu</p>
        )}
        <p className="mt-3 text-sm text-texte-faible">
          Ouvrez un message pour voir le vaccin concerné et à quoi il sert.
        </p>
      </div>
    </div>
  );
}
