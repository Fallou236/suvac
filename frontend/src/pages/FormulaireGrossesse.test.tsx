import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rendre } from "@/tests/utilitaires";
import { serveur, http, HttpResponse } from "@/tests/serveur";
import { FormulaireGrossesse } from "./FormulaireGrossesse";

function afficher(surcharges = {}) {
  return rendre(
    <FormulaireGrossesse
      mereId="mere-1"
      mereNom="Khady Ndiaye"
      rangSuggere={2}
      onTermine={vi.fn()}
      onAnnuler={vi.fn()}
      {...surcharges}
    />,
  );
}

describe("FormulaireGrossesse", () => {
  it("rappelle de quelle mère il s'agit", () => {
    afficher();
    expect(screen.getByText("Khady Ndiaye")).toBeInTheDocument();
  });

  it("pré-remplit le rang suggéré", () => {
    afficher();
    expect(screen.getByLabelText(/rang de la grossesse/i)).toHaveValue(2);
  });

  it("propose un terme à sept mois du premier contact", () => {
    afficher();

    const reference = screen.getByLabelText(/premier contact/i) as HTMLInputElement;
    const terme = screen.getByLabelText(/terme estimé/i) as HTMLInputElement;

    const ecart =
      (new Date(terme.value).getTime() - new Date(reference.value).getTime()) /
      86_400_000;

    expect(Math.round(ecart)).toBe(210);
  });

  it("enregistre la grossesse", async () => {
    const utilisateur = userEvent.setup();
    const onTermine = vi.fn();
    let corpsRecu: Record<string, unknown> | null = null;

    serveur.use(
      http.post("/api/grossesses/", async ({ request }) => {
        corpsRecu = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "g1" }, { status: 201 });
      }),
    );

    afficher({ onTermine });
    await utilisateur.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => expect(onTermine).toHaveBeenCalled());
    expect(corpsRecu).toMatchObject({ mere_id: "mere-1", rang: 2 });
  });

  it("affiche le refus quand le terme précède le premier contact", async () => {
    const utilisateur = userEvent.setup();

    serveur.use(
      http.post("/api/grossesses/", () =>
        HttpResponse.json(
          {
            terme_estime: [
              "Le terme ne peut précéder le premier contact prénatal.",
            ],
          },
          { status: 400 },
        ),
      ),
    );

    afficher();
    await utilisateur.click(screen.getByRole("button", { name: /enregistrer/i }));

    expect(
      await screen.findByText(/ne peut précéder le premier contact/i),
    ).toBeInTheDocument();
  });
});
