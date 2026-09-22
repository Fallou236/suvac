import { useSearchParams } from "react-router-dom";
import { Coquille } from "@/composants/Coquille";
import { DeuxColonnes } from "@/composants/DeuxColonnes";
import { Chargement } from "@/composants/Chargement";
import { Etiquette } from "@/composants/Etiquette";
import { cn } from "@/composants/cn";
import { messageDErreur } from "@/etat/messages";
import { useFichesVaccins } from "@/etat/vaccins";
import type { FicheVaccin } from "@/api/requetes";

const VOIES: Record<string, string> = {
  orale: "Gouttes par la bouche",
  intradermique: "Injection",
  intramusculaire: "Injection",
  sous_cutanee: "Injection",
};

export default function Vaccins() {
  const [parametres, setParametres] = useSearchParams();
  const choisi = parametres.get("code");
  const { data, isPending, error } = useFichesVaccins();

  const choisir = (code: string | null) =>
    setParametres(code ? { code } : {}, { replace: true });

  const actif = data?.find((v) => v.code === choisi) ?? null;

  return (
    <Coquille titre="Les vaccins">
      {isPending ? (
        <Chargement />
      ) : error ? (
        <p className="px-6 py-16 text-center text-retard">{messageDErreur(error)}</p>
      ) : (
        <DeuxColonnes
          detailVisible={actif !== null}
          liste={
            <ul>
              {data.map((vaccin) => (
                <li key={vaccin.code}>
                  <button
                    onClick={() => choisir(vaccin.code)}
                    aria-current={vaccin.code === choisi ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-bordure px-4 py-3 text-left",
                      "transition-colors duration-[120ms]",
                      vaccin.code === choisi ? "bg-cuivre-clair" : "hover:bg-surface-basse",
                    )}
                  >
                    <span className="grid h-9 min-w-12 shrink-0 place-items-center rounded-md bg-baobab-clair px-1.5 text-[10px] font-bold text-baobab">
                      {vaccin.code}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-texte">
                        {vaccin.libelle}
                      </span>
                      <span className="block truncate text-xs text-texte-faible">
                        {vaccin.protege_contre || "—"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          }
          detail={
            actif ? (
              <Fiche vaccin={actif} onFermer={() => choisir(null)} />
            ) : (
              <Introduction nombre={data.length} />
            )
          }
        />
      )}
    </Coquille>
  );
}

function Fiche({ vaccin, onFermer }: { vaccin: FicheVaccin; onFermer: () => void }) {
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-5 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-baobab text-sm font-bold text-white">
            {vaccin.code}
          </span>
          <div>
            <h2 className="text-2xl font-bold text-texte">{vaccin.libelle}</h2>
            <div className="mt-1.5">
              <Etiquette>{VOIES[vaccin.voie] ?? vaccin.voie}</Etiquette>
            </div>
          </div>
        </div>
        <button
          onClick={onFermer}
          aria-label="Fermer la fiche"
          className="grid size-9 shrink-0 place-items-center rounded-md text-texte-faible hover:bg-surface-basse lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {vaccin.protege_contre && (
        <div className="rounded-lg border border-baobab/20 bg-baobab-clair px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-baobab">
            Protège contre
          </p>
          <p className="mt-0.5 text-lg font-semibold text-texte">
            {vaccin.protege_contre}
          </p>
        </div>
      )}

      <div className="text-base leading-relaxed text-texte">
        {vaccin.description ? (
          vaccin.description.split("\n\n").map((paragraphe, index) => (
            <p key={index} className="mt-3 first:mt-0">
              {paragraphe}
            </p>
          ))
        ) : (
          <p className="text-texte-faible">Description à venir.</p>
        )}
      </div>

      <p className="border-t border-bordure pt-4 text-sm text-texte-faible">
        Ces informations ne remplacent pas les conseils de votre agent de santé.
        En cas de doute ou de réaction inhabituelle après un vaccin, rendez-vous
        au poste de santé.
      </p>
    </article>
  );
}

function Introduction({ nombre }: { nombre: number }) {
  return (
    <div className="grid h-full place-items-center px-6">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-baobab-clair text-baobab">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" strokeLinejoin="round" />
            <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h2 className="mt-4 text-xl font-bold text-texte">Pourquoi vacciner ?</h2>
        <p className="mt-2 text-sm leading-relaxed text-texte-faible">
          Les vaccins protègent votre enfant contre des maladies graves avant
          qu'il ne les rencontre. Le calendrier compte {nombre} vaccins : chacun
          a son moment, et chaque dose compte.
        </p>
        <p className="mt-3 text-sm text-texte-faible">
          Choisissez un vaccin dans la liste pour savoir à quoi il sert.
        </p>
      </div>
    </div>
  );
}
