import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rendre } from "@/tests/utilitaires";
import { connecterMere, servirEspace } from "@/tests/espace";
import Messages from "./Messages";

describe("Messages", () => {
  it("liste les messages reçus", async () => {
    connecterMere();
    servirEspace();
    rendre(<Messages />);

    expect(await screen.findByText(/vaccin à rattraper/i)).toBeInTheDocument();
    expect(screen.getByText(/vaccin à faire/i)).toBeInTheDocument();
  });

  it("propose de tout marquer comme lu quand il reste des non-lus", async () => {
    connecterMere();
    servirEspace();
    rendre(<Messages />);

    expect(
      await screen.findByRole("button", { name: /tout marquer comme lu/i }),
    ).toBeInTheDocument();
  });

  it("ouvre le message choisi", async () => {
    const utilisateur = userEvent.setup();
    connecterMere();
    servirEspace();
    rendre(<Messages />);

    await utilisateur.click(await screen.findByText(/vaccin à rattraper/i));

    expect(
      await screen.findByText(/il est encore temps de le faire/i),
    ).toBeInTheDocument();
  });

  it("affiche le texte tel qu'il a été envoyé", async () => {
    const utilisateur = userEvent.setup();
    connecterMere();
    servirEspace();
    rendre(<Messages />);

    await utilisateur.click(await screen.findByText(/vaccin à faire/i));

    expect(
      await screen.findByText(/vous devez recevoir votre vaccin antitétanique/i),
    ).toBeInTheDocument();
  });

  it("accompagne le message de l'explication du vaccin", async () => {
    const utilisateur = userEvent.setup();
    connecterMere();
    servirEspace();
    rendre(<Messages />);

    await utilisateur.click(await screen.findByText(/vaccin à rattraper/i));

    expect(await screen.findByText(/pourquoi ce vaccin/i)).toBeInTheDocument();
  });

  it("filtre les messages non lus", async () => {
    const utilisateur = userEvent.setup();
    connecterMere();
    servirEspace();
    rendre(<Messages />);

    await utilisateur.click(await screen.findByRole("tab", { name: /non lus/i }));

    expect(screen.getByText(/vaccin à rattraper/i)).toBeInTheDocument();
    expect(screen.queryByText(/vaccin à faire/i)).not.toBeInTheDocument();
  });

  it("annonce l'absence de message", async () => {
    connecterMere();
    servirEspace({ rappels: [] });
    rendre(<Messages />);

    expect(await screen.findByText(/aucun message/i)).toBeInTheDocument();
  });
});
