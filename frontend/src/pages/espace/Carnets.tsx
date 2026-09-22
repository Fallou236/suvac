import { useNavigate, useParams } from "react-router-dom";
import type { FicheVaccin, MonCarnet } from "@/api/requetes";
import { Coquille } from "@/composants/Coquille";
import { DeuxColonnes } from "@/composants/DeuxColonnes";
import { Chargement } from "@/composants/Chargement";
import { Etiquette } from "@/composants/Etiquette";
import { cn } from "@/composants/cn";
import { messageDErreur } from "@/etat/messages";
import { indexerFiches, useFichesVaccins } from "@/etat/vaccins";
import { useMesCarnets, type BeneficiaireEspace } from "@/etat/espace";
import { LigneVaccin } from "./LigneVaccin";
import { formatAge, formatDate } from "./format";

const ETAPES = [
  { seuil: 7, libelle: "À la naissance" },
  { seuil: 49, libelle: "À 6 semaines" },
  { seuil: 77, libelle: "À 10 semaines" },
  { seuil: 112, libelle: "À 14 semaines" },
  { seuil: 320, libelle: "À 9 mois" },
  { seuil: 500, libelle: "À 15 mois" },
  { seuil: Infinity, libelle: "Plus tard" },
];

type Echeance = MonCarnet["echeances"][number];

export default function Carnets() {
  const { id } = useParams();
  const naviguer = useNavigate();
  const { liste, carnets, chargement, erreur } = useMesCarnets();
  const { data: fiches } = useFichesVaccins();
  const index = indexerFiches(fiches);

  const actif = id ? carnets[id] : undefined;
  const beneficiaire = liste.find((b) => b.id === id);

  return (
    <Coquille titre="Mes carnets">
      {chargement ? (
        <Chargement />
      ) : erreur ? (
        <p className="px-6 py-16 text-center text-retard">{messageDErreur(erreur)}</p>
      ) : (
        <DeuxColonnes
          detailVisible={Boolean(id)}
          liste={
            <ul>
              {liste.map((b) => (
                <li key={b.id}>
                  <ElementListe
                    beneficiaire={b}
                    carnet={carnets[b.id]}
                    actif={b.id === id}
                    onChoisir={() => naviguer(`/mon-espace/carnets/${b.id}`)}
                  />
                </li>
              ))}
            </ul>
          }
          detail={
            actif && beneficiaire ? (
              <Carnet
                carnet={actif}
                beneficiaire={beneficiaire}
                fiches={index}
                onFermer={() => naviguer("/mon-espace/carnets")}
              />
            ) : (
              <div className="grid h-full place-items-center px-6 text-center">
                <p className="max-w-xs text-sm text-texte-faible">
                  Choisissez un carnet pour voir tous les vaccins, ceux déjà reçus
                  et ceux à venir.
                </p>
              </div>
            )
          }
        />
      )}
    </Coquille>
  );
}

/* ---------------------------------------------------------------- */

function progression(carnet?: MonCarnet) {
  const echeances = carnet?.echeances ?? [];
  const comptables = echeances.filter(
    (e) => e.statut !== "annulee" && e.statut !== "perimee",
  );
  const recues = comptables.filter((e) => e.statut === "administree").length;
  const retards = echeances.filter((e) => e.statut === "en_retard").length;
  return { recues, total: comptables.length, retards };
}

function ElementListe({
  beneficiaire,
  carnet,
  actif,
  onChoisir,
}: {
  beneficiaire: BeneficiaireEspace;
  carnet?: MonCarnet;
  actif: boolean;
  onChoisir: () => void;
}) {
  const { recues, total, retards } = progression(carnet);
  const pourcentage = total ? Math.round((100 * recues) / total) : 0;

  return (
    <button
      onClick={onChoisir}
      aria-current={actif ? "true" : undefined}
      className={cn(
        "flex w-full flex-col gap-2 border-b border-bordure px-4 py-3.5 text-left",
        "transition-colors duration-[120ms]",
        actif ? "bg-cuivre-clair" : "hover:bg-surface-basse",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-base font-semibold text-texte">{beneficiaire.titre}</span>
        {retards > 0 && <Etiquette ton="alerte">{retards} en retard</Etiquette>}
      </span>
      <span className="text-sm text-texte-faible">
        {beneficiaire.type === "enfant"
          ? `${formatAge(beneficiaire.age_jours ?? 0)}`
          : "Vaccin antitétanique"}
      </span>
      <span className="flex items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-basse">
          <span
            className="block h-full rounded-full bg-baobab"
            style={{ width: `${pourcentage}%` }}
          />
        </span>
        <span className="tabulaire text-xs font-medium text-texte-faible">
          {recues}/{total}
        </span>
      </span>
    </button>
  );
}

function Carnet({
  carnet,
  beneficiaire,
  fiches,
  onFermer,
}: {
  carnet: MonCarnet;
  beneficiaire: BeneficiaireEspace;
  fiches: Record<string, FicheVaccin>;
  onFermer: () => void;
}) {
  const { recues, total, retards } = progression(carnet);
  const groupes = regrouper(carnet);

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 p-5 lg:p-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-texte-faible">
            {carnet.type === "enfant" ? "Carnet de vaccination" : "Suivi de grossesse"}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-texte">{beneficiaire.titre}</h2>
          <p className="mt-0.5 text-sm text-texte-faible">
            {carnet.type === "enfant"
              ? `Né${beneficiaire.sexe === "F" ? "e" : ""} le ${formatDate(carnet.date_reference)}`
              : `Suivie depuis le ${formatDate(carnet.date_reference)}`}
          </p>
        </div>
        <button
          onClick={onFermer}
          aria-label="Fermer le carnet"
          className="grid size-9 shrink-0 place-items-center rounded-md text-texte-faible hover:bg-surface-basse lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="rounded-lg border border-bordure bg-white p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-texte">Avancement</p>
          <p className="tabulaire text-sm text-texte-faible">
            <span className="text-lg font-bold text-baobab">{recues}</span> sur {total}{" "}
            doses reçues
          </p>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-basse">
          <div
            className="h-full rounded-full bg-baobab transition-[width] duration-[200ms]"
            style={{ width: `${total ? (100 * recues) / total : 0}%` }}
          />
        </div>
        {retards > 0 && (
          <p className="mt-2.5 text-sm font-medium text-retard">
            {retards} vaccin{retards > 1 ? "s" : ""} à rattraper au poste de santé.
          </p>
        )}
      </div>

      {groupes.map((groupe) => (
        <section key={groupe.libelle}>
          <h3 className="mb-2.5 text-sm font-bold uppercase tracking-wide text-texte-faible">
            {groupe.libelle}
          </h3>
          <ul className="flex flex-col gap-2">
            {groupe.echeances.map((e) => (
              <LigneVaccin
                key={e.id}
                vaccin={e.vaccin}
                rang={e.rang}
                statut={e.statut}
                dateCible={e.date_cible}
                dateAdministration={e.date_administration}
                fiche={fiches[e.code]}
              />
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}

function regrouper(carnet: MonCarnet): { libelle: string; echeances: Echeance[] }[] {
  if (carnet.type === "grossesse") {
    return [{ libelle: "Vaccin antitétanique", echeances: carnet.echeances }];
  }

  const paniers = new Map<string, Echeance[]>();
  for (const echeance of carnet.echeances) {
    const etape =
      ETAPES.find((e) => echeance.age_cible_jours <= e.seuil) ?? ETAPES[ETAPES.length - 1];
    const panier = paniers.get(etape.libelle) ?? [];
    panier.push(echeance);
    paniers.set(etape.libelle, panier);
  }

  return ETAPES.filter((e) => paniers.has(e.libelle)).map((e) => ({
    libelle: e.libelle,
    echeances: paniers.get(e.libelle)!,
  }));
}
