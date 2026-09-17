import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rendre } from "@/tests/utilitaires";
import { serveur, http, HttpResponse } from "@/tests/serveur";
import { useAuthentification } from "@/etat/authentification";
import Beneficiaires from "./Beneficiaires";

function connecter() {
  useAuthentification.getState().definirUtilisateur({
    id: "u1",
    username: "awa.ndiaye",
    nom_complet: "Awa Ndiaye",
    role: "agent",
    poste: { id: "p1", nom: "Poste de Ndondol" },
  } as never);
}

const MERE = {
  id: "mere-1",
  prenom: "Khady",
  nom: "Ndiaye",
  nom_complet: "Khady Ndiaye",
  telephone: "+221771000001",
  village: "Ndondol",
};

function servirMeres(resultats: unknown[] = [MERE]) {
  serveur.use(
    http.get("/api/meres/", () =>
      HttpResponse.json({
        count: resultats.length,
        next: null,
        previous: null,
        results: resultats,
      }),
    ),
  );
}

describe("Beneficiaires", () => {
  it("liste les mères du poste", async () => {
    connecter();
    servirMeres();
    rendre(<Beneficiaires />);

    expect(await screen.findByText("Khady Ndiaye")).toBeInTheDocument();
  });

  it("invite à enregistrer une mère quand la liste est vide", async () => {
    connecter();
    servirMeres([]);
    rendre(<Beneficiaires />);

    expect(
      await screen.findByText(/aucune mère enregistrée/i),
    ).toBeInTheDocument();
  });

  it("ouvre le formulaire de création", async () => {
    const utilisateur = userEvent.setup();
    connecter();
    servirMeres();
    rendre(<Beneficiaires />);

    await utilisateur.click(
      await screen.findByRole("button", { name: /nouvelle mère/i }),
    );

    expect(
      await screen.findByRole("heading", { name: /enregistrer une mère/i }),
    ).toBeInTheDocument();
  });

  it("ouvre la fiche de la mère au clic", async () => {
    const utilisateur = userEvent.setup();
    connecter();
    servirMeres();

    serveur.use(
      http.get("/api/meres/mere-1/", () =>
        HttpResponse.json({
          ...MERE,
          langue: "wo",
          accepte_les_rappels: true,
          consentements: [
            {
              id: "c1",
              canal: "whatsapp",
              accorde_le: "2026-01-15T10:00:00Z",
              revoque_le: null,
              actif: true,
            },
          ],
        }),
      ),
      http.get("/api/enfants/", () =>
        HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
      ),
    );

    rendre(<Beneficiaires />);
    await utilisateur.click(await screen.findByText("Khady Ndiaye"));

    expect(await screen.findByText(/rappels acceptés/i)).toBeInTheDocument();
    expect(
      screen.getByText(/aucun enfant enregistré/i),
    ).toBeInTheDocument();
  });

  it("signale l'absence de consentement sur la fiche", async () => {
    const utilisateur = userEvent.setup();
    connecter();
    servirMeres();

    serveur.use(
      http.get("/api/meres/mere-1/", () =>
        HttpResponse.json({
          ...MERE,
          langue: "fr",
          accepte_les_rappels: false,
          consentements: [],
        }),
      ),
      http.get("/api/enfants/", () =>
        HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
      ),
    );

    rendre(<Beneficiaires />);
    await utilisateur.click(await screen.findByText("Khady Ndiaye"));

    expect(
      await screen.findByText(/aucun rappel ne sera envoyé/i),
    ).toBeInTheDocument();
  });
});
