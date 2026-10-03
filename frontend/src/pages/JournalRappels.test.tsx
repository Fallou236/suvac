import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rendre } from "@/tests/utilitaires";
import { serveur, http, HttpResponse } from "@/tests/serveur";
import { useAuthentification } from "@/etat/authentification";
import JournalRappels from "./JournalRappels";

function connecterSuperviseur() {
  useAuthentification.getState().definirUtilisateur({
    id: "s1",
    username: "fatou.gueye",
    nom_complet: "Fatou Guèye",
    role: "superviseur",
    poste: { id: "p1", nom: "Poste de Ndondol" },
  } as never);
}

const SYNTHESE = {
  total: 42,
  en_attente: 3,
  envoyes: 12,
  remis: 20,
  lus: 5,
  echecs: 2,
  abandonnes: 0,
  taux_remise: 64.1,
  taux_lecture: 12.8,
  par_canal: [
    { canal: "whatsapp", total: 35, echecs: 2 },
    { canal: "sms", total: 7, echecs: 0 },
  ],
  motifs_echec: [
    { erreur: "[131026] Receiver incapable of receiving message", occurrences: 2 },
  ],
  periode_jours: 30,
  depuis: "2026-08-25",
};

const RAPPEL_ENVOYE = {
  id: "r1",
  destinataire: "Rokhaya Ba",
  telephone: "+221771000005",
  village: "Keur Samba",
  type: "relance",
  type_libelle: "Relance après retard",
  canal: "whatsapp",
  langue: "wo",
  statut: "remis",
  statut_libelle: "Remis au destinataire",
  texte: "Nanga def. Sokhna Ba jotul ñakk Polio oral bi ñu ko waroon a jox 5 sulet.",
  vaccins: ["VPO-1", "ROTA-1"],
  planifie_pour: "2026-09-23",
  envoye_le: "2026-09-23T06:02:00Z",
  remis_le: "2026-09-23T06:03:00Z",
  erreur: "",
  tentatives: 1,
};

const RAPPEL_APPLICATION = {
  ...RAPPEL_ENVOYE,
  id: "r2",
  destinataire: "Coumba Faye",
  canal: "application",
  statut: "en_attente",
  statut_libelle: "En attente",
  envoye_le: null,
  remis_le: null,
};

const RAPPEL_ECHEC = {
  ...RAPPEL_ENVOYE,
  id: "r3",
  destinataire: "Bineta Fall",
  statut: "echec",
  statut_libelle: "Échec",
  erreur: "[131026] Receiver incapable of receiving message",
  tentatives: 3,
  remis_le: null,
};

function servirJournal({
  synthese = SYNTHESE,
  rappels = [RAPPEL_ENVOYE, RAPPEL_APPLICATION, RAPPEL_ECHEC],
} = {}) {
  serveur.use(
    http.get("/api/rappels/synthese/", () => HttpResponse.json(synthese)),
    http.get("/api/rappels/", () =>
      HttpResponse.json({
        count: rappels.length,
        next: null,
        previous: null,
        results: rappels,
      }),
    ),
  );
}

describe("JournalRappels", () => {
  it("résume l'acheminement sur la période", async () => {
    connecterSuperviseur();
    servirJournal();
    rendre(<JournalRappels />);

    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.getByText("64.1")).toBeInTheDocument();
  });

  it("met en avant les motifs d'échec les plus fréquents", async () => {
    connecterSuperviseur();
    servirJournal();
    rendre(<JournalRappels />);

    expect(
      await screen.findByText(/motifs d'échec les plus fréquents/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/receiver incapable/i)).toBeInTheDocument();
  });

  it("n'affiche pas la section des échecs quand il n'y en a pas", async () => {
    connecterSuperviseur();
    servirJournal({
      synthese: { ...SYNTHESE, echecs: 0, motifs_echec: [] },
    });
    rendre(<JournalRappels />);

    await screen.findByText("42");
    expect(screen.queryByText(/motifs d'échec/i)).not.toBeInTheDocument();
  });

  it("liste les rappels émis", async () => {
    connecterSuperviseur();
    servirJournal();
    rendre(<JournalRappels />);

    expect(await screen.findByText("Rokhaya Ba")).toBeInTheDocument();
    expect(screen.getByText("Bineta Fall")).toBeInTheDocument();
  });

  it("montre le texte réellement envoyé", async () => {
    const utilisateur = userEvent.setup();
    connecterSuperviseur();
    servirJournal();
    rendre(<JournalRappels />);

    await utilisateur.click(await screen.findByText("Rokhaya Ba"));

    expect(await screen.findByText(/jotul ñakk Polio oral/)).toBeInTheDocument();
    expect(screen.getByText(/langue : wolof/i)).toBeInTheDocument();
  });

  it("liste les vaccins concernés", async () => {
    const utilisateur = userEvent.setup();
    connecterSuperviseur();
    servirJournal();
    rendre(<JournalRappels />);

    await utilisateur.click(await screen.findByText("Rokhaya Ba"));

    expect(await screen.findByText("VPO-1")).toBeInTheDocument();
    expect(screen.getByText("ROTA-1")).toBeInTheDocument();
  });

  it("retrace l'acheminement d'un message envoyé", async () => {
    const utilisateur = userEvent.setup();
    connecterSuperviseur();
    servirJournal();
    rendre(<JournalRappels />);

    await utilisateur.click(await screen.findByText("Rokhaya Ba"));

    expect(await screen.findByText("Planifié")).toBeInTheDocument();
    expect(screen.getByText("Envoyé")).toBeInTheDocument();
    expect(screen.getAllByText("Remis").length).toBeGreaterThan(1);
  });

  it("distingue un rappel consultable dans l'espace de la mère", async () => {
    const utilisateur = userEvent.setup();
    connecterSuperviseur();
    servirJournal({ rappels: [RAPPEL_APPLICATION] });
    rendre(<JournalRappels />);

    await utilisateur.click(await screen.findByText("Coumba Faye"));

    expect(
      await screen.findByText(/consultable dans l'espace de la mère/i),
    ).toBeInTheDocument();
    // Aucune étape d'envoi : il n'y en aura jamais.
    expect(screen.queryByText("Envoyé")).not.toBeInTheDocument();
  });

  it("expose le motif d'un échec", async () => {
    const utilisateur = userEvent.setup();
    connecterSuperviseur();
    servirJournal({ rappels: [RAPPEL_ECHEC] });
    rendre(<JournalRappels />);

    await utilisateur.click(await screen.findByText("Bineta Fall"));

    expect((await screen.findAllByText(/receiver incapable/i)).length).toBeGreaterThan(1);
    expect(screen.getByText(/3 tentatives/i)).toBeInTheDocument();
  });

  it("filtre par statut", async () => {
    const utilisateur = userEvent.setup();
    connecterSuperviseur();
    servirJournal();
    rendre(<JournalRappels />);

    await screen.findByText("Rokhaya Ba");
    await utilisateur.click(screen.getByRole("button", { name: /^en échec$/i }));

    // Le filtre est appliqué par le serveur : la requête repart.
    expect(screen.getByRole("button", { name: /^en échec$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("annonce l'absence de rappel", async () => {
    connecterSuperviseur();
    servirJournal({ rappels: [] });
    rendre(<JournalRappels />);

    expect(await screen.findByText(/aucun rappel/i)).toBeInTheDocument();
  });

  it("explique qu'aucun rappel n'a encore été produit", async () => {
    connecterSuperviseur();
    servirJournal({ rappels: [] });
    rendre(<JournalRappels />);

    expect(
      await screen.findByText(/après le premier balayage/i),
    ).toBeInTheDocument();
  });
});
