import { useQuery } from "@tanstack/react-query";
import { requetes, type FicheVaccin } from "@/api/requetes";

/**
 * Les fiches changent rarement : chargées une fois, elles servent à toutes
 * les pages qui affichent une explication de vaccin.
 */
export function useFichesVaccins() {
  return useQuery({
    queryKey: ["vaccins"],
    queryFn: requetes.vaccins,
    staleTime: Infinity,
  });
}

export function indexerFiches(
  fiches: FicheVaccin[] | undefined,
): Record<string, FicheVaccin> {
  return Object.fromEntries((fiches ?? []).map((f) => [f.code, f]));
}
