import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rendre } from "@/tests/utilitaires";
import { connecterMere, servirEspace } from "@/tests/espace";
import Messages from "./Messages";

describe("Messages", () => {
  it("place les retards en tête", async () => {
    connecterMere();
    servirEspace();
    rendre(<Messages />);

    const titres = await screen.findAllByText(/vaccin à (rattraper|faire)/i);
    expect(titres[0]).toHaveTextContent(/à rattraper/i);
  });

  it("signale un retard sans culpabiliser", async () => {
    connecterMere();
    servirEspace();
    rendre(<Messages />);

    expect(
      await screen.findByText(/il est encore temps de le faire/i),
    ).toBeInTheDocument();
  });

  it("s'adresse directement à la mère pour son propre vaccin", async () => {
    connecterMere();
    servirEspace();
    rendre(<Messages />);

    expect(
      await screen.findByText(/vous devez recevoir le vaccin antitétanique/i),
    ).toBeInTheDocument();
  });

  it("accompagne chaque message de l'explication du vaccin", async () => {
    connecterMere();
    servirEspace();
    rendre(<Messages />);

    const explications = await screen.findAllByText(/pourquoi ce vaccin/i);
    expect(explications).toHaveLength(2);
  });

  it("filtre les messages en retard", async () => {
    const utilisateur = userEvent.setup();
    connecterMere();
    servirEspace();
    rendre(<Messages />);

    await utilisateur.click(await screen.findByRole("tab", { name: /en retard/i }));

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
