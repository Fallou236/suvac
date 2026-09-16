import { beforeEach, describe, expect, it, vi } from "vitest";
import { serveur, http, HttpResponse } from "@/tests/serveur";
import {
  api,
  definirJetons,
  effacerJetons,
  ErreurApi,
  jetonPresent,
  surPerteDeSession,
} from "./client";

describe("client d'API", () => {
  beforeEach(() => effacerJetons());

  it("n'expose aucun jeton tant qu'on n'est pas connecté", () => {
    expect(jetonPresent()).toBe(false);
  });

  it("joint le jeton d'accès aux requêtes", async () => {
    let entete: string | null = null;

    serveur.use(
      http.get("/api/meres/", ({ request }) => {
        entete = request.headers.get("Authorization");
        return HttpResponse.json({ results: [] });
      }),
    );

    definirJetons("jeton-acces", "jeton-rafraichissement");
    await api.get("/meres/");

    expect(entete).toBe("Bearer jeton-acces");
  });

  it("transmet les paramètres de requête", async () => {
    let url: string | null = null;

    serveur.use(
      http.get("/api/meres/", ({ request }) => {
        url = request.url;
        return HttpResponse.json({ results: [] });
      }),
    );

    definirJetons("a", "r");
    await api.get("/meres/", { search: "Ndiaye", page: 2 });

    expect(url).toContain("search=Ndiaye");
    expect(url).toContain("page=2");
  });

  it("ignore les paramètres vides", async () => {
    let url: string | null = null;

    serveur.use(
      http.get("/api/meres/", ({ request }) => {
        url = request.url;
        return HttpResponse.json({ results: [] });
      }),
    );

    definirJetons("a", "r");
    await api.get("/meres/", { search: "", page: undefined });

    expect(url).not.toContain("search=");
    expect(url).not.toContain("page=");
  });

  it("lève une ErreurApi porteuse du statut et du corps", async () => {
    serveur.use(
      http.post("/api/doses/", () =>
        HttpResponse.json({ violations: ["date_future"] }, { status: 400 }),
      ),
    );

    definirJetons("a", "r");

    await expect(api.post("/doses/", {})).rejects.toSatisfy((erreur: unknown) => {
      if (!(erreur instanceof ErreurApi)) return false;
      expect(erreur.statut).toBe(400);
      expect(erreur.donnees).toMatchObject({ violations: ["date_future"] });
      return true;
    });
  });

  it("renvoie undefined sur une réponse 204 sans corps", async () => {
    serveur.use(
      http.post("/api/meres/x/revoquer-consentement/", () =>
        new HttpResponse(null, { status: 204 }),
      ),
    );

    definirJetons("a", "r");
    await expect(api.post("/meres/x/revoquer-consentement/")).resolves.toBeUndefined();
  });

  it("rafraîchit le jeton puis rejoue la requête après un 401", async () => {
    let appels = 0;

    serveur.use(
      http.get("/api/meres/", ({ request }) => {
        appels += 1;
        const entete = request.headers.get("Authorization");
        if (entete === "Bearer perime") {
          return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({ results: ["ok"] });
      }),
      http.post("/api/auth/rafraichir/", () =>
        HttpResponse.json({ access: "jeton-neuf" }),
      ),
    );

    definirJetons("perime", "rafraichissement-valide");
    const resultat = await api.get<{ results: string[] }>("/meres/");

    expect(appels).toBe(2);
    expect(resultat.results).toEqual(["ok"]);
  });

  it("ne rejoue qu'une seule fois", async () => {
    let appels = 0;

    serveur.use(
      http.get("/api/meres/", () => {
        appels += 1;
        return new HttpResponse(null, { status: 401 });
      }),
      http.post("/api/auth/rafraichir/", () =>
        HttpResponse.json({ access: "jeton-neuf" }),
      ),
    );

    definirJetons("perime", "rafraichissement-valide");
    await expect(api.get("/meres/")).rejects.toBeInstanceOf(ErreurApi);

    // Un rejeu, pas une boucle.
    expect(appels).toBe(2);
  });

  it("vide la session et prévient quand le rafraîchissement échoue", async () => {
    const rappel = vi.fn();
    surPerteDeSession(rappel);

    serveur.use(
      http.get("/api/meres/", () => new HttpResponse(null, { status: 401 })),
      http.post("/api/auth/rafraichir/", () =>
        new HttpResponse(null, { status: 401 }),
      ),
    );

    definirJetons("perime", "rafraichissement-perime");
    await expect(api.get("/meres/")).rejects.toBeInstanceOf(ErreurApi);

    expect(rappel).toHaveBeenCalled();
    expect(jetonPresent()).toBe(false);
  });

  it("ne lance qu'un seul rafraîchissement pour des requêtes concurrentes", async () => {
    let rafraichissements = 0;

    serveur.use(
      http.get("/api/meres/", ({ request }) => {
        const entete = request.headers.get("Authorization");
        if (entete === "Bearer perime") {
          return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({ results: [] });
      }),
      http.post("/api/auth/rafraichir/", async () => {
        rafraichissements += 1;
        await new Promise((r) => setTimeout(r, 20));
        return HttpResponse.json({ access: "jeton-neuf" });
      }),
    );

    definirJetons("perime", "rafraichissement-valide");
    await Promise.all([
      api.get("/meres/"),
      api.get("/meres/"),
      api.get("/meres/"),
    ]);

    // Avec la rotation activée côté Django, trois rafraîchissements
    // concurrents en feraient échouer deux sur un jeton déjà mis en
    // liste noire (voir ADR 0004 et SIMPLE_JWT).
    expect(rafraichissements).toBe(1);
  });
});
