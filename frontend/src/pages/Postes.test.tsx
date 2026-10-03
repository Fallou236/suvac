import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rendre } from "@/tests/utilitaires";
import { serveur, http, HttpResponse } from "@/tests/serveur";
import { useAuthentification } from "@/etat/authentification";
import Postes from "./Postes";

const NDONDOL = {
  id: "p1",
  nom: "Poste de Ndondol",
  district: "Bambey",
  region: "Diourbel",
  telephone: "+221339000001",
  latitude: "14.789000",
  longitude: "-16.926000",
  actif: true,
  nombre_agents: 3,
  nombre_beneficiaires: 13,
  cree_le: "2026-01-10T10:00:00Z",
};

const JOAL = {
  ...NDONDOL,
  id: "p2",
  nom: "Poste de Joal",
  district: "Mbour",
  region: "Thiès",
  telephone: "",
  latitude: null,
  longitude: null,
  nombre_agents: 0,
  nombre_beneficiaires: 0,
};

function connecterAdmin() {
  useAuthentification.getState().definirUtilisateur({
    id: "ad1",
    username: "admin",
    nom_complet: "Administrateur",
    role: "admin",
    poste: null,
  } as never);
}

function connecterSuperviseur() {
  useAuthentification.getState().definirUtilisateur({
    id: "s1",
    username: "fatou.gueye",
    nom_complet: "Fatou Guèye",
    role: "superviseur",
    poste: {
      id: "p1",
      nom: "Poste de Ndondol",
      district: "Bambey",
      region: "Diourbel",
      actif: true,
    },
  } as never);
}

function servirPostes(postes: unknown[] = [NDONDOL, JOAL]) {
  serveur.use(
    http.get("/api/postes/", () =>
      HttpResponse.json({
        count: postes.length,
        next: null,
        previous: null,
        results: postes,
      }),
    ),
  );
}

describe("Postes", () => {
  it("groupe les postes par région", async () => {
    connecterAdmin();
    servirPostes();
    rendre(<Postes />);

    expect(await screen.findByText("Diourbel")).toBeInTheDocument();
    expect(screen.getByText("Thiès")).toBeInTheDocument();
  });

  it("montre l'effectif de chaque poste", async () => {
    connecterAdmin();
    servirPostes();
    rendre(<Postes />);

    expect(await screen.findByText(/3 agents/)).toBeInTheDocument();
  });

  it("signale son propre poste au superviseur", async () => {
    connecterSuperviseur();
    servirPostes();
    rendre(<Postes />);

    expect(await screen.findByText("le vôtre")).toBeInTheDocument();
  });

  it("n'offre la création qu'à l'administrateur", async () => {
    connecterSuperviseur();
    servirPostes();
    rendre(<Postes />);

    await screen.findByText("Poste de Ndondol");
    expect(
      screen.queryByRole("button", { name: /nouveau poste/i }),
    ).not.toBeInTheDocument();
  });

  it("propose la création à l'administrateur", async () => {
    connecterAdmin();
    servirPostes();
    rendre(<Postes />);

    expect(
      await screen.findByRole("button", { name: /nouveau poste/i }),
    ).toBeInTheDocument();
  });

  it("ouvre la fiche du poste choisi", async () => {
    const utilisateur = userEvent.setup();
    connecterAdmin();
    servirPostes();
    rendre(<Postes />);

    await utilisateur.click(await screen.findByText("Poste de Ndondol"));

    expect(
      await screen.findByRole("heading", { name: "Poste de Ndondol" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Personnel actif")).toBeInTheDocument();
  });

  it("signale une coordonnée manquante", async () => {
    const utilisateur = userEvent.setup();
    connecterAdmin();
    servirPostes([JOAL]);
    rendre(<Postes />);

    await utilisateur.click(await screen.findByText("Poste de Joal"));

    expect(await screen.findByText(/non renseignée/i)).toBeInTheDocument();
  });

  it("n'offre la fermeture qu'à l'administrateur", async () => {
    const utilisateur = userEvent.setup();
    connecterSuperviseur();
    servirPostes([NDONDOL]);
    rendre(<Postes />);

    await utilisateur.click(await screen.findByText("Poste de Ndondol"));

    expect(
      screen.queryByRole("button", { name: /^fermer$/i }),
    ).not.toBeInTheDocument();
  });

  it("crée un poste", async () => {
    const utilisateur = userEvent.setup();
    connecterAdmin();
    servirPostes();
    let corpsRecu: Record<string, unknown> | null = null;

    serveur.use(
      http.post("/api/postes/", async ({ request }) => {
        corpsRecu = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...JOAL, id: "p3" }, { status: 201 });
      }),
    );

    rendre(<Postes />);
    await utilisateur.click(
      await screen.findByRole("button", { name: /nouveau poste/i }),
    );

    await utilisateur.type(
      screen.getByLabelText(/nom du poste/i),
      "Poste de Khombole",
    );
    await utilisateur.type(screen.getByLabelText(/^District/), "Thiès");
    await utilisateur.type(screen.getByLabelText(/^Région/), "Thiès");
    await utilisateur.click(
      screen.getByRole("button", { name: /créer le poste/i }),
    );

    await waitFor(() => expect(corpsRecu).not.toBeNull());
    expect(corpsRecu).toMatchObject({
      nom: "Poste de Khombole",
      district: "Thiès",
    });
  });

  it("le superviseur ne peut pas changer le rattachement", async () => {
    const utilisateur = userEvent.setup();
    connecterSuperviseur();
    servirPostes([NDONDOL]);
    rendre(<Postes />);

    await screen.findByText("le vôtre");
    const ligne = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("le vôtre"));
    await utilisateur.click(ligne!);

    await utilisateur.click(
      await screen.findByRole("button", { name: /modifier/i }),
    );

    expect(
      await screen.findByText(/relève de l'administration/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^District/)).not.toBeInTheDocument();
  });

  it("corrige le téléphone du poste", async () => {
    const utilisateur = userEvent.setup();
    connecterSuperviseur();
    servirPostes([NDONDOL]);
    let corpsRecu: Record<string, unknown> | null = null;

    serveur.use(
      http.patch("/api/postes/p1/", async ({ request }) => {
        corpsRecu = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(NDONDOL);
      }),
    );

    rendre(<Postes />);
    await screen.findByText("le vôtre");
    const ligne = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("le vôtre"));
    await utilisateur.click(ligne!);
    await utilisateur.click(
      await screen.findByRole("button", { name: /modifier/i }),
    );

    const champ = screen.getByLabelText(/téléphone du poste/i);
    await utilisateur.clear(champ);
    await utilisateur.type(champ, "+221339000099");
    await utilisateur.click(
      screen.getByRole("button", { name: /^enregistrer$/i }),
    );

    await waitFor(() => expect(corpsRecu).not.toBeNull());
    expect(corpsRecu).toMatchObject({ telephone: "+221339000099" });
  });

  it("explique le refus de fermer un poste occupé", async () => {
    const utilisateur = userEvent.setup();
    connecterAdmin();
    servirPostes([NDONDOL]);

    serveur.use(
      http.post("/api/postes/p1/basculer-activation/", () =>
        HttpResponse.json(
          {
            detail:
              "Ce poste compte encore du personnel actif. Transférez-le avant de fermer le poste.",
          },
          { status: 400 },
        ),
      ),
    );

    rendre(<Postes />);
    await utilisateur.click(await screen.findByText("Poste de Ndondol"));
    await utilisateur.click(
      await screen.findByRole("button", { name: /^fermer$/i }),
    );

    expect(
      await screen.findByText(/compte encore du personnel actif/i),
    ).toBeInTheDocument();
  });

  it("annonce l'absence de poste", async () => {
    connecterAdmin();
    servirPostes([]);
    rendre(<Postes />);

    expect(
      (await screen.findAllByText(/aucun poste/i)).length,
    ).toBeGreaterThan(0);
  });
});
