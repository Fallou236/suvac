import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rendre } from "@/tests/utilitaires";
import { serveur, http, HttpResponse } from "@/tests/serveur";
import { useAuthentification } from "@/etat/authentification";
import Audit from "./Audit";

function connecterAdmin() {
  useAuthentification.getState().definirUtilisateur({
    id: "ad1",
    username: "admin",
    nom_complet: "Administrateur",
    role: "admin",
    poste: null,
  } as never);
}

const ACTES = [
  {
    id: 1,
    acte: "creation",
    acte_libelle: "Création d'un compte",
    auteur_identifiant: "fatou.gueye",
    cible_identifiant: "moussa.sow",
    detail: "Agent de santé au Poste de Ndondol",
    horodatage: "2026-09-24T09:15:00Z",
  },
  {
    id: 2,
    acte: "reinitialisation",
    acte_libelle: "Réinitialisation du mot de passe",
    auteur_identifiant: "fatou.gueye",
    cible_identifiant: "awa.ndiaye",
    detail: "",
    horodatage: "2026-09-24T14:30:00Z",
  },
  {
    id: 3,
    acte: "transfert",
    acte_libelle: "Transfert vers un autre poste",
    auteur_identifiant: "admin",
    cible_identifiant: "ibrahima.ba",
    detail: "Poste de Ndondol → Poste de Joal",
    horodatage: "2026-09-20T11:00:00Z",
  },
];

function servirAudit(actes: unknown[] = ACTES) {
  serveur.use(http.get("/api/audit/", () => HttpResponse.json(actes)));
}

describe("Audit", () => {
  it("liste les actes d'administration", async () => {
    connecterAdmin();
    servirAudit();
    rendre(<Audit />);

    expect(await screen.findByText("moussa.sow")).toBeInTheDocument();
    expect(screen.getByText("awa.ndiaye")).toBeInTheDocument();
  });

  it("indique qui a fait quoi", async () => {
    connecterAdmin();
    servirAudit();
    rendre(<Audit />);

    expect(await screen.findByText(/création d'un compte/i)).toBeInTheDocument();
    expect(screen.getAllByText("fatou.gueye").length).toBeGreaterThan(0);
  });

  it("conserve le détail d'un transfert", async () => {
    connecterAdmin();
    servirAudit();
    rendre(<Audit />);

    expect(
      await screen.findByText(/Poste de Ndondol → Poste de Joal/),
    ).toBeInTheDocument();
  });

  it("regroupe les actes par journée", async () => {
    connecterAdmin();
    servirAudit();
    rendre(<Audit />);

    // Deux actes le 24, un le 20 : deux journées distinctes.
    const titres = await screen.findAllByRole("heading", { level: 2 });
    expect(titres).toHaveLength(2);
  });

  it("filtre par type d'acte", async () => {
    const utilisateur = userEvent.setup();
    connecterAdmin();
    servirAudit();
    rendre(<Audit />);

    await utilisateur.click(
      await screen.findByRole("button", { name: /^transferts$/i }),
    );

    expect(screen.getByText("ibrahima.ba")).toBeInTheDocument();
    expect(screen.queryByText("moussa.sow")).not.toBeInTheDocument();
  });

  it("rappelle que le journal est en écriture seule", async () => {
    connecterAdmin();
    servirAudit();
    rendre(<Audit />);

    expect(await screen.findByText(/écriture seule/i)).toBeInTheDocument();
  });

  it("annonce l'absence d'acte", async () => {
    connecterAdmin();
    servirAudit([]);
    rendre(<Audit />);

    expect(await screen.findByText(/aucun acte/i)).toBeInTheDocument();
  });
});
