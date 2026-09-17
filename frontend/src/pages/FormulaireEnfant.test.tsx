import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rendre } from "@/tests/utilitaires";
import { serveur, http, HttpResponse } from "@/tests/serveur";
import { FormulaireEnfant } from "./FormulaireEnfant";

describe("FormulaireEnfant", () => {
  it("demande d'abord de choisir la mère", () => {
    rendre(<FormulaireEnfant onTermine={vi.fn()} onAnnuler={vi.fn()} />);

    expect(screen.getByText(/sélectionnez d'abord la mère/i)).toBeInTheDocument();
  });

  it("passe au formulaire une fois la mère choisie", async () => {
    const utilisateur = userEvent.setup();

    serveur.use(
      http.get("/api/meres/", () =>
        HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: "mere-1",
              nom_complet: "Awa Ndiaye",
              telephone: "+221771000001",
            },
          ],
        }),
      ),
    );

    rendre(<FormulaireEnfant onTermine={vi.fn()} onAnnuler={vi.fn()} />);

    await utilisateur.type(screen.getByLabelText(/nom ou téléphone/i), "Ndiaye");
    await utilisateur.click(await screen.findByText("Awa Ndiaye"));

    expect(await screen.findByLabelText(/date de naissance/i)).toBeInTheDocument();
  });

  it("accepte un enfant sans prénom", async () => {
    const utilisateur = userEvent.setup();
    let corpsRecu: Record<string, unknown> | null = null;

    serveur.use(
      http.post("/api/enfants/", async ({ request }) => {
        corpsRecu = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "enfant-1" }, { status: 201 });
      }),
    );

    rendre(
      <FormulaireEnfant
        mereId="mere-1"
        mereNom="Awa Ndiaye"
        onTermine={vi.fn()}
        onAnnuler={vi.fn()}
      />,
    );

    await utilisateur.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => expect(corpsRecu).not.toBeNull());
    expect(corpsRecu).toMatchObject({ mere_id: "mere-1", prenom: "" });
  });

  it("envoie la prématurité quand elle est renseignée", async () => {
    const utilisateur = userEvent.setup();
    let corpsRecu: Record<string, unknown> | null = null;

    serveur.use(
      http.post("/api/enfants/", async ({ request }) => {
        corpsRecu = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "enfant-1" }, { status: 201 });
      }),
    );

    rendre(
      <FormulaireEnfant
        mereId="mere-1"
        mereNom="Awa Ndiaye"
        onTermine={vi.fn()}
        onAnnuler={vi.fn()}
      />,
    );

    await utilisateur.type(screen.getByLabelText(/semaines de gestation/i), "33");
    await utilisateur.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => expect(corpsRecu).not.toBeNull());
    expect(corpsRecu).toMatchObject({ semaines_gestation: 33 });
  });

  it("laisse la prématurité vide plutôt que d'envoyer zéro", async () => {
    const utilisateur = userEvent.setup();
    let corpsRecu: Record<string, unknown> | null = null;

    serveur.use(
      http.post("/api/enfants/", async ({ request }) => {
        corpsRecu = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "enfant-1" }, { status: 201 });
      }),
    );

    rendre(
      <FormulaireEnfant
        mereId="mere-1"
        mereNom="Awa Ndiaye"
        onTermine={vi.fn()}
        onAnnuler={vi.fn()}
      />,
    );

    await utilisateur.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => expect(corpsRecu).not.toBeNull());
    expect(corpsRecu!.semaines_gestation).toBeNull();
  });
});
