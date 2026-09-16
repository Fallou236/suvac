import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { serveur } from "./serveur";

/**
 * jsdom n'implémente pas l'API `<dialog>`. On la complète a minima pour que
 * les composants qui s'en servent restent testables. Ce n'est pas un défaut
 * du code applicatif : l'élément fonctionne dans tous les navigateurs cibles.
 */
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal ??= function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}

beforeAll(() => serveur.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  cleanup();
  serveur.resetHandlers();
});

afterAll(() => serveur.close());
