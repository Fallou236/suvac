import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource-variable/public-sans";
import "./index.css";
import { routeur } from "./routes";
import { surPerteDeSession } from "./api/client";
import { useAuthentification } from "./etat/authentification";

// Quand la session ne peut plus être prolongée, on vide l'état local.
surPerteDeSession(() => useAuthentification.getState().deconnexion());

const client = new QueryClient({
  defaultOptions: {
    queries: {
      // La connectivité est mauvaise sur le terrain : on réessaie,
      // mais sans s'acharner.
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <RouterProvider router={routeur} />
    </QueryClientProvider>
  </StrictMode>,
);
