import type { ReactNode } from "react";
import { cn } from "./cn";

type Props = {
  liste: ReactNode;
  detail: ReactNode;
  /** Sur mobile, le détail recouvre la liste quand un élément est choisi. */
  detailVisible: boolean;
};

/**
 * Liste à gauche, détail à droite sur grand écran. Sur mobile, une seule
 * colonne à la fois : l'agent ouvre une fiche, elle prend tout l'écran.
 */
export function DeuxColonnes({ liste, detail, detailVisible }: Props) {
  return (
    <div className="flex h-full">
      <div
        className={cn(
          "defilement h-full overflow-y-auto border-r border-bordure bg-white",
          "w-full lg:w-liste lg:shrink-0",
          detailVisible && "hidden lg:block",
        )}
      >
        {liste}
      </div>

      <div
        className={cn(
          "defilement h-full min-w-0 flex-1 overflow-y-auto",
          !detailVisible && "hidden lg:block",
        )}
      >
        {detail}
      </div>
    </div>
  );
}
