import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Carte({ className, children, ...reste }: Props) {
  return (
    <div
      {...reste}
      className={cn(
        "rounded-lg border border-bordure bg-white p-5 shadow-[0_1px_2px_rgba(15,42,30,0.05)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
