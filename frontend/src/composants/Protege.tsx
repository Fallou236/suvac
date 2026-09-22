import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthentification } from "@/etat/authentification";
import { accueilPour } from "@/etat/navigation";

/**
 * Deux contrôles : être connecté, puis avoir un rôle autorisé. Un rôle
 * refusé est renvoyé vers sa propre page d'accueil plutôt que vers une
 * erreur — une mère qui arrive sur la file du jour atterrit dans son espace.
 *
 * Ce n'est qu'un confort d'interface : le refus réel est fait par l'API.
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

  if (roles && utilisateur && !roles.includes(utilisateur.role)) {
    return <Navigate to={accueilPour(utilisateur.role)} replace />;
  }

  return <>{children}</>;
}
