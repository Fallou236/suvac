import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rendre } from "@/tests/utilitaires";
import { serveur, http, HttpResponse } from "@/tests/serveur";
import { useAuthentification } from "@/etat/authentification";
import ChangementObligatoire from "./ChangementObligatoire";

function connecter(surcharges = {}) {
  useAuthentification.getState().definirUtilisateur({
    id: "a1",
    username: "moussa.sow",
    nom_complet: "Moussa Sow",
    role: "agent",
    poste: { id: "p1", nom: "Poste de Ndondol" },
    doit_changer_mot_de_passe: true,
    ...surcharges,
  } as never);
}

describe("ChangementObligatoire", () => {
  it("explique pourquoi le changement est imposé", () => {
    connecter();
    rendre(<ChangementObligatoire />);

    expect(
      screen.getByText(/connu d'une autre personne/i),
    ).toBeInTheDocument();
  });

  it("refuse un mot de passe trop court", async () => {
    const utilisateur = userEvent.setup();
    connecter();
    rendre(<ChangementObligatoire />);

    await utilisateur.type(screen.getByLabelText(/mot de passe reçu/i), "ancien");
    await utilisateur.type(screen.getByLabelText(/nouveau mot de passe/i), "court");

    expect(
      screen.getByRole("button", { name: /enregistrer et continuer/i }),
    ).toBeDisabled();
  });

  it("refuse deux saisies discordantes", async () => {
    const utilisateur = userEvent.setup();
    connecter();
    rendre(<ChangementObligatoire />);

    await utilisateur.type(screen.getByLabelText(/mot de passe reçu/i), "ancien");
    await utilisateur.type(
      screen.getByLabelText(/nouveau mot de passe/i),
      "Ndondol-2026",
    );
    await utilisateur.type(screen.getByLabelText(/confirmation/i), "different");

    expect(await screen.findByText(/les deux saisies diffèrent/i)).toBeInTheDocument();
  });

  it("enregistre le nouveau mot de passe", async () => {
    const utilisateur = userEvent.setup();
    connecter();
    let corpsRecu: Record<string, unknown> | null = null;

    serveur.use(
      http.post("/api/auth/mot-de-passe/", async ({ request }) => {
        corpsRecu = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ access: "a", refresh: "r" });
      }),
    );

    rendre(<ChangementObligatoire />);

    await utilisateur.type(screen.getByLabelText(/mot de passe reçu/i), "provisoire");
    await utilisateur.type(
      screen.getByLabelText(/nouveau mot de passe/i),
      "Ndondol-2026",
    );
    await utilisateur.type(screen.getByLabelText(/confirmation/i), "Ndondol-2026");
    await utilisateur.click(
      screen.getByRole("button", { name: /enregistrer et continuer/i }),
    );

    await waitFor(() => expect(corpsRecu).not.toBeNull());
    expect(corpsRecu).toMatchObject({
      ancien_mot_de_passe: "provisoire",
      nouveau_mot_de_passe: "Ndondol-2026",
    });
  });

  it("explique le refus d'un mot de passe incorrect", async () => {
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

    rendre(<ChangementObligatoire />);

    await utilisateur.type(screen.getByLabelText(/mot de passe reçu/i), "faux");
    await utilisateur.type(
      screen.getByLabelText(/nouveau mot de passe/i),
      "Ndondol-2026",
    );
    await utilisateur.type(screen.getByLabelText(/confirmation/i), "Ndondol-2026");
    await utilisateur.click(
      screen.getByRole("button", { name: /enregistrer et continuer/i }),
    );

    expect(
      await screen.findByText(/mot de passe actuel incorrect/i),
    ).toBeInTheDocument();
  });

  it("permet de se déconnecter sans changer", async () => {
    connecter();
    rendre(<ChangementObligatoire />);

    expect(
      screen.getByRole("button", { name: /se déconnecter/i }),
    ).toBeInTheDocument();
  });
});
