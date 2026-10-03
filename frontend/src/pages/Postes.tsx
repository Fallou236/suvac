import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requetes } from "@/api/requetes";
import type { PosteSante } from "@/api/types";
import { Coquille } from "@/composants/Coquille";
import { DeuxColonnes } from "@/composants/DeuxColonnes";
import { Recherche } from "@/composants/Recherche";
import { Bouton } from "@/composants/Bouton";
import { Modal } from "@/composants/Modal";
import { Etiquette } from "@/composants/Etiquette";
import { EtatVide } from "@/composants/EtatVide";
import { Chargement } from "@/composants/Chargement";
import { cn } from "@/composants/cn";
import { messageDErreur } from "@/etat/messages";
import { useAuthentification } from "@/etat/authentification";
import { FormulairePoste } from "./FormulairePoste";

export default function Postes() {
  const [recherche, setRecherche] = useState("");
  const [choisi, setChoisi] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);

  const moi = useAuthentification((e) => e.utilisateur);
  const estAdmin = moi?.role === "admin";

  const { data, isPending, error } = useQuery({
    queryKey: ["postes"],
    queryFn: requetes.postes,
  });

  const filtres = (data?.results ?? []).filter((poste) =>
    `${poste.nom} ${poste.district} ${poste.region}`
      .toLowerCase()
      .includes(recherche.toLowerCase()),
  );

  const actif = filtres.find((p) => p.id === choisi) ?? null;

  return (
    <Coquille
      titre="Postes de santé"
      actions={
        estAdmin && (
          <Bouton taille="compact" onClick={() => setCreation(true)}>
            Nouveau poste
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
          detailVisible={actif !== null}
          liste={
            <div>
              <div className="sticky top-0 z-10 border-b border-bordure bg-white p-3">
                <Recherche
                  valeur={recherche}
                  onChanger={setRecherche}
                  placeholder="Nom, district ou région"
                />
                <p className="mt-2 text-xs text-texte-faible">
                  {filtres.length} poste{filtres.length > 1 ? "s" : ""}
                </p>
              </div>

              {filtres.length === 0 ? (
                <EtatVide
                  titre="Aucun poste"
                  description={
                    recherche
                      ? "Aucun poste ne correspond à cette recherche."
                      : "Aucun poste n'est encore enregistré."
                  }
                />
              ) : (
                <ul>
                  {grouperParRegion(filtres).map((groupe) => (
                    <li key={groupe.region}>
                      <p className="sticky top-[88px] z-[5] border-b border-bordure bg-surface-basse px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-texte-faible">
                        {groupe.region}
                      </p>
                      <ul>
                        {groupe.postes.map((poste) => (
                          <li key={poste.id}>
                            <Ligne
                              poste={poste}
                              estLeMien={poste.id === moi?.poste?.id}
                              actif={poste.id === choisi}
                              onChoisir={() => setChoisi(poste.id)}
                            />
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          }
          detail={
            actif ? (
              <Fiche
                poste={actif}
                estLeMien={actif.id === moi?.poste?.id}
                estAdmin={estAdmin}
                onFermer={() => setChoisi(null)}
              />
            ) : (
              <Accueil nombre={filtres.length} />
            )
          }
        />
      )}

      <Modal
        ouvert={creation}
        titre="Nouveau poste"
        onFermer={() => setCreation(false)}
      >
        {creation && (
          <FormulairePoste
            onTermine={(id) => {
              setCreation(false);
              setChoisi(id);
            }}
            onAnnuler={() => setCreation(false)}
          />
        )}
      </Modal>
    </Coquille>
  );
}

/* ---------------------------------------------------------------- */

function Ligne({
  poste,
  estLeMien,
  actif,
  onChoisir,
}: {
  poste: PosteSante;
  estLeMien: boolean;
  actif: boolean;
  onChoisir: () => void;
}) {
  return (
    <button
      onClick={onChoisir}
      aria-current={actif ? "true" : undefined}
      className={cn(
        "flex w-full items-start gap-3 border-b border-bordure px-3.5 py-2.5 text-left",
        "transition-colors duration-[120ms]",
        actif ? "bg-cuivre-clair" : "hover:bg-surface-basse",
        !poste.actif && "opacity-60",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          poste.actif ? "bg-baobab" : "bg-annule",
        )}
      />

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-texte">
            {poste.nom}
          </span>
          {estLeMien && (
            <span className="shrink-0 text-[11px] font-medium text-cuivre">
              le vôtre
            </span>
          )}
        </span>
        <span className="tabulaire mt-0.5 block text-xs text-texte-faible">
          {poste.district}
          <span aria-hidden="true"> · </span>
          {poste.nombre_agents} agent{poste.nombre_agents > 1 ? "s" : ""}
          <span aria-hidden="true"> · </span>
          {poste.nombre_beneficiaires} mère
          {poste.nombre_beneficiaires > 1 ? "s" : ""}
        </span>
      </span>
    </button>
  );
}

function Fiche({
  poste,
  estLeMien,
  estAdmin,
  onFermer,
}: {
  poste: PosteSante;
  estLeMien: boolean;
  estAdmin: boolean;
  onFermer: () => void;
}) {
  const [modification, setModification] = useState(false);
  const client = useQueryClient();

  const peutModifier = estAdmin || estLeMien;

  const bascule = useMutation({
    mutationFn: () => requetes.basculerPoste(poste.id),
    onSuccess: () => client.invalidateQueries({ queryKey: ["postes"] }),
  });

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6 p-5 lg:p-8">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-bold text-texte">{poste.nom}</h2>
            {!poste.actif && <Etiquette ton="alerte">Fermé</Etiquette>}
          </div>
          <p className="mt-1 text-sm text-texte-faible">
            {poste.district}, {poste.region}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {peutModifier && (
            <Bouton
              variante="secondaire"
              taille="compact"
              onClick={() => setModification(true)}
            >
              Modifier
            </Bouton>
          )}
          <button
            onClick={onFermer}
            aria-label="Fermer la fiche"
            className="grid size-9 place-items-center rounded-md text-texte-faible hover:bg-surface-basse lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Chiffre valeur={poste.nombre_agents} libelle="Personnel actif" />
        <Chiffre valeur={poste.nombre_beneficiaires} libelle="Mères suivies" />
      </div>

      <section>
        <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-texte-faible">
          Coordonnées
        </h3>
        <dl className="flex flex-col gap-2.5 rounded-lg border border-bordure bg-white px-4 py-3 text-sm">
          <Ligne2 cle="Téléphone">
            {poste.telephone ? (
              <a
                href={`tel:${poste.telephone}`}
                className="tabulaire font-medium text-cuivre underline-offset-2 hover:underline"
              >
                {poste.telephone}
              </a>
            ) : (
              <span className="text-texte-faible">Non renseigné</span>
            )}
          </Ligne2>
          <Ligne2 cle="Localisation">
            {poste.latitude && poste.longitude ? (
              <a
                href={`https://www.openstreetmap.org/?mlat=${poste.latitude}&mlon=${poste.longitude}#map=15/${poste.latitude}/${poste.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="tabulaire font-medium text-cuivre underline-offset-2 hover:underline"
              >
                {poste.latitude}, {poste.longitude}
              </a>
            ) : (
              <span className="text-texte-faible">Non renseignée</span>
            )}
          </Ligne2>
          <Ligne2 cle="Enregistré le">{formatDate(poste.cree_le)}</Ligne2>
        </dl>
      </section>

      {estAdmin && (
        <section>
          <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-texte-faible">
            Activité
          </h3>
          <div
            className={cn(
              "flex items-start justify-between gap-4 rounded-lg border px-4 py-3",
              poste.actif
                ? "border-retard/25 bg-retard-fond"
                : "border-bordure bg-white",
            )}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-texte">
                {poste.actif ? "Fermer le poste" : "Rouvrir le poste"}
              </p>
              <p className="mt-0.5 text-sm text-texte-faible">
                {poste.actif
                  ? "Le poste n'accueillera plus de nouveaux bénéficiaires. Son historique est conservé. Transférez d'abord son personnel."
                  : "Le poste accueillera de nouveau des bénéficiaires."}
              </p>
            </div>
            <Bouton
              variante={poste.actif ? "danger" : "secondaire"}
              taille="compact"
              chargement={bascule.isPending}
              onClick={() => bascule.mutate()}
            >
              {poste.actif ? "Fermer" : "Rouvrir"}
            </Bouton>
          </div>

          {bascule.isError && (
            <p role="alert" className="mt-2 text-sm text-retard">
              {messageDErreur(bascule.error)}
            </p>
          )}
        </section>
      )}

      <Modal
        ouvert={modification}
        titre="Modifier le poste"
        onFermer={() => setModification(false)}
      >
        {modification && (
          <FormulairePoste
            poste={poste}
            estAdmin={estAdmin}
            onTermine={() => setModification(false)}
            onAnnuler={() => setModification(false)}
          />
        )}
      </Modal>
    </article>
  );
}

function Chiffre({ valeur, libelle }: { valeur: number; libelle: string }) {
  return (
    <div className="rounded-lg border border-bordure bg-white px-4 py-3">
      <p className="tabulaire text-2xl font-bold leading-none text-baobab">
        {valeur}
      </p>
      <p className="mt-1 text-xs text-texte-faible">{libelle}</p>
    </div>
  );
}

function Ligne2({ cle, children }: { cle: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-bordure pb-2.5 last:border-0 last:pb-0">
      <dt className="text-texte-faible">{cle}</dt>
      <dd className="text-right font-medium text-texte">{children}</dd>
    </div>
  );
}

function Accueil({ nombre }: { nombre: number }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div className="max-w-sm">
        <p className="tabulaire text-4xl font-bold text-baobab">{nombre}</p>
        <p className="mt-1 text-sm font-medium text-texte">
          poste{nombre > 1 ? "s" : ""} de santé
        </p>
        <p className="mt-4 text-sm text-texte-faible">
          Sélectionnez un poste pour voir son personnel, ses coordonnées et son
          activité.
        </p>
      </div>
    </div>
  );
}

/** Les postes se lisent par région : c'est le découpage administratif. */
function grouperParRegion(postes: PosteSante[]) {
  const groupes = new Map<string, PosteSante[]>();

  for (const poste of postes) {
    const liste = groupes.get(poste.region) ?? [];
    liste.push(poste);
    groupes.set(poste.region, liste);
  }

  return [...groupes.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([region, liste]) => ({ region, postes: liste }));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
