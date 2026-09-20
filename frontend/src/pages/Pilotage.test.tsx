import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { rendre } from "@/tests/utilitaires";
import { serveur, http, HttpResponse } from "@/tests/serveur";
import { useAuthentification } from "@/etat/authentification";
import Pilotage from "./Pilotage";

function connecter() {
  useAuthentification.getState().definirUtilisateur({
    id: "u1",
    username: "fatou.gueye",
    nom_complet: "Fatou Guèye",
    role: "superviseur",
    poste: { id: "p1", nom: "Poste de Ndondol" },
  } as never);
}

const SYNTHESE = {
  enfants_suivis: 13,
  doses_du_mois: 7,
  en_retard: 25,
  perimees: 21,
  couverture_globale: 16.3,
  poste: "Poste de Ndondol",
  arrete_au: "2026-09-20",
};

function servirTableauDeBord({
  synthese = SYNTHESE,
  couverture = [
    { code: "BCG", libelle: "BCG", rang: 1, attendus: 13, administres: 6, taux: 46.2 },
  ],
  abandon = [
    {
      code: "PENTA",
      libelle: "Pentavalent",
      premiere_dose: 3,
      derniere_dose: 1,
      taux: 66.7,
    },
  ],
  activite = [{ mois: "2026-09-01", doses: 7 }],
  retards = [
    {
      enfant_id: "e1",
      enfant: "Mariama Faye",
      mere: "Coumba Faye",
      telephone: "+221771000007",
      village: "Thiakhar",
      vaccin: "ROTA-1",
      date_limite: "2026-09-28",
      retard_jours: 12,
    },
  ],
} = {}) {
  serveur.use(
    http.get("/api/pilotage/synthese/", () => HttpResponse.json(synthese)),
    http.get("/api/pilotage/couverture/", () => HttpResponse.json(couverture)),
    http.get("/api/pilotage/abandon/", () => HttpResponse.json(abandon)),
    http.get("/api/pilotage/activite/", () => HttpResponse.json(activite)),
    http.get("/api/pilotage/retards/", () => HttpResponse.json(retards)),
  );
}

describe("Pilotage", () => {
  it("affiche les chiffres clés", async () => {
    connecter();
    servirTableauDeBord();
    rendre(<Pilotage />);

    expect(await screen.findByText("13")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("16.3")).toBeInTheDocument();
  });

  it("distingue les échéances rattrapables des périmées", async () => {
    connecter();
    servirTableauDeBord();
    rendre(<Pilotage />);

    expect(
      await screen.findByText(/échéances encore rattrapables/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/fenêtre de rattrapage close/i)).toBeInTheDocument();
  });

  it("explique que les échéances à venir sont exclues du calcul", async () => {
    connecter();
    servirTableauDeBord();
    rendre(<Pilotage />);

    expect(
      await screen.findByText(/non encore dues sont exclues/i),
    ).toBeInTheDocument();
  });

  it("avertit quand l'effectif est trop faible pour conclure", async () => {
    connecter();
    servirTableauDeBord();
    rendre(<Pilotage />);

    expect(
      await screen.findByText(/effectif trop faible pour conclure/i),
    ).toBeInTheDocument();
  });

  it("n'avertit pas sur un effectif suffisant", async () => {
    connecter();
    servirTableauDeBord({
      abandon: [
        {
          code: "PENTA",
          libelle: "Pentavalent",
          premiere_dose: 120,
          derniere_dose: 95,
          taux: 20.8,
        },
      ],
    });
    rendre(<Pilotage />);

    await screen.findByText(/pentavalent/i);
    expect(
      screen.queryByText(/effectif trop faible/i),
    ).not.toBeInTheDocument();
  });

  it("liste les enfants en retard avec leur contact", async () => {
    connecter();
    servirTableauDeBord();
    rendre(<Pilotage />);

    expect(await screen.findByText("Mariama Faye")).toBeInTheDocument();
    expect(screen.getByText("Coumba Faye")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "+221771000007" }),
    ).toHaveAttribute("href", "tel:+221771000007");
  });

  it("signale une mère sans téléphone plutôt que de laisser vide", async () => {
    connecter();
    servirTableauDeBord({
      retards: [
        {
          enfant_id: "e2",
          enfant: "Awa Wade",
          mere: "Penda Wade",
          telephone: "",
          village: "Keur Samba",
          vaccin: "VPO-1",
          date_limite: "2026-10-31",
          retard_jours: 5,
        },
      ],
    });
    rendre(<Pilotage />);

    expect(await screen.findByText(/sans téléphone/i)).toBeInTheDocument();
  });

  it("propose l'export quand il y a des retards", async () => {
    connecter();
    servirTableauDeBord();
    rendre(<Pilotage />);

    expect(
      await screen.findByRole("button", { name: /exporter en csv/i }),
    ).toBeInTheDocument();
  });

  it("n'offre pas d'export sur une liste vide", async () => {
    connecter();
    servirTableauDeBord({ retards: [] });
    rendre(<Pilotage />);

    expect(await screen.findByText(/aucun enfant en retard/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /exporter/i }),
    ).not.toBeInTheDocument();
  });

  it("explique l'échec du chargement et propose de réessayer", async () => {
    connecter();
    serveur.use(
      http.get("/api/pilotage/synthese/", () =>
        new HttpResponse(null, { status: 403 }),
      ),
    );
    rendre(<Pilotage />);

    expect(
      await screen.findByRole("button", { name: /réessayer/i }),
    ).toBeInTheDocument();
  });
});
