import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Fusionne des classes Tailwind en résolvant les conflits.
 * `cn("p-2", "p-4")` donne `p-4` et non les deux.
 */
export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes));
}
