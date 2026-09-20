import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { requetes } from "@/api/requetes";
import { Coquille } from "@/composants/Coquille";
import { Indicateur } from "@/composants/Indicateur";
import { Chargement } from "@/composants/Chargement";
import { Bouton } from "@/composants/Bouton";
import { Etiquette } from "@/composants/Etiquette";
import { COULEURS, couleurTaux, formatMois } from "@/composants/graphiques";
import { messageDErreur } from "@/etat/messages";
import type { Couverture, LigneRetard } from "@/api/requetes";

export default function Pilotage() {
  const synthese = useQuery({
    queryKey: ["pilotage", "synthese"],
    queryFn: requetes.synthese,
  });
  const couverture = useQuery({
    queryKey: ["pilotage", "couverture"],
    queryFn: requetes.couverture,
  });
  const abandon = useQuery({
    queryKey: ["pilotage", "abandon"],
    queryFn: requetes.abandon,
  });
  const activite = useQuery({
    queryKey: ["pilotage", "activite"],
    queryFn: () => requetes.activite(12),
  });
  const retards = useQuery({
    queryKey: ["pilotage", "retards"],
    queryFn: () => requetes.retards(50),
  });

  if (synthese.isPending) {
    return (
      <Coquille titre="Pilotage">
        <Chargement />
      </Coquille>
    );
  }

  if (synthese.error) {
    return (
      <Coquille titre="Pilotage">
        <div className="px-6 py-16 text-center">
          <p className="text-retard">{messageDErreur(synthese.error)}</p>
          <Bouton
            variante="secondaire"
            taille="compact"
            className="mt-4"
            onClick={() => synthese.refetch()}
          >
            Réessayer
          </Bouton>
        </div>
      </Coquille>
    );
  }

  return (
    <Coquille
      titre="Pilotage"
      actions={
        <span className="hidden text-xs text-texte-faible sm:block">
          {synthese.data.poste}
          <span aria-hidden="true"> · </span>
          arrêté au {formatDate(synthese.data.arrete_au)}
        </span>
      }
    >
      <div className="defilement h-full overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 p-5">
          <section aria-label="Chiffres clés">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Indicateur
                libelle="Enfants suivis"
                valeur={synthese.data.enfants_suivis}
                precision="Enregistrés dans le poste"
              />
              <Indicateur
                libelle="Couverture globale"
                valeur={synthese.data.couverture_globale}
                unite="%"
                ton={synthese.data.couverture_globale >= 70 ? "succes" : "accent"}
                precision="Doses reçues sur doses dues"
              />
              <Indicateur
                libelle="En retard"
                valeur={synthese.data.en_retard}
                ton={synthese.data.en_retard > 0 ? "alerte" : "neutre"}
                precision="Échéances encore rattrapables"
              />
              <Indicateur
                libelle="Périmées"
                valeur={synthese.data.perimees}
                precision="Fenêtre de rattrapage close"
              />
            </div>
          </section>

          <Carte
            titre="Couverture par vaccin"
            description="Part des doses administrées parmi celles arrivées à terme. Les échéances non encore dues sont exclues du calcul."
            chargement={couverture.isPending}
          >
            {couverture.data && couverture.data.length > 0 ? (
              <GraphiqueCouverture donnees={couverture.data} />
            ) : (
              <Vide />
            )}
          </Carte>

          <div className="grid gap-6 lg:grid-cols-2">
            <Carte
              titre="Activité mensuelle"
              description="Doses administrées sur les douze derniers mois."
              chargement={activite.isPending}
            >
              {activite.data && activite.data.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={activite.data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid stroke={COULEURS.bordure} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="mois"
                      tickFormatter={formatMois}
                      tick={{ fill: COULEURS.texteFaible, fontSize: 11 }}
                      axisLine={{ stroke: COULEURS.bordure }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: COULEURS.texteFaible, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      labelFormatter={formatMois}
                      formatter={(valeur: number) => [valeur, "doses"]}
                      contentStyle={{
                        border: `1px solid ${COULEURS.bordure}`,
                        borderRadius: 8,
                        fontSize: 13,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="doses"
                      stroke={COULEURS.baobab}
                      strokeWidth={2}
                      dot={{ r: 3, fill: COULEURS.baobab }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Vide />
              )}
            </Carte>

            <Carte
              titre="Taux d'abandon"
              description="Bénéficiaires ayant reçu la première dose sans recevoir la dernière."
              chargement={abandon.isPending}
            >
              {abandon.data && abandon.data.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {abandon.data.map((serie) => (
                    <li key={serie.code}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-texte">
                          {serie.libelle}
                        </span>
                        <span
                          className={`tabulaire text-sm font-bold ${
                            serie.taux > 10 ? "text-retard" : "text-baobab"
                          }`}
                        >
                          {serie.taux} %
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-basse">
                        <div
                          className="h-full rounded-full transition-[width] duration-[200ms]"
                          style={{
                            width: `${Math.min(serie.taux, 100)}%`,
                            background:
                              serie.taux > 10 ? COULEURS.retard : COULEURS.baobab,
                          }}
                        />
                      </div>
                      <p className="tabulaire mt-1 text-xs text-texte-faible">
                        {serie.premiere_dose} commencées
                        <span aria-hidden="true"> · </span>
                        {serie.derniere_dose} terminées
                        {serie.premiere_dose < 10 && (
                          <span className="ml-1.5 italic">
                            — effectif trop faible pour conclure
                          </span>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <Vide message="Aucune série commencée." />
              )}
            </Carte>
          </div>

          <Carte
            titre="Enfants en retard"
            description="Triés par urgence : la fenêtre de rattrapage qui se referme le plus tôt d'abord."
            chargement={retards.isPending}
            action={
              retards.data &&
              retards.data.length > 0 && (
                <Bouton
                  variante="secondaire"
                  taille="compact"
                  onClick={() => exporterCsv(retards.data)}
                >
                  Exporter en CSV
                </Bouton>
              )
            }
          >
            {retards.data && retards.data.length > 0 ? (
              <TableauRetards lignes={retards.data} />
            ) : (
              <Vide message="Aucun enfant en retard." />
            )}
          </Carte>
        </div>
      </div>
    </Coquille>
  );
}

/* ---------------------------------------------------------------- */

function Carte({
  titre,
  description,
  action,
  chargement,
  children,
}: {
  titre: string;
  description?: string;
  action?: React.ReactNode;
  chargement?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-bordure bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-texte">{titre}</h2>
          {description && (
            <p className="mt-0.5 max-w-xl text-sm text-texte-faible">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>

      {chargement ? (
        <div className="grid h-40 place-items-center">
          <span className="size-6 animate-spin rounded-full border-2 border-cuivre border-t-transparent" />
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function GraphiqueCouverture({ donnees }: { donnees: Couverture[] }) {
  const barres = donnees.map((c) => ({
    ...c,
    etiquette: `${c.code}-${c.rang}`,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(260, barres.length * 26)}>
      <BarChart
        data={barres}
        layout="vertical"
        margin={{ top: 4, right: 40, bottom: 4, left: 8 }}
      >
        <CartesianGrid stroke={COULEURS.bordure} strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          unit="%"
          tick={{ fill: COULEURS.texteFaible, fontSize: 11 }}
          axisLine={{ stroke: COULEURS.bordure }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="etiquette"
          width={78}
          tick={{ fill: COULEURS.texteFaible, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(20,67,46,0.04)" }}
          formatter={(valeur: number, _nom, entree) => [
            `${valeur} % — ${entree.payload.administres}/${entree.payload.attendus}`,
            entree.payload.libelle,
          ]}
          contentStyle={{
            border: `1px solid ${COULEURS.bordure}`,
            borderRadius: 8,
            fontSize: 13,
          }}
        />
        <Bar dataKey="taux" radius={[0, 3, 3, 0]} barSize={14}>
          <LabelList
            dataKey="taux"
            position="right"
            formatter={(v: number) => `${v} %`}
            style={{ fill: COULEURS.texteFaible, fontSize: 11 }}
          />
          {barres.map((barre) => (
            <Cell key={barre.etiquette} fill={couleurTaux(barre.taux)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TableauRetards({ lignes }: { lignes: LigneRetard[] }) {
  return (
    <div className="defilement -mx-1 overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-bordure text-left">
            <th className="pb-2 pr-3 font-semibold text-texte-faible">Enfant</th>
            <th className="pb-2 pr-3 font-semibold text-texte-faible">Mère</th>
            <th className="pb-2 pr-3 font-semibold text-texte-faible">Village</th>
            <th className="pb-2 pr-3 font-semibold text-texte-faible">Vaccin</th>
            <th className="pb-2 pr-3 font-semibold text-texte-faible">Limite</th>
            <th className="pb-2 font-semibold text-texte-faible">Contact</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne, index) => (
            <tr
              key={`${ligne.enfant_id}-${ligne.vaccin}-${index}`}
              className="border-b border-bordure/60 last:border-0"
            >
              <td className="py-2 pr-3 font-medium text-texte">{ligne.enfant}</td>
              <td className="py-2 pr-3 text-texte-faible">{ligne.mere}</td>
              <td className="py-2 pr-3 text-texte-faible">{ligne.village || "—"}</td>
              <td className="tabulaire py-2 pr-3">
                <Etiquette ton="alerte">{ligne.vaccin}</Etiquette>
              </td>
              <td className="tabulaire py-2 pr-3 text-texte-faible">
                {ligne.date_limite ? formatDate(ligne.date_limite) : "—"}
              </td>
              <td className="tabulaire py-2">
                {ligne.telephone ? (
                  <a
                    href={`tel:${ligne.telephone}`}
                    className="font-medium text-cuivre underline-offset-2 hover:underline"
                  >
                    {ligne.telephone}
                  </a>
                ) : (
                  <span className="text-texte-faible/60">Sans téléphone</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Vide({ message = "Aucune donnée disponible." }: { message?: string }) {
  return (
    <p className="py-8 text-center text-sm text-texte-faible">{message}</p>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** EF-64 : export local, sans passer par le serveur. */
function exporterCsv(lignes: LigneRetard[]) {
  const entetes = ["Enfant", "Mère", "Village", "Vaccin", "Date limite", "Téléphone"];
  const corps = lignes.map((l) =>
    [l.enfant, l.mere, l.village, l.vaccin, l.date_limite ?? "", l.telephone]
      .map((champ) => `"${String(champ).replace(/"/g, '""')}"`)
      .join(";"),
  );

  // Le point-virgule et la marque d'ordre d'octets sont nécessaires pour
  // qu'Excel en français ouvre correctement le fichier.
  const contenu = "\uFEFF" + [entetes.join(";"), ...corps].join("\r\n");
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(new Blob([contenu], { type: "text/csv" }));
  lien.download = `suvac-retards-${new Date().toISOString().slice(0, 10)}.csv`;
  lien.click();
  URL.revokeObjectURL(lien.href);
}
