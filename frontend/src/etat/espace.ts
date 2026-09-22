import { useQueries, useQuery } from "@tanstack/react-query";
import { requetes, type MonBeneficiaire, type MonCarnet } from "@/api/requetes";

export type BeneficiaireEspace = MonBeneficiaire & {
  type: "enfant" | "grossesse";
  titre: string;
};

/**
 * Les bénéficiaires de la mère et leurs carnets complets.
 *
 * Une requête par carnet : une mère a rarement plus de quatre enfants et
 * grossesses suivis, et les carnets sont ensuite partagés par toutes les
 * pages de l'espace via le cache.
 */
export function useMesCarnets() {
  const beneficiaires = useQuery({
    queryKey: ["mon-dossier", "beneficiaires"],
    queryFn: requetes.mesBeneficiaires,
  });

  const liste: BeneficiaireEspace[] = [
    ...(beneficiaires.data?.enfants ?? []).map((enfant) => ({
      ...enfant,
      type: "enfant" as const,
      titre: enfant.nom,
    })),
    ...(beneficiaires.data?.grossesses ?? []).map((grossesse) => ({
      ...grossesse,
      type: "grossesse" as const,
      titre: `Ma grossesse ${grossesse.rang}`,
    })),
  ];

  const carnets = useQueries({
    queries: liste.map((b) => ({
      queryKey: ["mon-dossier", "carnet", b.id],
      queryFn: () => requetes.monCarnet(b.id),
    })),
  });

  const parId: Record<string, MonCarnet> = {};
  carnets.forEach((requete, index) => {
    if (requete.data) parId[liste[index].id] = requete.data;
  });

  return {
    liste,
    carnets: parId,
    chargement: beneficiaires.isPending || carnets.some((q) => q.isPending),
    erreur: beneficiaires.error ?? carnets.find((q) => q.error)?.error ?? null,
  };
}
