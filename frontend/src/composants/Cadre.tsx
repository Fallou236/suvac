import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Chargement } from "./Chargement";

export function Cadre() {
  return (
    <Suspense fallback={<Chargement />}>
      <Outlet />
    </Suspense>
  );
}
