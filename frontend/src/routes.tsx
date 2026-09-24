/* Fichier de définition des routes : le rechargement à chaud ne s'y applique
   pas, la règle sur l'export exclusif de composants n'a donc pas de sens ici. */
/* oxlint-disable react/only-export-components */

import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import { Cadre } from "@/composants/Cadre";
import { Protege } from "@/composants/Protege";
import { PERSONNEL } from "@/etat/navigation";

const Connexion = lazy(() => import("@/pages/Connexion"));
const FileDuJour = lazy(() => import("@/pages/FileDuJour"));
const Beneficiaires = lazy(() => import("@/pages/Beneficiaires"));
const Pilotage = lazy(() => import("@/pages/Pilotage"));
const Parametres = lazy(() => import("@/pages/Parametres"));
const Vaccins = lazy(() => import("@/pages/Vaccins"));
const Aujourdhui = lazy(() => import("@/pages/espace/Aujourdhui"));
const Carnets = lazy(() => import("@/pages/espace/Carnets"));
const Messages = lazy(() => import("@/pages/espace/Messages"));
const JournalRappels = lazy(() => import("@/pages/JournalRappels"));

export const routeur = createBrowserRouter([
  {
    element: <Cadre />,
    children: [
      { path: "/connexion", element: <Connexion /> },

      // --- Personnel soignant --------------------------------------
      {
        path: "/",
        element: (
          <Protege roles={PERSONNEL}>
            <FileDuJour />
          </Protege>
        ),
      },
      {
        path: "/beneficiaires",
        element: (
          <Protege roles={PERSONNEL}>
            <Beneficiaires />
          </Protege>
        ),
      },
      {
        path: "/pilotage",
        element: (
          <Protege roles={["superviseur", "admin"]}>
            <Pilotage />
          </Protege>
        ),
      },

      // --- Bénéficiaire --------------------------------------------
      {
        path: "/mon-espace",
        element: (
          <Protege roles={["beneficiaire"]}>
            <Aujourdhui />
          </Protege>
        ),
      },
      {
        path: "/mon-espace/carnets",
        element: (
          <Protege roles={["beneficiaire"]}>
            <Carnets />
          </Protege>
        ),
      },
      {
        path: "/mon-espace/carnets/:id",
        element: (
          <Protege roles={["beneficiaire"]}>
            <Carnets />
          </Protege>
        ),
      },
      {
        path: "/mon-espace/messages",
        element: (
          <Protege roles={["beneficiaire"]}>
            <Messages />
          </Protege>
        ),
      },

      // --- Tous les rôles ------------------------------------------
      {
        path: "/vaccins",
        element: (
          <Protege>
            <Vaccins />
          </Protege>
        ),
      },
      {
        path: "/parametres",
        element: (
          <Protege>
            <Parametres />
          </Protege>
        ),
      },
      {
        path: "/rappels",
        element: (
          <Protege roles={["superviseur", "admin"]}>
            <JournalRappels />
          </Protege>
        ),
      },
    ],
  },
]);
