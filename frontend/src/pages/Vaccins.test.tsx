import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rendre } from "@/tests/utilitaires";
import { connecterMere, servirEspace } from "@/tests/espace";
import Vaccins from "./Vaccins";

describe("Vaccins", () => {
  it("liste toutes les fiches", async () => {
    connecterMere();
    servirEspace();
    rendre(<Vaccins />);

    expect(await screen.findByText("Pentavalent")).toBeInTheDocument();
    expect(screen.getByText("Rotavirus")).toBeInTheDocument();
  });

  it("présente l'intérêt de la vaccination tant qu'aucune fiche n'est choisie", async () => {
    connecterMere();
    servirEspace();
    rendre(<Vaccins />);

    expect(await screen.findByText(/pourquoi vacciner/i)).toBeInTheDocument();
  });

  it("ouvre la fiche au clic", async () => {
    const utilisateur = userEvent.setup();
    connecterMere();
    servirEspace();
    rendre(<Vaccins />);

    await utilisateur.click(await screen.findByText("Pentavalent"));

    expect(
      await screen.findByRole("heading", { name: "Pentavalent" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Trois doses sont nécessaires.")).toBeInTheDocument();
  });

  it("ouvre directement la fiche désignée dans l'adresse", async () => {
    connecterMere();
    servirEspace();
    rendre(<Vaccins />, { route: "/vaccins?code=BCG" });

    expect(await screen.findByRole("heading", { name: "BCG" })).toBeInTheDocument();
    expect(screen.getByText(/protège contre/i)).toBeInTheDocument();
  });

  it("rappelle que la fiche ne remplace pas l'agent de santé", async () => {
    connecterMere();
    servirEspace();
    rendre(<Vaccins />, { route: "/vaccins?code=BCG" });

    expect(
      await screen.findByText(/ne remplacent pas les conseils/i),
    ).toBeInTheDocument();
  });
});
