import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rendre } from "@/tests/utilitaires";
import { serveur, http, HttpResponse } from "@/tests/serveur";
import { useAuthentification } from "@/etat/authentification";
import FileDuJour from "./FileDuJour";

const AUJOURDHUI = new Date().toISOString().slice(0, 10);

function echeance(partiel: Record<string, unknown>) {
  return {
    id: "e1",
    vaccin_code: "PENTA",
    vaccin_libelle: "Pentavalent",
    rang: 1,
    age_cible_jours: 42,
    date_ouverture: AUJOURDHUI,
    date_cible: AUJOURDHUI,
    date_limite: "2027-01-01",
    statut: "due",
    motif_annulation: "",
    retard_jours: 0,
    dose: null,
    beneficiaire_nom: "Moussa Ndiaye",
    beneficiaire_id: "enfant-1",
    beneficiaire_type: "enfant",
    mere_nom: "Khady Ndiaye",
    telephone: "+221771000001",
    administrable: true,
    motif_non_administrable: [],
    ...partiel,
  };
}

function servirFile(echeances: unknown[]) {
  serveur.use(
    http.get("/api/echeances/file-du-jour-complete/", () =>
      HttpResponse.json(echeances),
    ),
  );
}

function connecter() {
  useAuthentification.getState().definirUtilisateur({
    id: "u1",
    username: "awa.ndiaye",
    first_name: "Awa",
    last_name: "Ndiaye",
    nom_complet: "Awa Ndiaye",
    email: "",
    role: "agent",
    poste: { id: "p1", nom: "Poste de Ndondol", district: "Bambey", region: "Diourbel", actif: true },
    telephone: "",
    langue: "fr",
  } as never);
}

describe("FileDuJour", () => {
  it("affiche un état vide quand personne n'est attendu", async () => {
    connecter();
    servirFile([]);
    rendre(<FileDuJour />);

    expect(
      await screen.findByText(/aucun bénéficiaire attendu/i),
    ).toBeInTheDocument();
  });

  it("liste les bénéficiaires de la file", async () => {
    connecter();
    servirFile([echeance({})]);
    rendre(<FileDuJour />);

    expect(await screen.findByText("Moussa Ndiaye")).toBeInTheDocument();
  });

  it("sépare les sections selon l'urgence", async () => {
    connecter();
    servirFile([
      echeance({ id: "e1", date_cible: AUJOURDHUI, statut: "due" }),
      echeance({
        id: "e2",
        beneficiaire_id: "enfant-2",
        beneficiaire_nom: "Awa Fall",
        statut: "en_retard",
        retard_jours: 90,
        date_cible: "2026-01-01",
      }),
    ]);
    rendre(<FileDuJour />);

    expect(
      await screen.findByRole("heading", { name: /aujourd'hui/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /en retard/i }),
    ).toBeInTheDocument();
  });

  it("ouvre la fiche au clic sur un bénéficiaire", async () => {
    const utilisateur = userEvent.setup();
    connecter();
    servirFile([echeance({})]);
    rendre(<FileDuJour />);

    await utilisateur.click(await screen.findByText("Moussa Ndiaye"));

    expect(await screen.findByText(/Khady Ndiaye/)).toBeInTheDocument();
    expect(screen.getByText(/administrable aujourd'hui/i)).toBeInTheDocument();
  });

  it("distingue les doses administrables de celles qui attendent", async () => {
    const utilisateur = userEvent.setup();
    connecter();
    servirFile([
      echeance({ id: "e1", administrable: true }),
      echeance({
        id: "e2",
        vaccin_code: "VPO",
        vaccin_libelle: "Polio oral",
        rang: 2,
        administrable: false,
        motif_non_administrable: ["dose_precedente_manquante"],
      }),
    ]);
    rendre(<FileDuJour />);

    await utilisateur.click(await screen.findByText("Moussa Ndiaye"));

    expect(screen.getByText(/prochaines séances/i)).toBeInTheDocument();
    expect(
      screen.getByText(/dose précédente non administrée/i),
    ).toBeInTheDocument();
  });

  it("n'offre pas d'administrer une dose bloquée", async () => {
    const utilisateur = userEvent.setup();
    connecter();
    servirFile([
      echeance({
        administrable: false,
        motif_non_administrable: ["intervalle_minimal_non_respecte"],
      }),
    ]);
    rendre(<FileDuJour />);

    await utilisateur.click(await screen.findByText("Moussa Ndiaye"));

    expect(
      screen.queryByRole("button", { name: /administrer/i }),
    ).not.toBeInTheDocument();
  });

  it("ouvre le formulaire de saisie", async () => {
    const utilisateur = userEvent.setup();
    connecter();
    servirFile([echeance({})]);
    rendre(<FileDuJour />);

    await utilisateur.click(await screen.findByText("Moussa Ndiaye"));
    await utilisateur.click(
      screen.getByRole("button", { name: /^administrer$/i }),
    );

    expect(
      await screen.findByText(/enregistrer une dose/i),
    ).toBeInTheDocument();
  });

  it("explique l'échec du chargement et propose de réessayer", async () => {
    connecter();
    serveur.use(
      http.get("/api/echeances/file-du-jour-complete/", () =>
        new HttpResponse(null, { status: 500 }),
      ),
    );
    rendre(<FileDuJour />);

    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: /réessayer/i }),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });
});
