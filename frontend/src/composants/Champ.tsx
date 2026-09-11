import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  libelle: string;
  erreur?: string;
  aide?: ReactNode;
};

export function Champ({ libelle, erreur, aide, className, ...reste }: Props) {
  const id = useId();
  const idAide = `${id}-aide`;
  const idErreur = `${id}-erreur`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-texte">
        {libelle}
        {reste.required && (
          <span className="ml-1 text-retard" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {aide && (
        <p id={idAide} className="text-sm text-texte-faible">
          {aide}
        </p>
      )}

      <input
        {...reste}
        id={id}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={cn(aide && idAide, erreur && idErreur) || undefined}
        className={cn(
          "min-h-tactile rounded-md border bg-white px-3 text-base text-texte",
          "transition-colors duration-[120ms]",
          "placeholder:text-texte-faible",
          erreur
            ? "border-retard bg-retard-fond"
            : "border-bordure focus:border-cuivre",
          className,
        )}
      />

      {erreur && (
        <p id={idErreur} role="alert" className="text-sm font-medium text-retard">
          {erreur}
        </p>
      )}
    </div>
  );
}
