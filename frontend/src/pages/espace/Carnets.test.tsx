import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { rendre } from "@/tests/utilitaires";
import { connecterMere, servirEspace } from "@/tests/espace";
import Carnets from "./Carnets";

function afficher(route = "/mon-espace/carnets") {
  return rendre(
    <Routes>
      <Route path="/mon-espace/carnets" element={<Carnets />} />
      <Route path="/mon-espace/carnets/:id" element={<Carnets />} />
    </Routes>,
    { route },
  );
}

describe("Carnets", () => {
  it("liste un carnet par enfant et par grossesse", async () => {
    connecterMere();
    servirEspace();
    afficher();

    expect(await screen.findByText("Sokhna Ba")).toBeInTheDocument();
    expect(screen.getByText("Ma grossesse 2")).toBeInTheDocument();
  });

  it("ouvre le carnet choisi", async () => {
    const utilisateur = userEvent.setup();
    connecterMere();
    servirEspace();
    afficher();

    await utilisateur.click(await screen.findByText("Sokhna Ba"));

    expect(
      await screen.findByRole("heading", { name: "Sokhna Ba" }),
    ).toBeInTheDocument();
  });

  it("regroupe les vaccins par âge, comme le carnet papier", async () => {
    connecterMere();
    servirEspace();
    afficher("/mon-espace/carnets/e1");

    expect(await screen.findByText(/à la naissance/i)).toBeInTheDocument();
    expect(screen.getByText(/à 6 semaines/i)).toBeInTheDocument();
  });

  it("indique la date à laquelle une dose a été reçue", async () => {
    connecterMere();
    servirEspace();
    afficher("/mon-espace/carnets/e1");

    expect(await screen.findByText(/reçu le 5 juillet 2026/i)).toBeInTheDocument();
  });

  it("explique qu'une dose périmée ne peut plus être faite", async () => {
    connecterMere();
    servirEspace();
    afficher("/mon-espace/carnets/e1");

    expect(
      await screen.findByText(/ne peut plus être administré/i),
    ).toBeInTheDocument();
  });

  it("présente le carnet de grossesse comme un suivi antitétanique", async () => {
    connecterMere();
    servirEspace();
    afficher("/mon-espace/carnets/g1");

    expect(await screen.findByText(/suivi de grossesse/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /vaccin antitétanique/i }),
    ).toBeInTheDocument();
  });
});
