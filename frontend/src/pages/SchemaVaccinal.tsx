import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { requetes, type RegleVaccinale } from "@/api/requetes";
import { Coquille } from "@/composants/Coquille";
import { Chargement } from "@/composants/Chargement";
import { Etiquette } from "@/composants/Etiquette";
import { cn } from "@/composants/cn";
import { messageDErreur } from "@/etat/messages";

const ETAPES = [
  { seuil: 7, libelle: "À la naissance" },
  { seuil: 49, libelle: "6 semaines" },
  { seuil: 77, libelle: "10 semaines" },
  { seuil: 112, libelle: "14 semaines" },
  { seuil: 200, libelle: "6 mois" },
  { seuil: 320, libelle: "9 mois" },
  { seuil: 500, libelle: "15 mois" },
  { seuil: Infinity, libelle: "Plus tard" },
];

export default function SchemaVaccinal() {
  const [cible, setCible] = useState<"enfant" | "mere">("enfant");

  const { data, isPending, error } = useQuery({
    queryKey: ["schema-vaccinal"],
    queryFn: requetes.schemaVaccinal,
    staleTime: Infinity,
  });

  if (isPending) {
    return (
      <Coquille titre="Schéma vaccinal">
        <Chargement />
      </Coquille>
    );
  }

  if (error) {
    return (
      <Coquille titre="Schéma vaccinal">
        <p className="px-6 py-16 text-center text-retard">
          {messageDErreur(error)}
        </p>
      </Coquille>
    );
  }

  const regles = cible === "enfant" ? data.enfant : data.mere;

  return (
    <Coquille
      titre="Schéma vaccinal"
      actions={
        <span className="hidden text-xs text-texte-faible sm:block">
          {data.vaccins} vaccins
          <span aria-hidden="true"> · </span>
          {data.regles} règles
        </span>
      }
    >
      <div className="defilement h-full overflow-y-auto">
        <div className="mx-auto flex max-w-4xl flex-col gap-5 p-5 lg:p-8">
          {data.avertissement && (
            <div className="rounded-lg border border-cuivre/25 bg-cuivre-clair px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-cuivre">
                À valider
              </p>
              <p className="mt-1 text-sm leading-relaxed text-texte">
                {data.avertissement}
              </p>
            </div>
          )}

          <p className="text-sm leading-relaxed text-texte-faible">
            Le calendrier appliqué par le moteur. Il détermine à quelle date
            chaque dose devient due, jusqu'à quand elle reste rattrapable, et
            quel délai doit séparer deux doses d'une même série. Sa
            modification est réservée à l'administrateur.
          </p>

          <div role="tablist" aria-label="Public concerné" className="flex gap-1.5">
            {[
              { cle: "enfant" as const, libelle: "Enfants" },
              { cle: "mere" as const, libelle: "Femmes enceintes" },
            ].map((onglet) => (
              <button
                key={onglet.cle}
                role="tab"
                aria-selected={cible === onglet.cle}
                onClick={() => setCible(onglet.cle)}
                className={cn(
                  "min-h-[36px] rounded-full border px-4 text-sm font-medium",
                  "transition-colors duration-[120ms]",
                  cible === onglet.cle
                    ? "border-baobab bg-baobab text-white"
                    : "border-bordure bg-white text-texte hover:bg-surface-basse",
                )}
              >
                {onglet.libelle}
              </button>
            ))}
          </div>

          {regrouper(regles).map((groupe) => (
            <section key={groupe.libelle}>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-texte-faible">
                {groupe.libelle}
              </h2>

              <div className="defilement overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-bordure text-left">
                      <th className="pb-2 pr-3 font-semibold text-texte-faible">
                        Vaccin
                      </th>
                      <th className="pb-2 pr-3 font-semibold text-texte-faible">
                        Dose
                      </th>
                      <th className="pb-2 pr-3 font-semibold text-texte-faible">
                        Âge minimal
                      </th>
                      <th className="pb-2 pr-3 font-semibold text-texte-faible">
                        Âge cible
                      </th>
                      <th className="pb-2 pr-3 font-semibold text-texte-faible">
                        Rattrapable jusqu'à
                      </th>
                      <th className="pb-2 font-semibold text-texte-faible">
                        Intervalle minimal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupe.regles.map((regle) => (
                      <Ligne key={regle.id} regle={regle} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>
    </Coquille>
  );
}

/* ---------------------------------------------------------------- */

function Ligne({ regle }: { regle: RegleVaccinale }) {
  return (
    <tr className="border-b border-bordure/60 last:border-0">
      <td className="py-2 pr-3">
        <span className="font-medium text-texte">{regle.vaccin_libelle}</span>
        {regle.vaccin_code !== regle.vaccin_libelle && (
          <span className="tabulaire ml-1.5 text-xs text-texte-faible">
            {regle.vaccin_code}
          </span>
        )}
      </td>
      <td className="tabulaire py-2 pr-3">
        <Etiquette>{regle.rang}</Etiquette>
      </td>
      <td className="tabulaire py-2 pr-3 text-texte-faible">
        {regle.age_min_jours === regle.age_cible_jours ? (
          <span className="opacity-40">—</span>
        ) : (
          formatAge(regle.age_min_jours)
        )}
      </td>
      <td className="tabulaire py-2 pr-3 font-medium text-texte">
        {formatAge(regle.age_cible_jours)}
      </td>
      <td className="tabulaire py-2 pr-3 text-texte-faible">
        {regle.age_limite_jours === null ? (
          <span title="Aucune limite d'âge">sans limite</span>
        ) : (
          formatAge(regle.age_limite_jours)
        )}
      </td>
      <td className="tabulaire py-2 text-texte-faible">
        {regle.intervalle_min_jours
          ? `${regle.intervalle_min_jours} jours`
          : "—"}
      </td>
    </tr>
  );
}

function regrouper(regles: RegleVaccinale[]) {
  const paniers = new Map<string, RegleVaccinale[]>();

  for (const regle of regles) {
    const etape =
      ETAPES.find((e) => regle.age_cible_jours <= e.seuil) ??
      ETAPES[ETAPES.length - 1];
    const panier = paniers.get(etape.libelle) ?? [];
    panier.push(regle);
    paniers.set(etape.libelle, panier);
  }

  return ETAPES.filter((e) => paniers.has(e.libelle)).map((e) => ({
    libelle: e.libelle,
    regles: paniers.get(e.libelle)!,
  }));
}

/** Les âges sont stockés en jours ; les soignants raisonnent en semaines et mois. */
function formatAge(jours: number): string {
  if (jours === 0) return "naissance";
  if (jours < 60) return `${Math.round(jours / 7)} semaines`;
  if (jours < 730) return `${Math.round(jours / 30.4)} mois`;
  return `${Math.round(jours / 365)} ans`;
}
