import { describe, expect, it } from "vitest";
import { grouperParBeneficiaire } from "./fileDuJour.utils";
import type { EcheanceFile } from "@/api/types";

const JOUR = "2026-06-15";

/** Construit une échéance minimale ; seuls les champs testés sont renseignés. */
function echeance(partiel: Partial<EcheanceFile> & { id: string }): EcheanceFile {
  return {
    vaccin_code: "PENTA",
    vaccin_libelle: "Pentavalent",
    rang: 1,
    age_cible_jours: 42,
    date_ouverture: JOUR,
    date_cible: JOUR,
    date_limite: "2026-12-31",
    statut: "due",
    motif_annulation: "",
    retard_jours: 0,
    dose: null,
    beneficiaire_nom: "Moussa Ndiaye",
    beneficiaire_id: "enfant-1",
    beneficiaire_type: "enfant",
    mere_nom: "Khady Ndiaye",
    telephone: "+221771000001",
    administrable: true,
    motif_non_administrable: [],
    ...partiel,
  } as EcheanceFile;
}

describe("grouperParBeneficiaire", () => {
  it("regroupe les échéances d'un même bénéficiaire", () => {
    const groupes = grouperParBeneficiaire(
      [
        echeance({ id: "1", vaccin_code: "BCG" }),
        echeance({ id: "2", vaccin_code: "VPO" }),
        echeance({ id: "3", vaccin_code: "PENTA" }),
      ],
      JOUR,
    );

    expect(groupes).toHaveLength(1);
    expect(groupes[0].calendrier).toHaveLength(3);
    expect(groupes[0].nom).toBe("Moussa Ndiaye");
  });

  it("sépare les bénéficiaires distincts", () => {
    const groupes = grouperParBeneficiaire(
      [
        echeance({ id: "1", beneficiaire_id: "a", beneficiaire_nom: "Awa" }),
        echeance({ id: "2", beneficiaire_id: "b", beneficiaire_nom: "Moussa" }),
      ],
      JOUR,
    );

    expect(groupes).toHaveLength(2);
  });

  it("écarte un bénéficiaire sans rien à faire", () => {
    const groupes = grouperParBeneficiaire(
      [echeance({ id: "1", statut: "administree" })],
      JOUR,
    );

    expect(groupes).toHaveLength(0);
  });

  it("classe en « aujourd'hui » une dose due ce jour", () => {
    const groupes = grouperParBeneficiaire(
      [echeance({ id: "1", date_cible: JOUR, statut: "due" })],
      JOUR,
    );

    expect(groupes[0].section).toBe("aujourdhui");
  });

  it("classe en « en retard » une dose dépassée", () => {
    const groupes = grouperParBeneficiaire(
      [
        echeance({
          id: "1",
          date_cible: "2026-01-10",
          statut: "en_retard",
          retard_jours: 90,
        }),
      ],
      JOUR,
    );

    expect(groupes[0].section).toBe("retard");
    expect(groupes[0].retardMaximal).toBe(90);
  });

  it("classe en « à rattraper » une dose due mais ancienne", () => {
    const groupes = grouperParBeneficiaire(
      [echeance({ id: "1", date_cible: "2026-05-01", statut: "due" })],
      JOUR,
    );

    expect(groupes[0].section).toBe("rattrapage");
  });

  it("exclut les doses périmées de ce qu'il y a à faire", () => {
    const groupes = grouperParBeneficiaire(
      [
        echeance({ id: "1", statut: "perimee" }),
        echeance({ id: "2", statut: "due" }),
      ],
      JOUR,
    );

    expect(groupes[0].calendrier).toHaveLength(2);
    expect(groupes[0].aFaire).toHaveLength(1);
  });

  it("compte les doses administrées", () => {
    const groupes = grouperParBeneficiaire(
      [
        echeance({ id: "1", statut: "administree" }),
        echeance({ id: "2", statut: "administree" }),
        echeance({ id: "3", statut: "due" }),
      ],
      JOUR,
    );

    expect(groupes[0].dosesFaites).toBe(2);
  });

  it("place les retards les plus anciens en tête", () => {
    const groupes = grouperParBeneficiaire(
      [
        echeance({
          id: "1", beneficiaire_id: "a", beneficiaire_nom: "Petit retard",
          statut: "en_retard", retard_jours: 10, date_cible: "2026-06-01",
        }),
        echeance({
          id: "2", beneficiaire_id: "b", beneficiaire_nom: "Gros retard",
          statut: "en_retard", retard_jours: 200, date_cible: "2026-01-01",
        }),
      ],
      JOUR,
    );

    expect(groupes[0].nom).toBe("Gros retard");
  });

  it("trie le calendrier par date cible", () => {
    const groupes = grouperParBeneficiaire(
      [
        echeance({ id: "1", date_cible: "2026-09-01", statut: "a_venir" }),
        echeance({ id: "2", date_cible: JOUR, statut: "due" }),
        echeance({ id: "3", date_cible: "2026-03-01", statut: "administree" }),
      ],
      JOUR,
    );

    const dates = groupes[0].calendrier.map((e) => e.date_cible);
    expect(dates).toEqual(["2026-03-01", JOUR, "2026-09-01"]);
  });

  it("reporte le nom de la mère et son téléphone", () => {
    const groupes = grouperParBeneficiaire([echeance({ id: "1" })], JOUR);

    expect(groupes[0].mereNom).toBe("Khady Ndiaye");
    expect(groupes[0].telephone).toBe("+221771000001");
  });
});
