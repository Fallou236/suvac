import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rendre } from "@/tests/utilitaires";
import { serveur, http, HttpResponse } from "@/tests/serveur";
import Connexion from "./Connexion";

describe("Connexion", () => {
  it("désactive le bouton tant que les champs sont vides", () => {
    rendre(<Connexion />);

    expect(screen.getByRole("button", { name: /se connecter/i })).toBeDisabled();
  });

  it("explique un identifiant incorrect plutôt qu'une erreur technique", async () => {
    const utilisateur = userEvent.setup();

    serveur.use(
      http.post("/api/auth/connexion/", () =>
        new HttpResponse(null, { status: 401 }),
      ),
    );

    rendre(<Connexion />);

    await utilisateur.type(screen.getByLabelText(/identifiant/i), "awa.ndiaye");
    await utilisateur.type(screen.getByLabelText(/mot de passe/i), "faux");
    await utilisateur.click(screen.getByRole("button", { name: /se connecter/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/incorrect/i);
  });

  it("connecte l'agent et retient son profil", async () => {
    const utilisateur = userEvent.setup();

    serveur.use(
      http.post("/api/auth/connexion/", () =>
        HttpResponse.json({
          access: "jeton-acces",
          refresh: "jeton-rafraichissement",
          utilisateur: {
            id: "u1",
            username: "awa.ndiaye",
            nom_complet: "Awa Ndiaye",
            role: "agent",
            poste: { id: "p1", nom: "Poste de Ndondol" },
          },
        }),
      ),
    );

    rendre(<Connexion />);

    await utilisateur.type(screen.getByLabelText(/identifiant/i), "awa.ndiaye");
    await utilisateur.type(screen.getByLabelText(/mot de passe/i), "motdepasse");
    await utilisateur.click(screen.getByRole("button", { name: /se connecter/i }));

    const { useAuthentification } = await import("@/etat/authentification");
    await screen.findByRole("button", { name: /se connecter/i });
    expect(useAuthentification.getState().connecte).toBe(true);
  });
});
