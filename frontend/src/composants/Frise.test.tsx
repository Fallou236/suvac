import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Frise } from "./Frise";
import type { Echeance } from "@/api/types";

function echeance(partiel: Partial<Echeance> & { id: string }): Echeance {
  return {
    vaccin_code: "PENTA",
    vaccin_libelle: "Pentavalent",
    rang: 1,
    age_cible_jours: 42,
    date_ouverture: "2026-02-12",
    date_cible: "2026-02-12",
    date_limite: "2026-12-27",
    statut: "a_venir",
    motif_annulation: "",
    retard_jours: 0,
    dose: null,
    ...partiel,
  } as Echeance;
}

describe("Frise", () => {
  it("regroupe les doses par étape d'âge", () => {
    render(
      <Frise
        echeances={[
          echeance({ id: "1", vaccin_code: "BCG", age_cible_jours: 0 }),
          echeance({ id: "2", vaccin_code: "PENTA", age_cible_jours: 42 }),
          echeance({ id: "3", vaccin_code: "RR", age_cible_jours: 270 }),
        ]}
      />,
    );

    expect(screen.getByText("Naissance")).toBeInTheDocument();
    expect(screen.getByText("6 semaines")).toBeInTheDocument();
    expect(screen.getByText("9 mois")).toBeInTheDocument();
  });

  it("affiche le compte de doses reçues en mode compact", () => {
    render(
      <Frise
        compacte
        echeances={[
          echeance({ id: "1", statut: "administree" }),
          echeance({ id: "2", statut: "administree" }),
          echeance({ id: "3", statut: "due" }),
        ]}
      />,
    );

    expect(screen.getByText(/2\/3/)).toBeInTheDocument();
  });

  it("signale les retards en mode compact", () => {
    render(
      <Frise
        compacte
        echeances={[
          echeance({ id: "1", statut: "en_retard" }),
          echeance({ id: "2", statut: "due" }),
        ]}
      />,
    );

    expect(screen.getByText(/1 en retard/)).toBeInTheDocument();
  });
});
