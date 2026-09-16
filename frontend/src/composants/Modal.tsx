import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  ouvert: boolean;
  titre: string;
  onFermer: () => void;
  children: ReactNode;
};

/**
 * Utilise l'élément `<dialog>` natif : il gère le piège de focus, la touche
 * Échap et le voile modal sans code supplémentaire. Une bibliothèque aurait
 * ajouté 15 Ko pour le même résultat.
 */
export function Modal({ ouvert, titre, onFermer, children }: Props) {
  const reference = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogue = reference.current;
    if (!dialogue) return;

    if (ouvert && !dialogue.open) dialogue.showModal();
    if (!ouvert && dialogue.open) dialogue.close();
  }, [ouvert]);

  return (
    <dialog
      ref={reference}
      onClose={onFermer}
      onClick={(evenement) => {
        // Fermer au clic sur le voile, pas sur le contenu.
        if (evenement.target === reference.current) onFermer();
      }}
      className="fixed inset-0 m-auto h-fit w-[min(30rem,calc(100vw-2rem))] rounded-lg border border-bordure bg-white p-0 shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-bordure px-5 py-3.5">
        <h2 className="text-base font-bold text-texte">{titre}</h2>
        <button
          onClick={onFermer}
          aria-label="Fermer"
          className="grid size-8 place-items-center rounded-md text-texte-faible transition-colors duration-[120ms] hover:bg-surface-basse"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="p-5">{children}</div>
    </dialog>
  );
}
