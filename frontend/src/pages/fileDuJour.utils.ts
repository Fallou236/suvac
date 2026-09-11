import type { EcheanceFile } from "@/api/types";

export type GroupeBeneficiaire = {
  id: string;
  nom: string;
  type: string;
  telephone: string;
  echeances: EcheanceFile[];
  retardMaximal: number;
  aDuRetard: boolean;
};

/**
 * Un bénéficiaire vient une fois et reçoit plusieurs vaccins : la file doit
 * refléter cette réalité plutôt que d'aligner une ligne par dose.
 */
export function grouperParBeneficiaire(
  echeances: EcheanceFile[],
): GroupeBeneficiaire[] {
  const index = new Map<string, GroupeBeneficiaire>();

  for (const echeance of echeances) {
    const cle = echeance.beneficiaire_id;
    let groupe = index.get(cle);

    if (!groupe) {
      groupe = {
        id: cle,
        nom: echeance.beneficiaire_nom,
        type: echeance.beneficiaire_type,
        telephone: echeance.telephone ?? "",
        echeances: [],
        retardMaximal: 0,
        aDuRetard: false,
      };
      index.set(cle, groupe);
    }

    groupe.echeances.push(echeance);

    const retard = echeance.retard_jours ?? 0;
    if (retard > groupe.retardMaximal) groupe.retardMaximal = retard;
    if (echeance.statut === "en_retard") groupe.aDuRetard = true;
  }

    // Les retards d'abord à l'intérieur de chaque carte.
  for (const groupe of index.values()) {
    groupe.echeances.sort((a, b) => {
      const ra = a.retard_jours ?? 0;
      const rb = b.retard_jours ?? 0;
      if (ra !== rb) return rb - ra;
      return a.date_cible.localeCompare(b.date_cible);
    });
  }

  // Les retards les plus anciens d'abord : c'est là que l'action presse.
  return [...index.values()].sort((a, b) => {
    if (a.aDuRetard !== b.aDuRetard) return a.aDuRetard ? -1 : 1;
    return b.retardMaximal - a.retardMaximal;
  });
}
