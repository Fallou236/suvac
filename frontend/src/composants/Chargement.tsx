export function Chargement() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status">
      <span className="sr-only">Chargement…</span>
      <span className="size-8 animate-spin rounded-full border-2 border-cuivre border-t-transparent" />
    </div>
  );
}
