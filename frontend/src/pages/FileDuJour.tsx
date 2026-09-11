import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { requetes } from "@/api/requetes";
import { Pastille } from "@/composants/Pastille";
import { EtatVide } from "@/composants/EtatVide";
import { Chargement } from "@/composants/Chargement";
import { Bouton } from "@/composants/Bouton";
import { messageDErreur } from "@/etat/messages";
import { useAuthentification } from "@/etat/authentification";
import { grouperParBeneficiaire, type GroupeBeneficiaire } from "./fileDuJour.utils";
import type { EcheanceFile, StatutEcheance } from "@/api/types";

export default function FileDuJour() {
  const utilisateur = useAuthentification((e) => e.utilisateur);
  const deconnexion = useAuthentification((e) => e.deconnexion);

  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ["file-du-jour"],
    queryFn: () => requetes.fileDuJour(),
  });

  if (isPending) return <Chargement />;

  if (error) {
    return (
      <Page utilisateur={utilisateur?.nom_complet} onDeconnexion={deconnexion}>
        <div className="px-4 py-10 text-center">
          <p className="text-retard">{messageDErreur(error)}</p>
          <Bouton variante="secondaire" className="mt-4" onClick={() => refetch()}>
            Réessayer
          </Bouton>
        </div>
      </Page>
    );
  }

  const groupes = grouperParBeneficiaire(data);
  const enRetard = groupes.filter((g) => g.aDuRetard);
  const attendus = groupes.filter((g) => !g.aDuRetard);

  return (
    <Page
      utilisateur={utilisateur?.nom_complet}
      onDeconnexion={deconnexion}
      enCours={isFetching}
    >
      {groupes.length === 0 ? (
        <EtatVide
          titre="Aucun bénéficiaire attendu"
          description="La file se remplira à mesure que des échéances arrivent à terme."
        />
      ) : (
        <div className="flex flex-col gap-6 px-4 py-5">
          <Resume retards={enRetard.length} dues={attendus.length} />

          {enRetard.length > 0 && (
            <Groupe titre="En retard" nombre={enRetard.length} accent>
              {enRetard.map((g) => (
                <CarteBeneficiaire key={g.id} groupe={g} />
              ))}
            </Groupe>
          )}

          {attendus.length > 0 && (
            <Groupe titre="Attendus" nombre={attendus.length}>
              {attendus.map((g) => (
                <CarteBeneficiaire key={g.id} groupe={g} />
              ))}
            </Groupe>
          )}
        </div>
      )}
    </Page>
  );
}

/* ---------------------------------------------------------------- */

function Page({
  utilisateur,
  onDeconnexion,
  enCours,
  children,
}: {
  utilisateur?: string;
  onDeconnexion: () => void;
  enCours?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-surface-basse">
      <header className="sticky top-0 z-10 border-b border-bordure bg-baobab px-4 py-3">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Marque />
            <div>
              <p className="text-sm font-bold leading-tight text-white">SUVAC</p>
              {utilisateur && (
                <p className="text-xs leading-tight text-white/70">{utilisateur}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {enCours && (
              <span
                role="status"
                aria-label="Actualisation en cours"
                className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-transparent"
              />
            )}
            <button
              onClick={onDeconnexion}
              className="min-h-[40px] rounded-md px-3 text-sm font-medium text-white/80 transition-colors duration-[120ms] hover:bg-white/10 hover:text-white"
            >
              Quitter
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl">{children}</main>
    </div>
  );
}

function Marque() {
  return (
    <svg viewBox="0 0 48 48" className="size-7" aria-hidden="true">
      <g transform="translate(1.5,1.5)">
        <rect width="20" height="20" rx="5" fill="#fff" />
        <rect x="25" width="20" height="20" rx="5" fill="#fff" />
        <rect y="25" width="20" height="20" rx="5" fill="#fff" />
        <rect x="26.5" y="26.5" width="17" height="17" rx="3.8" fill="none" stroke="#D9924F" strokeWidth="3" />
      </g>
    </svg>
  );
}

function Resume({ retards, dues }: { retards: number; dues: number }) {
  return (
    <div className="flex gap-3">
      <Compteur valeur={retards} libelle="en retard" alerte={retards > 0} />
      <Compteur valeur={dues} libelle="attendus" />
    </div>
  );
}

function Compteur({
  valeur,
  libelle,
  alerte,
}: {
  valeur: number;
  libelle: string;
  alerte?: boolean;
}) {
  return (
    <div
      className={
        alerte
          ? "flex-1 rounded-lg border border-retard/25 bg-retard-fond px-4 py-3"
          : "flex-1 rounded-lg border border-bordure bg-white px-4 py-3"
      }
    >
      <p
        className={`tabulaire text-2xl font-bold leading-none ${
          alerte ? "text-retard" : "text-baobab"
        }`}
      >
        {valeur}
      </p>
      <p className="mt-1 text-sm text-texte-faible">{libelle}</p>
    </div>
  );
}

function Groupe({
  titre,
  nombre,
  accent,
  children,
}: {
  titre: string;
  nombre: number;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-label={`${titre} — ${nombre}`}>
      <h2
        className={`mb-2 text-sm font-bold uppercase tracking-wide ${
          accent ? "text-retard" : "text-texte-faible"
        }`}
      >
        {titre}
      </h2>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}

function CarteBeneficiaire({ groupe }: { groupe: GroupeBeneficiaire }) {
  return (
    <li
      className={`rounded-lg border bg-white p-3.5 ${
        groupe.aDuRetard ? "border-retard/25 bg-retard-fond" : "border-bordure"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-texte">{groupe.nom}</p>
          <p className="tabulaire mt-0.5 text-sm text-texte-faible">
            {groupe.echeances.length} vaccin
            {groupe.echeances.length > 1 ? "s" : ""}
            {groupe.retardMaximal > 0 && (
              <>
                <span aria-hidden="true"> · </span>
                <span className="font-medium text-retard">
                  jusqu'à {groupe.retardMaximal} jour
                  {groupe.retardMaximal > 1 ? "s" : ""} de retard
                </span>
              </>
            )}
          </p>
        </div>

        {groupe.telephone ? (
          <a
            href={`tel:${groupe.telephone}`}
            aria-label={`Appeler au sujet de ${groupe.nom}`}
            className="grid size-tactile shrink-0 place-items-center rounded-md text-cuivre transition-colors duration-[120ms] hover:bg-cuivre-clair"
          >
            <IconeTelephone />
          </a>
        ) : (
          <span
            title="Aucun numéro enregistré"
            aria-label="Aucun numéro enregistré"
            className="grid size-tactile shrink-0 place-items-center text-texte-faible/40"
          >
            <IconeTelephoneBarre />
          </span>
        )}
      </div>

      <ul className="mt-2.5 flex flex-wrap gap-1.5 border-t border-bordure/60 pt-2.5">
        {groupe.echeances.slice(0, 4).map((e) => (
          <li key={e.id}>
            <Puce echeance={e} />
          </li>
        ))}
        {groupe.echeances.length > 4 && (
          <li className="tabulaire inline-flex items-center px-2 py-1 text-sm font-medium text-texte-faible">
            +{groupe.echeances.length - 4} autre
            {groupe.echeances.length - 4 > 1 ? "s" : ""}
          </li>
        )}
      </ul>
    </li>
  );
}

function Puce({ echeance }: { echeance: EcheanceFile }) {
  const retard = echeance.retard_jours ?? 0;
  const enRetard = echeance.statut === "en_retard";

  return (
    <span
      className={`tabulaire inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm ${
        enRetard
          ? "border-retard/30 bg-white text-retard"
          : "border-bordure bg-surface-basse text-texte"
      }`}
    >
      <Pastille statut={echeance.statut as StatutEcheance} />
      <span className="font-medium">
        {echeance.vaccin_code}
        <span className="font-normal text-texte-faible">-{echeance.rang}</span>
      </span>
      {retard > 0 && <span className="font-semibold">+{retard} j</span>}
    </span>
  );
}

function IconeTelephone() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeTelephoneBarre() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 3l18 18M10.7 5A9 9 0 0 1 19 13.3" strokeLinecap="round" />
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
