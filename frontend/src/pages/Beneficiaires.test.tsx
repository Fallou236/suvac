import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rendre } from "@/tests/utilitaires";
import { serveur, http, HttpResponse } from "@/tests/serveur";
import { useAuthentification } from "@/etat/authentification";
import Beneficiaires from "./Beneficiaires";
import { screen, waitFor } from "@testing-library/react";

function connecter() {
  useAuthentification.getState().definirUtilisateur({
    id: "u1",
    username: "awa.ndiaye",
    nom_complet: "Awa Ndiaye",
    role: "agent",
    poste: { id: "p1", nom: "Poste de Ndondol" },
  } as never);
}

const MERE = {
  id: "mere-1",
  prenom: "Khady",
  nom: "Ndiaye",
  nom_complet: "Khady Ndiaye",
  telephone: "+221771000001",
  village: "Ndondol",
};

const MERE_COMPLETE = {
  ...MERE,
  langue: "wo",
  accepte_les_rappels: true,
  consentements: [],
};

/**
 * Prépare les quatre routes qu'appelle l'écran : la liste des mères, la fiche
 * d'une mère, ses enfants et ses grossesses. MSW est réglé pour échouer sur
 * une requête non interceptée — autant toutes les servir d'un coup.
 */
function servirEcran({
  meres = [MERE],
  fiche = MERE_COMPLETE,
  enfants = [],
  grossesses = [],
}: {
  meres?: unknown[];
  fiche?: unknown;
  enfants?: unknown[];
  grossesses?: unknown[];
} = {}) {
  const page = (resultats: unknown[]) => ({
    count: resultats.length,
    next: null,
    previous: null,
    results: resultats,
  });

  serveur.use(
    http.get("/api/meres/", () => HttpResponse.json(page(meres))),
    http.get("/api/meres/mere-1/", () => HttpResponse.json(fiche)),
    http.get("/api/enfants/", () => HttpResponse.json(page(enfants))),
    http.get("/api/grossesses/", () => HttpResponse.json(page(grossesses))),
  );
}

describe("Beneficiaires", () => {
  it("liste les mères du poste", async () => {
    connecter();
    servirEcran();
    rendre(<Beneficiaires />);

    expect(await screen.findByText("Khady Ndiaye")).toBeInTheDocument();
  });

  it("invite à enregistrer une mère quand la liste est vide", async () => {
    connecter();
    servirEcran({ meres: [] });
    rendre(<Beneficiaires />);

    expect(
      await screen.findByText(/aucune mère enregistrée/i),
    ).toBeInTheDocument();
  });

  it("ouvre le formulaire de création", async () => {
    const utilisateur = userEvent.setup();
    connecter();
    servirEcran();
    rendre(<Beneficiaires />);

    await utilisateur.click(
      await screen.findByRole("button", { name: /nouvelle mère/i }),
    );

    expect(
      await screen.findByRole("heading", { name: /enregistrer une mère/i }),
    ).toBeInTheDocument();
  });

  it("ouvre la fiche de la mère au clic", async () => {
    const utilisateur = userEvent.setup();
    connecter();
    servirEcran({
      fiche: {
        ...MERE_COMPLETE,
        consentements: [
          {
            id: "c1",
            canal: "whatsapp",
            accorde_le: "2026-01-15T10:00:00Z",
            revoque_le: null,
            actif: true,
          },
        ],
      },
    });

    rendre(<Beneficiaires />);
    await utilisateur.click(await screen.findByText("Khady Ndiaye"));

    expect(await screen.findByText(/rappels acceptés/i)).toBeInTheDocument();
    expect(screen.getByText(/aucun enfant enregistré/i)).toBeInTheDocument();
  });

  it("signale l'absence de consentement sur la fiche", async () => {
    const utilisateur = userEvent.setup();
    connecter();
    servirEcran({
      fiche: { ...MERE_COMPLETE, langue: "fr", accepte_les_rappels: false },
    });

    rendre(<Beneficiaires />);
    await utilisateur.click(await screen.findByText("Khady Ndiaye"));

    expect(
      await screen.findByText(/aucun rappel ne sera envoyé/i),
    ).toBeInTheDocument();
  });

  it("affiche les grossesses suivies", async () => {
    const utilisateur = userEvent.setup();
    connecter();
    servirEcran({
      grossesses: [
        {
          id: "g1",
          rang: 2,
          date_reference: "2026-03-01",
          terme_estime: "2026-10-15",
          statut: "en_cours",
        },
      ],
    });

    rendre(<Beneficiaires />);
    await utilisateur.click(await screen.findByText("Khady Ndiaye"));

    expect(await screen.findByText(/grossesse 2/i)).toBeInTheDocument();
    expect(screen.getByText(/en cours/i)).toBeInTheDocument();
  });

  it("ouvre le formulaire de grossesse depuis la fiche", async () => {
    const utilisateur = userEvent.setup();
    connecter();
    servirEcran();

    rendre(<Beneficiaires />);
    await utilisateur.click(await screen.findByText("Khady Ndiaye"));

    await utilisateur.click(
      await screen.findByRole("button", { name: /ajouter une grossesse/i }),
    );

    expect(
      await screen.findByRole("heading", { name: /enregistrer une grossesse/i }),
    ).toBeInTheDocument();
  });

    it("ouvre un accès pour la mère", async () => {
    const utilisateur = userEvent.setup();
    connecter();
    servirEcran();
    let corpsRecu: Record<string, unknown> | null = null;

    serveur.use(
      http.post("/api/meres/mere-1/ouvrir-acces/", async ({ request }) => {
        corpsRecu = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ identifiant: "khady.ndiaye" }, { status: 201 });
      }),
    );

    rendre(<Beneficiaires />);
    await utilisateur.click(await screen.findByText("Khady Ndiaye"));
    await utilisateur.click(
      await screen.findByRole("button", { name: /^ouvrir un accès$/i }),
    );
    await utilisateur.type(screen.getByLabelText(/^identifiant/i), "khady.ndiaye");
    await utilisateur.type(screen.getByLabelText(/^mot de passe/i), "motdepasse-solide");
    await utilisateur.click(screen.getByRole("button", { name: /ouvrir l'accès/i }));

    await waitFor(() => expect(corpsRecu).not.toBeNull());
    expect(corpsRecu).toMatchObject({
      identifiant: "khady.ndiaye",
      mot_de_passe: "motdepasse-solide",
    });
  });

  it("propose de fermer un accès existant", async () => {
    const utilisateur = userEvent.setup();
    connecter();
    servirEcran({ fiche: { ...MERE_COMPLETE, a_un_acces: true } });

    rendre(<Beneficiaires />);
    await utilisateur.click(await screen.findByText("Khady Ndiaye"));

    expect(
      await screen.findByRole("button", { name: /fermer l'accès/i }),
    ).toBeInTheDocument();
  });
});
