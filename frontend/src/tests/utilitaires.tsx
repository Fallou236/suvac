import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

/**
 * Rend un composant avec les fournisseurs dont dépend l'application.
 * Les tentatives sont désactivées : un test ne doit pas attendre trois
 * essais avant de constater une erreur.
 */
export function rendre(element: ReactElement, { route = "/" } = {}) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  function Enveloppe({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(element, { wrapper: Enveloppe });
}
