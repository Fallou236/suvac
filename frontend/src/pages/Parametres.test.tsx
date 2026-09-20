import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rendre } from "@/tests/utilitaires";
import { serveur, http, HttpResponse } from "@/tests/serveur";
import { useAuthentification } from "@/etat/authentification";
import Parametres from "./Parametres";

function connecter(surcharges = {}) {
  useAuthentification.getState().definirUtilisateur({
    id: "u1",
    username: "awa.ndiaye",
    first_name: "Awa",
    last_name: "Ndiaye",
    nom_complet: "Awa Ndiaye",
    email: "",
    role: "agent",
    telephone: "+221771000001",
    langue: "fr",
    poste: {
      id: "p1",
      nom: "Poste de Ndondol",
      district: "Bambey",
      region: "Diourbel",
      actif: true,
    },
    ...surcharges,
  } as never);
}

describe("Parametres", () => {
  it("pré-remplit le profil de l'utilisateur connecté", () => {
    connecter();
    rendre(<Parametres />);

    expect(screen.getByLabelText(/prénom/i)).toHaveValue("Awa");
    expect(screen.getByLabelText(/^nom/i)).toHaveValue("Ndiaye");
  });

  it("affiche le rôle et le poste de rattachement", () => {
    connecter();
    rendre(<Parametres />);

    expect(screen.getByText(/agent de santé/i)).toBeInTheDocument();
    expect(screen.getAllByText("Poste de Ndondol").length).toBeGreaterThan(0);
  });

  it("signale qu'un administrateur n'a pas de poste", () => {
    connecter({ role: "admin", poste: null });
    rendre(<Parametres />);

    expect(screen.getByText(/administrateur/i)).toBeInTheDocument();
    expect(screen.getByText("Aucun")).toBeInTheDocument();
  });

  it("enregistre les modifications du profil", async () => {
    const utilisateur = userEvent.setup();
    connecter();
    let corpsRecu: Record<string, unknown> | null = null;

    serveur.use(
      http.patch("/api/auth/profil/", async ({ request }) => {
        corpsRecu = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          id: "u1",
          username: "awa.ndiaye",
          first_name: "Awa",
          last_name: "Sow",
          nom_complet: "Awa Sow",
          role: "agent",
          langue: "fr",
          telephone: "+221771000001",
          poste: null,
        });
      }),
    );

    rendre(<Parametres />);

    const champNom = screen.getByLabelText("Nom");
    await utilisateur.clear(champNom);
    await utilisateur.type(champNom, "Sow");
    await utilisateur.click(
      screen.getByRole("button", { name: /enregistrer le profil/i }),
    );

    await waitFor(() => expect(corpsRecu).not.toBeNull());
    expect(corpsRecu).toMatchObject({ last_name: "Sow" });
    expect(await screen.findByText(/modifications enregistrées/i)).toBeInTheDocument();
  });

  it("refuse de soumettre deux mots de passe discordants", async () => {
    const utilisateur = userEvent.setup();
    connecter();
    rendre(<Parametres />);

    await utilisateur.type(screen.getByLabelText(/mot de passe actuel/i), "ancien");
    await utilisateur.type(screen.getByLabelText(/nouveau mot de passe/i), "abcdefghij");
    await utilisateur.type(screen.getByLabelText(/confirmation/i), "different");

    expect(await screen.findByText(/les deux saisies diffèrent/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /modifier/i })).toBeDisabled();
  });

  it("explique le refus quand l'ancien mot de passe est incorrect", async () => {
    const utilisateur = userEvent.setup();
    connecter();

    serveur.use(
      http.post("/api/auth/mot-de-passe/", () =>
        HttpResponse.json(
          { ancien_mot_de_passe: ["Mot de passe actuel incorrect."] },
          { status: 400 },
        ),
      ),
    );

    rendre(<Parametres />);

    await utilisateur.type(screen.getByLabelText(/mot de passe actuel/i), "faux");
    await utilisateur.type(screen.getByLabelText(/nouveau mot de passe/i), "abcdefghij");
    await utilisateur.type(screen.getByLabelText(/confirmation/i), "abcdefghij");
    await utilisateur.click(screen.getByRole("button", { name: /modifier/i }));

    expect(
      await screen.findByText(/mot de passe actuel incorrect/i),
    ).toBeInTheDocument();
  });

  it("confirme le changement de mot de passe", async () => {
    const utilisateur = userEvent.setup();
    connecter();

    serveur.use(
      http.post("/api/auth/mot-de-passe/", () =>
        new HttpResponse(null, { status: 204 }),
      ),
    );

    rendre(<Parametres />);

    await utilisateur.type(screen.getByLabelText(/mot de passe actuel/i), "ancien");
    await utilisateur.type(screen.getByLabelText(/nouveau mot de passe/i), "abcdefghij");
    await utilisateur.type(screen.getByLabelText(/confirmation/i), "abcdefghij");
    await utilisateur.click(screen.getByRole("button", { name: /modifier/i }));

    expect(await screen.findByText(/mot de passe modifié/i)).toBeInTheDocument();
  });
});
