import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rendre } from "@/tests/utilitaires";
import { serveur, http, HttpResponse } from "@/tests/serveur";
import { useAuthentification } from "@/etat/authentification";
import Personnel from "./Personnel";

function connecterSuperviseur() {
  useAuthentification.getState().definirUtilisateur({
    id: "s1",
    username: "fatou.gueye",
    nom_complet: "Fatou Guèye",
    role: "superviseur",
    poste: { id: "p1", nom: "Poste de Ndondol" },
  } as never);
}

const MOI = {
  id: "s1",
  username: "fatou.gueye",
  first_name: "Fatou",
  last_name: "Guèye",
  nom_complet: "Fatou Guèye",
  telephone: "",
  langue: "fr",
  role: "superviseur",
  role_libelle: "Superviseur de district",
  poste: { id: "p1", nom: "Poste de Ndondol", district: "Bambey", region: "Diourbel" },
  is_active: true,
  doit_changer_mot_de_passe: false,
  derniere_connexion: "2026-09-24T08:00:00Z",
  date_joined: "2026-01-10T10:00:00Z",
};

const AGENT = {
  ...MOI,
  id: "a1",
  username: "awa.ndiaye",
  first_name: "Awa",
  last_name: "Ndiaye",
  nom_complet: "Awa Ndiaye",
  role: "agent",
  role_libelle: "Agent de santé",
  derniere_connexion: null,
};

function servirPersonnel(agents: unknown[] = [MOI, AGENT]) {
  serveur.use(
    http.get("/api/agents/", () =>
      HttpResponse.json({
        count: agents.length,
        next: null,
        previous: null,
        results: agents,
      }),
    ),
    http.get("/api/postes/", () =>
      HttpResponse.json({
        count: 2,
        next: null,
        previous: null,
        results: [
          { id: "p1", nom: "Poste de Ndondol", district: "Bambey", region: "Diourbel" },
          { id: "p2", nom: "Poste de Joal", district: "Mbour", region: "Thiès" },
        ],
      }),
    ),
  );
}

describe("Personnel", () => {
  it("liste les comptes du poste", async () => {
    connecterSuperviseur();
    servirPersonnel();
    rendre(<Personnel />);

    expect(await screen.findByText("Awa Ndiaye")).toBeInTheDocument();
    expect(screen.getAllByText("Fatou Guèye").length).toBeGreaterThan(1);
  });

  it("signale son propre compte", async () => {
    connecterSuperviseur();
    servirPersonnel();
    rendre(<Personnel />);

    expect(await screen.findByText("vous")).toBeInTheDocument();
  });

  it("signale un mot de passe jamais choisi", async () => {
    connecterSuperviseur();
    servirPersonnel([{ ...AGENT, doit_changer_mot_de_passe: true }]);
    rendre(<Personnel />);

    expect(
      await screen.findByText(/mot de passe à changer/i),
    ).toBeInTheDocument();
  });

  it("n'offre aucune action sur son propre compte", async () => {
    const utilisateur = userEvent.setup();
    connecterSuperviseur();
    servirPersonnel([MOI]);
    rendre(<Personnel />);

    // Attendre que la liste soit chargée : sans cela, seuls les boutons de
    // la coquille existent.
    await screen.findByText("vous");

    const lignes = screen.getAllByRole("button");
    const sienne = lignes.find((b) => b.textContent?.includes("vous"));
    await utilisateur.click(sienne!);

    expect(await screen.findByText(/votre propre compte/i)).toBeInTheDocument();
  });

  it("propose les actions sur le compte d'un autre", async () => {
    const utilisateur = userEvent.setup();
    connecterSuperviseur();
    servirPersonnel();
    rendre(<Personnel />);

    await utilisateur.click(await screen.findByText("Awa Ndiaye"));

    expect(
      await screen.findByRole("button", { name: /^réinitialiser$/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^transférer$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^désactiver$/i })).toBeInTheDocument();
  });

  it("crée un compte", async () => {
    const utilisateur = userEvent.setup();
    connecterSuperviseur();
    servirPersonnel();
    let corpsRecu: Record<string, unknown> | null = null;

    serveur.use(
      http.post("/api/agents/", async ({ request }) => {
        corpsRecu = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...AGENT, id: "a2" }, { status: 201 });
      }),
    );

    rendre(<Personnel />);
    await utilisateur.click(
      await screen.findByRole("button", { name: /nouveau compte/i }),
    );

    await utilisateur.type(screen.getByLabelText(/prénom/i), "Moussa");
    await utilisateur.type(screen.getByLabelText("Nom de famille"), "Sow");
    await utilisateur.clear(screen.getByLabelText(/identifiant de connexion/i));
    await utilisateur.type(
      screen.getByLabelText(/identifiant de connexion/i),
      "moussa.sow",
    );
    await utilisateur.type(
      screen.getByLabelText(/mot de passe initial/i),
      "Ndondol-2026",
    );
    await utilisateur.click(screen.getByRole("button", { name: /créer le compte/i }));

    await waitFor(() => expect(corpsRecu).not.toBeNull());
    expect(corpsRecu).toMatchObject({
      username: "moussa.sow",
      role: "agent",
      mot_de_passe: "Ndondol-2026",
    });
  });

  it("propose un identifiant à partir du nom", async () => {
    const utilisateur = userEvent.setup();
    connecterSuperviseur();
    servirPersonnel();
    rendre(<Personnel />);

    await utilisateur.click(
      await screen.findByRole("button", { name: /nouveau compte/i }),
    );
    await utilisateur.type(screen.getByLabelText(/prénom/i), "Aïssatou");
    await utilisateur.type(screen.getByLabelText("Nom de famille"), "Diop");
    await utilisateur.tab();

    expect(screen.getByLabelText(/identifiant de connexion/i)).toHaveValue(
      "aissatou.diop",
    );
  });

  it("réinitialise un mot de passe oublié", async () => {
    const utilisateur = userEvent.setup();
    connecterSuperviseur();
    servirPersonnel();
    let corpsRecu: Record<string, unknown> | null = null;

    serveur.use(
      http.post("/api/agents/a1/reinitialiser/", async ({ request }) => {
        corpsRecu = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    rendre(<Personnel />);
    await utilisateur.click(await screen.findByText("Awa Ndiaye"));
    await utilisateur.click(
      await screen.findByRole("button", { name: /^réinitialiser$/i }),
    );
    await utilisateur.type(
      screen.getByLabelText(/mot de passe provisoire/i),
      "Provisoire-2026",
    );
    await utilisateur.click(
      screen.getAllByRole("button", { name: /^réinitialiser$/i }).at(-1)!,
    );

    await waitFor(() => expect(corpsRecu).not.toBeNull());
    expect(corpsRecu).toMatchObject({ mot_de_passe: "Provisoire-2026" });
  });

  it("désactive un compte", async () => {
    const utilisateur = userEvent.setup();
    connecterSuperviseur();
    servirPersonnel();
    let appele = false;

    serveur.use(
      http.post("/api/agents/a1/basculer-activation/", () => {
        appele = true;
        return HttpResponse.json({ ...AGENT, is_active: false });
      }),
    );

    rendre(<Personnel />);
    await utilisateur.click(await screen.findByText("Awa Ndiaye"));
    await utilisateur.click(
      await screen.findByRole("button", { name: /^désactiver$/i }),
    );

    await waitFor(() => expect(appele).toBe(true));
  });

  it("transfère vers un autre poste", async () => {
    const utilisateur = userEvent.setup();
    connecterSuperviseur();
    servirPersonnel();
    let corpsRecu: Record<string, unknown> | null = null;

    serveur.use(
      http.post("/api/agents/a1/transferer/", async ({ request }) => {
        corpsRecu = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(AGENT);
      }),
    );

    rendre(<Personnel />);
    await utilisateur.click(await screen.findByText("Awa Ndiaye"));
    await utilisateur.click(
      await screen.findByRole("button", { name: /^transférer$/i }),
    );

    await utilisateur.selectOptions(
      await screen.findByRole("combobox"),
      "p2",
    );
    await utilisateur.click(
      screen.getAllByRole("button", { name: /^transférer$/i }).at(-1)!,
    );

    await waitFor(() => expect(corpsRecu).not.toBeNull());
    expect(corpsRecu).toMatchObject({ poste_id: "p2" });
  });

  it("annonce l'absence de compte", async () => {
    connecterSuperviseur();
    servirPersonnel([]);
    rendre(<Personnel />);

    expect(await screen.findByText(/aucun compte/i)).toBeInTheDocument();
  });
});
