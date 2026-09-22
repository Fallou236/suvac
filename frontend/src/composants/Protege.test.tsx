import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useAuthentification } from "@/etat/authentification";
import { PERSONNEL } from "@/etat/navigation";
import { connecterMere } from "@/tests/espace";
import { Protege } from "./Protege";

function afficher(route: string) {
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route
          path="/"
          element={
            <Protege roles={PERSONNEL}>
              <p>File du jour</p>
            </Protege>
          }
        />
        <Route
          path="/mon-espace"
          element={
            <Protege roles={["beneficiaire"]}>
              <p>Espace de la mère</p>
            </Protege>
          }
        />
        <Route path="/connexion" element={<p>Page de connexion</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function connecterAgent() {
  useAuthentification.getState().definirUtilisateur({
    id: "a1",
    username: "awa.ndiaye",
    nom_complet: "Awa Ndiaye",
    role: "agent",
    poste: { id: "p1", nom: "Poste de Ndondol" },
  } as never);
}

describe("Protege", () => {
  it("renvoie vers la connexion un visiteur non connecté", () => {
    useAuthentification.getState().deconnexion();
    afficher("/");
    expect(screen.getByText("Page de connexion")).toBeInTheDocument();
  });

  it("laisse passer un agent vers la file du jour", () => {
    connecterAgent();
    afficher("/");
    expect(screen.getByText("File du jour")).toBeInTheDocument();
  });

  it("renvoie une mère vers son espace si elle vise un écran professionnel", () => {
    connecterMere();
    afficher("/");
    expect(screen.getByText("Espace de la mère")).toBeInTheDocument();
  });

  it("renvoie un agent vers la file du jour s'il vise l'espace d'une mère", () => {
    connecterAgent();
    afficher("/mon-espace");
    expect(screen.getByText("File du jour")).toBeInTheDocument();
  });
});
