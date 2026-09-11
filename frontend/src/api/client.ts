/**
 * Client HTTP de l'API SUVAC.
 *
 * Le jeton d'accès reste en mémoire et n'est jamais écrit dans le stockage
 * du navigateur (ENF-11) : une faille XSS pourrait l'y lire. Le jeton de
 * rafraîchissement est conservé de la même façon en attendant le passage
 * au cookie httpOnly côté serveur.
 */

const BASE = "/api";

let jetonAcces: string | null = null;
let jetonRafraichissement: string | null = null;

/** Appelé quand la session ne peut plus être prolongée. */
let surDeconnexion: (() => void) | null = null;

export function definirJetons(acces: string, rafraichissement: string): void {
  jetonAcces = acces;
  jetonRafraichissement = rafraichissement;
}

export function effacerJetons(): void {
  jetonAcces = null;
  jetonRafraichissement = null;
}

export function jetonPresent(): boolean {
  return jetonAcces !== null;
}

export function surPerteDeSession(rappel: () => void): void {
  surDeconnexion = rappel;
}

export class ErreurApi extends Error {
  readonly statut: number;
  readonly donnees: unknown;

  constructor(statut: number, donnees: unknown, message?: string) {
    super(message ?? `Erreur ${statut}`);
    this.name = "ErreurApi";
    this.statut = statut;
    this.donnees = donnees;
  }
}

/** Une seule tentative de rafraîchissement à la fois, partagée. */
let rafraichissementEnCours: Promise<boolean> | null = null;

async function rafraichir(): Promise<boolean> {
  if (!jetonRafraichissement) return false;

  rafraichissementEnCours ??= (async () => {
    try {
      const reponse = await fetch(`${BASE}/auth/rafraichir/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: jetonRafraichissement }),
      });
      if (!reponse.ok) return false;

      const donnees = (await reponse.json()) as {
        access: string;
        refresh?: string;
      };
      jetonAcces = donnees.access;
      if (donnees.refresh) jetonRafraichissement = donnees.refresh;
      return true;
    } finally {
      rafraichissementEnCours = null;
    }
  })();

  return rafraichissementEnCours;
}

type Options = {
  methode?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  corps?: unknown;
  parametres?: Record<string, string | number | undefined>;
};

async function envoyer<T>(chemin: string, options: Options = {}): Promise<T> {
  const { methode = "GET", corps, parametres } = options;

  const url = new URL(`${BASE}${chemin}`, window.location.origin);
  if (parametres) {
    for (const [cle, valeur] of Object.entries(parametres)) {
      if (valeur !== undefined && valeur !== "") {
        url.searchParams.set(cle, String(valeur));
      }
    }
  }

  const executer = () =>
    fetch(url, {
      method: methode,
      headers: {
        ...(corps ? { "Content-Type": "application/json" } : {}),
        ...(jetonAcces ? { Authorization: `Bearer ${jetonAcces}` } : {}),
      },
      body: corps ? JSON.stringify(corps) : undefined,
    });

  let reponse = await executer();

  // Le jeton a expiré : on le rafraîchit et on rejoue une seule fois.
  if (reponse.status === 401 && jetonRafraichissement) {
    if (await rafraichir()) {
      reponse = await executer();
    } else {
      effacerJetons();
      surDeconnexion?.();
    }
  }

  if (reponse.status === 204) return undefined as T;

  const donnees = await reponse.json().catch(() => null);

  if (!reponse.ok) {
    throw new ErreurApi(reponse.status, donnees);
  }

  return donnees as T;
}

export const api = {
  get: <T>(chemin: string, parametres?: Options["parametres"]) =>
    envoyer<T>(chemin, { parametres }),
  post: <T>(chemin: string, corps?: unknown) =>
    envoyer<T>(chemin, { methode: "POST", corps }),
  patch: <T>(chemin: string, corps?: unknown) =>
    envoyer<T>(chemin, { methode: "PATCH", corps }),
  supprimer: <T>(chemin: string) => envoyer<T>(chemin, { methode: "DELETE" }),
};
