import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthentification } from "@/etat/authentification";

export function Protege({ children }: { children: ReactNode }) {
  const connecte = useAuthentification((e) => e.connecte);
  const emplacement = useLocation();

  if (!connecte) {
    return (
      <Navigate to="/connexion" replace state={{ depuis: emplacement.pathname }} />
    );
  }
  return <>{children}</>;
}
