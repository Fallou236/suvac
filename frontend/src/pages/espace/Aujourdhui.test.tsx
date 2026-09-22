import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { rendre } from "@/tests/utilitaires";
import { connecterMere, servirEspace } from "@/tests/espace";
import Aujourdhui from "./Aujourdhui";

describe("Aujourdhui", () => {
  it("salue la mère par son prénom", async () => {
    connecterMere();
    servirEspace();
    rendre(<Aujourdhui />);

    expect(await screen.findByText("Bonjour Rokhaya")).toBeInTheDocument();
  });

  it("met les vaccins en retard dans une section à part", async () => {
    connecterMere();
    servirEspace();
    rendre(<Aujourdhui />);

    expect(
      await screen.findByRole("heading", { name: /à rattraper/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/il est encore temps/i)).toBeInTheDocument();
  });

  it("rapporte les doses reçues aux seules doses arrivées à échéance", async () => {
    // BCG reçu, VPO en retard, Td dû : 1 sur 3. Pentavalent à venir et
    // rotavirus périmé n'entrent pas au dénominateur.
    connecterMere();
    servirEspace();
    rendre(<Aujourdhui />);

    expect(await screen.findByText("1/3")).toBeInTheDocument();
  });

  it("s'adresse à la mère pour ses propres rendez-vous", async () => {
    connecterMere();
    servirEspace();
    rendre(<Aujourdhui />);

    expect(await screen.findByText(/prochains rendez-vous/i)).toBeInTheDocument();
    expect(screen.getByText("pour vous")).toBeInTheDocument();
  });

  it("rassure quand rien n'est à faire", async () => {
    connecterMere();
    servirEspace({ rappels: [] });
    rendre(<Aujourdhui />);

    expect(await screen.findByText(/tout est à jour/i)).toBeInTheDocument();
  });
});
