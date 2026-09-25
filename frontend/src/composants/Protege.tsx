import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthentification } from "@/etat/authentification";
import { accueilPour } from "@/etat/navigation";

/**
 * Trois contrôles, dans cet ordre : être connecté, avoir un mot de passe
 * personnel, puis avoir un rôle autorisé.
 *
 * Le second passe avant le troisième : un agent dont le mot de passe est
 * encore celui de son superviseur verrait des écrans vides, l'API refusant
 * toutes ses requêtes.
 */
export function Protege({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: string[];
}) {
  const connecte = useAuthentification((e) => e.connecte);
  const utilisateur = useAuthentification((e) => e.utilisateur);
  const emplacement = useLocation();

  if (!connecte) {
    return (
      <Navigate to="/connexion" replace state={{ depuis: emplacement.pathname }} />
    );
  }

  if (utilisateur?.doit_changer_mot_de_passe) {
    return <Navigate to="/changer-mot-de-passe" replace />;
  }

  if (roles && utilisateur && !roles.includes(utilisateur.role)) {
    return <Navigate to={accueilPour(utilisateur.role)} replace />;
  }

  return <>{children}</>;
}
