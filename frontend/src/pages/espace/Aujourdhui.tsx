import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { requetes } from "@/api/requetes";
import { Coquille } from "@/composants/Coquille";
import { Chargement } from "@/composants/Chargement";
import { messageDErreur } from "@/etat/messages";
import { useAuthentification } from "@/etat/authentification";
import { indexerFiches, useFichesVaccins } from "@/etat/vaccins";
import { useMesCarnets } from "@/etat/espace";
import { LigneVaccin } from "./LigneVaccin";
import { formatDate } from "./format";
import { useTranslation } from "react-i18next";

type EcheanceAffichee = {
  id: string;
  vaccin: string;
  code: string;
  rang: number;
  statut: string;
  date_cible: string;
  beneficiaire: string;
};

export default function Aujourdhui() {
  const utilisateur = useAuthentification((e) => e.utilisateur);
  const rappels = useQuery({
    queryKey: ["mon-dossier", "rappels"],
    queryFn: requetes.mesRappels,
  });
  const { liste, carnets, chargement } = useMesCarnets();
  const { data: fiches } = useFichesVaccins();
  const index = indexerFiches(fiches);
  const { t } = useTranslation();

  if (rappels.isPending || chargement) {
    return (
      <Coquille titre="Aujourd'hui">
        <Chargement />
      </Coquille>
    );
  }

  if (rappels.error) {
    return (
      <Coquille titre="Aujourd'hui">
        <p className="px-6 py-16 text-center text-retard">
          {messageDErreur(rappels.error)}
        </p>
      </Coquille>
    );
  }

  // Les échéances viennent des carnets, pas des messages : cet écran montre
  // l'état du calendrier, que des rappels aient été envoyés ou non.
  const toutes: EcheanceAffichee[] = liste.flatMap((b) =>
    (carnets[b.id]?.echeances ?? []).map((e) => ({
      id: e.id,
      vaccin: e.vaccin,
      code: e.code,
      rang: e.rang,
      statut: e.statut,
      date_cible: e.date_cible,
      beneficiaire: b.type === "grossesse" ? "Vous" : b.titre,
    })),
  );

  const retards = toutes.filter((e) => e.statut === "en_retard");
  const aFaire = toutes.filter((e) => e.statut === "due");

  const recues = toutes.filter((e) => e.statut === "administree").length;
  const comptables = toutes.filter((e) =>
    ["administree", "due", "en_retard"].includes(e.statut),
  ).length;

  const prochains = liste
    .flatMap((b) => {
      const suivante = carnets[b.id]?.echeances
        .filter((e) => e.statut === "a_venir")
        .sort((a, b2) => a.date_cible.localeCompare(b2.date_cible))[0];
      return suivante
        ? [{
            beneficiaire: b.type === "grossesse" ? "vous" : b.titre,
            echeance: suivante,
          }]
        : [];
    })
    .sort((a, b) => a.echeance.date_cible.localeCompare(b.echeance.date_cible));

  const prenom = utilisateur?.first_name || utilisateur?.nom_complet || "";
  const nonLus = (rappels.data ?? []).filter((r) => !r.lu).length;

  return (
    <Coquille titre={t("navigation.aujourdhui")}>
      <div className="defilement h-full overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-7 p-5 lg:p-8">
          <header>
            <p className="text-sm text-texte-faible">
              {new Date().toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <h2 className="mt-1 text-2xl font-bold text-texte">
              {t("espace.bonjour", { prenom })}
            </h2>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <Chiffre
                valeur={aFaire.length}
                libelle={t("espace.aFaire")}
                ton="accent"
              />
              <Chiffre
                valeur={retards.length}
                libelle={t("espace.enRetard")}
                ton={retards.length > 0 ? "alerte" : "neutre"}
              />
              <Chiffre
                valeur={`${recues}/${comptables}`}
                libelle={t("espace.dosesRecues")}
                ton="succes"
              />
            </div>
          </header>

          {retards.length === 0 && aFaire.length === 0 && (
            <div className="rounded-lg border border-baobab/20 bg-baobab-clair px-5 py-6 text-center">
              <p className="text-lg font-semibold text-baobab">
                {toutes.length > 0
                  ? t("espace.toutEstAJour")
                  : t("espace.aucunSuivi")}
              </p>
              <p className="mt-1 text-sm text-texte-faible">
                {toutes.length > 0
                  ? t("espace.toutEstAJourDetail")
                  : t("espace.aucunSuiviDetail")}
              </p>
            </div>
          )}

          {retards.length > 0 && (
            <Section
              titre={t("espace.aRattraper")}
              description={t("espace.aRattraperDetail")}
              ton="alerte"
            >
              <ParBeneficiaire echeances={retards} index={index} />
            </Section>
          )}

          {aFaire.length > 0 && (
            <Section
              titre={t("espace.aFaireMaintenant")}
              description={t("espace.aFaireMaintenantDetail")}
            >
              <ParBeneficiaire echeances={aFaire} index={index} />
            </Section>
          )}

          {nonLus > 0 && (
              <Link
                to="/mon-espace/messages"
                className="mt-3 inline-block text-sm font-medium text-cuivre underline-offset-2 hover:underline"
              >
                {t("espace.messagesNonLus", { count: nonLus })}
              </Link>
          )}

          {prochains.length > 0 && (
            <Section titre={t("espace.prochainsRendezVous")}>
              <ol className="relative flex flex-col gap-4 border-l-2 border-bordure pl-5">
                {prochains.map(({ beneficiaire, echeance }) => (
                  <li key={echeance.id} className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-cuivre bg-white"
                    />
                    <p className="tabulaire text-sm font-semibold text-cuivre">
                      {formatDate(echeance.date_cible)}
                    </p>
                    <p className="text-base font-medium text-texte">
                      {echeance.vaccin}
                      <span className="ml-1.5 text-sm font-normal text-texte-faible">
                        {t("espace.dose", { rang: echeance.rang })}
                      </span>
                    </p>
                    <p className="text-sm text-texte-faible">
                      {t("espace.pour", { nom: beneficiaire })}
                    </p>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          <Link
            to="/mon-espace/carnets"
            className="self-start text-sm font-medium text-cuivre underline-offset-2 hover:underline"
          >
            {t("espace.voirTousLesCarnets")}
          </Link>
        </div>
      </div>
    </Coquille>
  );
}

/* ---------------------------------------------------------------- */

function ParBeneficiaire({
  echeances,
  index,
}: {
  echeances: EcheanceAffichee[];
  index: ReturnType<typeof indexerFiches>;
}) {
  const groupes = new Map<string, EcheanceAffichee[]>();
  for (const echeance of echeances) {
    const liste = groupes.get(echeance.beneficiaire) ?? [];
    liste.push(echeance);
    groupes.set(echeance.beneficiaire, liste);
  }

  return (
    <div className="flex flex-col gap-5">
      {[...groupes.entries()].map(([beneficiaire, liste]) => (
        <div key={beneficiaire}>
          <p className="mb-2 text-sm font-bold text-texte">{beneficiaire}</p>
          <ul className="flex flex-col gap-2">
            {liste.map((e) => (
              <LigneVaccin
                key={e.id}
                vaccin={e.vaccin}
                rang={e.rang}
                statut={e.statut}
                dateCible={e.date_cible}
                fiche={index[e.code]}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Section({
  titre,
  description,
  ton,
  children,
}: {
  titre: string;
  description?: string;
  ton?: "alerte";
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        className={`text-sm font-bold uppercase tracking-wide ${
          ton === "alerte" ? "text-retard" : "text-texte-faible"
        }`}
      >
        {titre}
      </h2>
      {description && (
        <p className="mt-1 text-sm text-texte-faible">{description}</p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Chiffre({
  valeur,
  libelle,
  ton,
}: {
  valeur: number | string;
  libelle: string;
  ton: "accent" | "alerte" | "succes" | "neutre";
}) {
  const styles = {
    accent: "border-cuivre/25 bg-cuivre-clair text-cuivre",
    alerte: "border-retard/25 bg-retard-fond text-retard",
    succes: "border-baobab/20 bg-baobab-clair text-baobab",
    neutre: "border-bordure bg-white text-baobab",
  }[ton];

  return (
    <div className={`rounded-lg border px-3 py-3 ${styles}`}>
      <p className="tabulaire text-2xl font-bold leading-none">{valeur}</p>
      <p className="mt-1 text-xs text-texte-faible">{libelle}</p>
    </div>
  );
}
