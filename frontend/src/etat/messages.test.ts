import { describe, expect, it } from "vitest";
import { ErreurApi } from "@/api/client";
import { erreursParChamp, messageDErreur } from "./messages";

describe("messageDErreur", () => {
  it("traduit les violations du moteur en langage clair", () => {
    const erreur = new ErreurApi(400, {
      detail: "L'administration ne respecte pas le schéma vaccinal.",
      violations: ["intervalle_minimal_non_respecte"],
    });

    expect(messageDErreur(erreur)).toContain("délai depuis la dose précédente");
  });

  it("enchaîne plusieurs violations", () => {
    const erreur = new ErreurApi(400, {
      violations: ["age_minimal_non_atteint", "dose_precedente_manquante"],
    });

    const message = messageDErreur(erreur);
    expect(message).toContain("trop jeune");
    expect(message).toContain("dose précédente");
  });

  it("laisse passer une violation inconnue plutôt que de la masquer", () => {
    const erreur = new ErreurApi(400, { violations: ["regle_future"] });

    expect(messageDErreur(erreur)).toContain("regle_future");
  });

  it("explique un identifiant incorrect", () => {
    expect(messageDErreur(new ErreurApi(401, null))).toContain("incorrect");
  });

  it("explique un droit manquant", () => {
    expect(messageDErreur(new ErreurApi(403, null))).toContain("droits");
  });

  it("explique une limitation de débit", () => {
    expect(messageDErreur(new ErreurApi(429, null))).toContain("tentatives");
  });

  it("remonte la première erreur de validation par champ", () => {
    const erreur = new ErreurApi(400, {
      telephone: ["Numéro invalide. Format attendu : +221771234567."],
    });

    expect(messageDErreur(erreur)).toContain("Numéro invalide");
  });

  it("signale une panne réseau quand l'erreur n'est pas une réponse HTTP", () => {
    expect(messageDErreur(new TypeError("Failed to fetch"))).toContain(
      "connexion",
    );
  });
});

describe("erreursParChamp", () => {
  it("extrait les erreurs de validation champ par champ", () => {
    const erreur = new ErreurApi(400, {
      prenom: ["Ce champ est obligatoire."],
      telephone: ["Numéro invalide."],
    });

    expect(erreursParChamp(erreur)).toEqual({
      prenom: "Ce champ est obligatoire.",
      telephone: "Numéro invalide.",
    });
  });

  it("ignore les erreurs qui ne sont pas de validation", () => {
    expect(erreursParChamp(new ErreurApi(500, null))).toEqual({});
  });
});
