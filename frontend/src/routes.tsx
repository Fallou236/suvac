import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import { Cadre } from "@/composants/Cadre";
import { Protege } from "@/composants/Protege";

const Connexion = lazy(() => import("@/pages/Connexion"));
const FileDuJour = lazy(() => import("@/pages/FileDuJour"));

export const routeur = createBrowserRouter([
  {
    element: <Cadre />,
    children: [
      { path: "/connexion", element: <Connexion /> },
      {
        path: "/",
        element: (
          <Protege>
            <FileDuJour />
          </Protege>
        ),
      },
    ],
  },
]);
