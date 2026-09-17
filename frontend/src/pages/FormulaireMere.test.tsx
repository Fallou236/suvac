import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rendre } from "@/tests/utilitaires";
import { serveur, http, HttpResponse } from "@/tests/serveur";
import { FormulaireMere } from "./FormulaireMere";

describe("FormulaireMere", () => {
  it("désactive l'enregistrement tant que l'identité est incomplète", () => {
    rendre(<FormulaireMere onTermine={vi.fn()} onAnnuler={vi.fn()} />);

    expect(screen.getByRole("button", { name: /enregistrer/i })).toBeDisabled();
  });

  it("crée la mère puis recueille son consentement", async () => {
    const utilisateur = userEvent.setup();
    const onTermine = vi.fn();
    let consentementRecu: Record<string, unknown> | null = null;

    serveur.use(
      http.post("/api/meres/", () =>
        HttpResponse.json({ id: "mere-1", nom_complet: "Awa Ndiaye" }, { status: 201 }),
      ),
      http.post("/api/meres/mere-1/consentement/", async ({ request }) => {
        consentementRecu = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "c1" }, { status: 201 });
      }),
    );

    rendre(<FormulaireMere onTermine={onTermine} onAnnuler={vi.fn()} />);

    await utilisateur.type(screen.getByLabelText(/prénom/i), "Awa");
    await utilisateur.type(screen.getByLabelText(/^nom/i), "Ndiaye");
    await utilisateur.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => expect(onTermine).toHaveBeenCalledWith("mere-1"));
    expect(consentementRecu).toMatchObject({ canal: "whatsapp" });
  });

  it("transmet le canal choisi", async () => {
    const utilisateur = userEvent.setup();
    let consentementRecu: Record<string, unknown> | null = null;

    serveur.use(
      http.post("/api/meres/", () =>
        HttpResponse.json({ id: "mere-1" }, { status: 201 }),
      ),
      http.post("/api/meres/mere-1/consentement/", async ({ request }) => {
        consentementRecu = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    rendre(<FormulaireMere onTermine={vi.fn()} onAnnuler={vi.fn()} />);

    await utilisateur.type(screen.getByLabelText(/prénom/i), "Awa");
    await utilisateur.type(screen.getByLabelText(/^nom/i), "Ndiaye");
    await utilisateur.click(screen.getByText("Aucun envoi"));
    await utilisateur.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => expect(consentementRecu).not.toBeNull());
    expect(consentementRecu).toMatchObject({ canal: "application" });
  });

  it("affiche l'erreur de validation sous le champ concerné", async () => {
    const utilisateur = userEvent.setup();

    serveur.use(
      http.post("/api/meres/", () =>
        HttpResponse.json(
          { telephone: ["Numéro invalide. Format attendu : +221771234567."] },
          { status: 400 },
        ),
      ),
    );

    rendre(<FormulaireMere onTermine={vi.fn()} onAnnuler={vi.fn()} />);

    await utilisateur.type(screen.getByLabelText(/prénom/i), "Awa");
    await utilisateur.type(screen.getByLabelText(/^nom/i), "Ndiaye");
    await utilisateur.type(screen.getByLabelText(/téléphone/i), "abc");
    await utilisateur.click(screen.getByRole("button", { name: /enregistrer/i }));

    expect(await screen.findByText(/numéro invalide/i)).toBeInTheDocument();
  });
});
