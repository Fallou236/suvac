import type { EcheanceFile } from "@/api/types";

export type GroupeBeneficiaire = {
  id: string;
  nom: string;
  type: string;
  telephone: string;
  /** Tout le calendrier, pour la frise de progression. */
  calendrier: EcheanceFile[];
  /** Ce qui appelle une action : dû ou en retard, jamais périmé. */
  aFaire: EcheanceFile[];
  retardMaximal: number;
  section: "aujourdhui" | "retard" | "rattrapage";
  dosesFaites: number;
  mereNom: string;
};

/**
 * Trois sections plutôt qu'une liste indifférenciée :
 *   — aujourd'hui : une dose tombe précisément ce jour ;
 *   — en retard   : la fenêtre de rattrapage se referme ;
 *   — à rattraper : due depuis longtemps, sans urgence du jour.
 *
 * Les échéances périmées sont écartées côté serveur : elles ne sont plus
 * administrables.
 */
export function grouperParBeneficiaire(
  calendriers: EcheanceFile[],
  jour: string,
): GroupeBeneficiaire[] {
  const index = new Map<string, GroupeBeneficiaire>();

  for (const echeance of calendriers) {
    const cle = echeance.beneficiaire_id;
    let groupe = index.get(cle);

    if (!groupe) {
      groupe = {
        id: cle,
        nom: echeance.beneficiaire_nom,
        type: echeance.beneficiaire_type,
        telephone: echeance.telephone ?? "",
        calendrier: [],
        aFaire: [],
        retardMaximal: 0,
        section: "rattrapage",
        dosesFaites: 0,
        mereNom: echeance.mere_nom ?? "",
      };
      index.set(cle, groupe);
    }

    groupe.calendrier.push(echeance);
    if (echeance.statut === "administree") groupe.dosesFaites += 1;

    if (echeance.statut === "due" || echeance.statut === "en_retard") {
      groupe.aFaire.push(echeance);
      const retard = echeance.retard_jours ?? 0;
      if (retard > groupe.retardMaximal) groupe.retardMaximal = retard;
    }
  }

  for (const groupe of index.values()) {
    groupe.calendrier.sort((a, b) => a.date_cible.localeCompare(b.date_cible));
    groupe.aFaire.sort((a, b) => (b.retard_jours ?? 0) - (a.retard_jours ?? 0));

    const duAujourdhui = groupe.aFaire.some((e) => e.date_cible === jour);
    const enRetard = groupe.aFaire.some((e) => e.statut === "en_retard");

    groupe.section = duAujourdhui
      ? "aujourdhui"
      : enRetard
        ? "retard"
        : "rattrapage";
  }

  return [...index.values()]
    .filter((g) => g.aFaire.length > 0)
    .sort((a, b) => b.retardMaximal - a.retardMaximal);
}

export const SECTIONS = [
  { cle: "aujourdhui", titre: "Aujourd'hui", ton: "accent" },
  { cle: "retard", titre: "En retard", ton: "alerte" },
  { cle: "rattrapage", titre: "À rattraper", ton: "neutre" },
] as const;
