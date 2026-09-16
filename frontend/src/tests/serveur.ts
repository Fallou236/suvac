import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

/**
 * Serveur d'interception des requêtes.
 *
 * Les tests de composants ne touchent jamais le vrai backend : ils seraient
 * lents, dépendraient d'une base et échoueraient en CI. MSW intercepte au
 * niveau du réseau, donc le code testé est exactement celui de production —
 * contrairement à un mock du client, qui testerait le mock.
 */
export const serveur = setupServer();

export { http, HttpResponse };
