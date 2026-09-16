import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rendre } from "@/tests/utilitaires";
import { serveur, http, HttpResponse } from "@/tests/serveur";
import { FormulaireDose } from "./FormulaireDose";
import type { EcheanceFile } from "@/api/types";

const ECHEANCE = {
  id: "echeance-1",
  vaccin_code: "PENTA",
  vaccin_libelle: "Pentavalent",
  rang: 1,
  statut: "due",
  date_cible: "2026-06-01",
  retard_jours: 0,
} as EcheanceFile;

describe("FormulaireDose", () => {
  it("affiche le vaccin et le bénéficiaire concernés", () => {
    rendre(
      <FormulaireDose
        echeance={ECHEANCE}
        beneficiaire="Moussa Ndiaye"
        onTermine={vi.fn()}
        onAnnuler={vi.fn()}
      />,
    );

    expect(screen.getByText("Pentavalent")).toBeInTheDocument();
    expect(screen.getByText("Moussa Ndiaye")).toBeInTheDocument();
  });

  it("envoie la saisie et prévient à la réussite", async () => {
    const utilisateur = userEvent.setup();
    const onTermine = vi.fn();
    let corpsRecu: Record<string, unknown> | null = null;

    serveur.use(
      http.post("/api/doses/", async ({ request }) => {
        corpsRecu = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "dose-1" }, { status: 201 });
      }),
    );

    rendre(
      <FormulaireDose
        echeance={ECHEANCE}
        beneficiaire="Moussa Ndiaye"
        onTermine={onTermine}
        onAnnuler={vi.fn()}
      />,
    );

    await utilisateur.type(screen.getByLabelText(/numéro de lot/i), "LOT-A");
    await utilisateur.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => expect(onTermine).toHaveBeenCalled());
    expect(corpsRecu).toMatchObject({
      echeance_id: "echeance-1",
      numero_lot: "LOT-A",
    });
  });

  it("envoie une clé d'idempotence (EF-54)", async () => {
    const utilisateur = userEvent.setup();
    let corpsRecu: Record<string, unknown> | null = null;

    serveur.use(
      http.post("/api/doses/", async ({ request }) => {
        corpsRecu = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "dose-1" }, { status: 201 });
      }),
    );

    rendre(
      <FormulaireDose
        echeance={ECHEANCE}
        beneficiaire="Moussa Ndiaye"
        onTermine={vi.fn()}
        onAnnuler={vi.fn()}
      />,
    );

    await utilisateur.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => expect(corpsRecu).not.toBeNull());
    expect(corpsRecu!.cle_idempotence).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("explique le refus du moteur plutôt que d'afficher une erreur générique", async () => {
    const utilisateur = userEvent.setup();

    serveur.use(
      http.post("/api/doses/", () =>
        HttpResponse.json(
          { violations: ["intervalle_minimal_non_respecte"] },
          { status: 400 },
        ),
      ),
    );

    rendre(
      <FormulaireDose
        echeance={ECHEANCE}
        beneficiaire="Moussa Ndiaye"
        onTermine={vi.fn()}
        onAnnuler={vi.fn()}
      />,
    );

    await utilisateur.click(screen.getByRole("button", { name: /enregistrer/i }));

    expect(
      await screen.findByText(/délai depuis la dose précédente/i),
    ).toBeInTheDocument();
  });

  it("ne prévient pas de la réussite quand le serveur refuse", async () => {
    const utilisateur = userEvent.setup();
    const onTermine = vi.fn();

    serveur.use(
      http.post("/api/doses/", () =>
        HttpResponse.json({ violations: ["date_future"] }, { status: 400 }),
      ),
    );

    rendre(
      <FormulaireDose
        echeance={ECHEANCE}
        beneficiaire="Moussa Ndiaye"
        onTermine={onTermine}
        onAnnuler={vi.fn()}
      />,
    );

    await utilisateur.click(screen.getByRole("button", { name: /enregistrer/i }));

    await screen.findByRole("alert");
    expect(onTermine).not.toHaveBeenCalled();
  });
});
