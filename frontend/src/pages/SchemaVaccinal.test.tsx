import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rendre } from "@/tests/utilitaires";
import { serveur, http, HttpResponse } from "@/tests/serveur";
import { useAuthentification } from "@/etat/authentification";
import SchemaVaccinal from "./SchemaVaccinal";

function connecterSuperviseur() {
  useAuthentification.getState().definirUtilisateur({
    id: "s1",
    username: "fatou.gueye",
    nom_complet: "Fatou Guèye",
    role: "superviseur",
    poste: { id: "p1", nom: "Poste de Ndondol" },
  } as never);
}

const SCHEMA = {
  enfant: [
    {
      id: 1,
      vaccin_code: "BCG",
      vaccin_libelle: "BCG",
      voie: "intradermique",
      cible: "enfant",
      rang: 1,
      age_min_jours: 0,
      age_cible_jours: 0,
      age_limite_jours: 365,
      intervalle_min_jours: null,
      actif: true,
    },
    {
      id: 2,
      vaccin_code: "PENTA",
      vaccin_libelle: "Pentavalent",
      voie: "intramusculaire",
      cible: "enfant",
      rang: 1,
      age_min_jours: 42,
      age_cible_jours: 42,
      age_limite_jours: 365,
      intervalle_min_jours: null,
      actif: true,
    },
    {
      id: 3,
      vaccin_code: "PENTA",
      vaccin_libelle: "Pentavalent",
      voie: "intramusculaire",
      cible: "enfant",
      rang: 2,
      age_min_jours: 70,
      age_cible_jours: 70,
      age_limite_jours: 365,
      intervalle_min_jours: 28,
      actif: true,
    },
  ],
  mere: [
    {
      id: 20,
      vaccin_code: "TD",
      vaccin_libelle: "Antitétanique",
      voie: "intramusculaire",
      cible: "mere",
      rang: 1,
      age_min_jours: 0,
      age_cible_jours: 0,
      age_limite_jours: null,
      intervalle_min_jours: null,
      actif: true,
    },
  ],
  vaccins: 9,
  regles: 22,
  avertissement:
    "Schéma reconstitué à partir de sources publiques, non validé par le PEV Sénégal.",
};

function servirSchema(schema: unknown = SCHEMA) {
  serveur.use(
    http.get("/api/schema-vaccinal/", () => HttpResponse.json(schema)),
  );
}

describe("SchemaVaccinal", () => {
  it("avertit que le schéma n'est pas validé officiellement", async () => {
    connecterSuperviseur();
    servirSchema();
    rendre(<SchemaVaccinal />);

    expect(await screen.findByText(/non validé par le PEV/i)).toBeInTheDocument();
  });

  it("n'affiche aucun avertissement si le serveur n'en envoie pas", async () => {
    connecterSuperviseur();
    servirSchema({ ...SCHEMA, avertissement: "" });
    rendre(<SchemaVaccinal />);

    await screen.findByText("BCG");
    expect(screen.queryByText(/à valider/i)).not.toBeInTheDocument();
  });

  it("rappelle que la modification est réservée à l'administrateur", async () => {
    connecterSuperviseur();
    servirSchema();
    rendre(<SchemaVaccinal />);

    expect(
      await screen.findByText(/réservée à l'administrateur/i),
    ).toBeInTheDocument();
  });

  it("groupe les règles par étape d'âge", async () => {
    connecterSuperviseur();
    servirSchema();
    rendre(<SchemaVaccinal />);

    expect(
      await screen.findByRole("heading", { name: /à la naissance/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /6 semaines/i }),
    ).toBeInTheDocument();
  });

  it("convertit les âges en semaines et en mois", async () => {
    /** Les âges sont stockés en jours ; les soignants raisonnent autrement. */
    connecterSuperviseur();
    servirSchema();
    rendre(<SchemaVaccinal />);

    expect(await screen.findAllByText("naissance")).not.toHaveLength(0);
    expect(screen.getAllByText("12 mois").length).toBeGreaterThan(0);
  });

  it("signale une dose sans limite d'âge", async () => {
    const utilisateur = userEvent.setup();
    connecterSuperviseur();
    servirSchema();
    rendre(<SchemaVaccinal />);

    await utilisateur.click(
      await screen.findByRole("tab", { name: /femmes enceintes/i }),
    );

    expect(await screen.findByText(/sans limite/i)).toBeInTheDocument();
  });

  it("affiche l'intervalle minimal entre deux doses", async () => {
    connecterSuperviseur();
    servirSchema();
    rendre(<SchemaVaccinal />);

    expect(await screen.findByText("28 jours")).toBeInTheDocument();
  });

  it("bascule entre enfants et femmes enceintes", async () => {
    const utilisateur = userEvent.setup();
    connecterSuperviseur();
    servirSchema();
    rendre(<SchemaVaccinal />);

    await screen.findByText("BCG");
    await utilisateur.click(
      screen.getByRole("tab", { name: /femmes enceintes/i }),
    );

    expect(await screen.findByText("Antitétanique")).toBeInTheDocument();
    expect(screen.queryByText("BCG")).not.toBeInTheDocument();
  });

  it("compte les vaccins et les règles", async () => {
    connecterSuperviseur();
    servirSchema();
    rendre(<SchemaVaccinal />);

    expect(await screen.findByText(/9 vaccins/)).toBeInTheDocument();
  });
});
