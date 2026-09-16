import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { requetes } from "@/api/requetes";
import { Coquille } from "@/composants/Coquille";
import { DeuxColonnes } from "@/composants/DeuxColonnes";
import { Recherche } from "@/composants/Recherche";
import { Bouton } from "@/composants/Bouton";
import { Modal } from "@/composants/Modal";
import { EtatVide } from "@/composants/EtatVide";
import { Chargement } from "@/composants/Chargement";
import { cn } from "@/composants/cn";
import { messageDErreur } from "@/etat/messages";
import { FormulaireMere } from "./FormulaireMere";
import { FormulaireEnfant } from "./FormulaireEnfant";
import { FicheMere } from "./FicheMere";

export default function Beneficiaires() {
  const [recherche, setRecherche] = useState("");
  const [choisie, setChoisie] = useState<string | null>(null);
  const [formulaire, setFormulaire] = useState<"mere" | "enfant" | null>(null);

  const { data, isPending, error } = useQuery({
    queryKey: ["meres", recherche],
    queryFn: () => requetes.rechercherMeres(recherche),
  });

  return (
    <Coquille
      titre="Bénéficiaires"
      actions={
        <div className="flex items-center gap-2">
          <Bouton
            variante="secondaire"
            taille="compact"
            onClick={() => setFormulaire("enfant")}
          >
            Nouvel enfant
          </Bouton>
          <Bouton taille="compact" onClick={() => setFormulaire("mere")}>
            Nouvelle mère
          </Bouton>
        </div>
      }
    >
      <DeuxColonnes
        detailVisible={choisie !== null}
        liste={
          <div>
            <div className="sticky top-0 z-10 border-b border-bordure bg-white p-3">
              <Recherche
                valeur={recherche}
                onChanger={setRecherche}
                placeholder="Nom, téléphone ou village"
              />
              {data && (
                <p className="mt-2 text-xs text-texte-faible">
                  {data.count} mère{data.count > 1 ? "s" : ""}
                  {recherche && " trouvée" + (data.count > 1 ? "s" : "")}
                </p>
              )}
            </div>

            {isPending && <Chargement />}

            {error && (
              <p className="px-4 py-6 text-center text-sm text-retard">
                {messageDErreur(error)}
              </p>
            )}

            {data?.results.length === 0 && (
              <EtatVide
                titre={recherche ? "Aucun résultat" : "Aucune mère enregistrée"}
                description={
                  recherche
                    ? "Essayez un autre nom ou un numéro de téléphone."
                    : "Commencez par enregistrer une mère."
                }
                action={
                  !recherche && (
                    <Bouton taille="compact" onClick={() => setFormulaire("mere")}>
                      Nouvelle mère
                    </Bouton>
                  )
                }
              />
            )}

            <ul>
              {data?.results.map((mere) => (
                <li key={mere.id}>
                  <button
                    onClick={() => setChoisie(mere.id)}
                    aria-current={mere.id === choisie ? "true" : undefined}
                    className={cn(
                      "flex w-full flex-col gap-0.5 border-b border-bordure px-3.5 py-2.5 text-left",
                      "transition-colors duration-[120ms]",
                      mere.id === choisie
                        ? "bg-cuivre-clair"
                        : "hover:bg-surface-basse",
                    )}
                  >
                    <span className="text-sm font-semibold text-texte">
                      {mere.nom_complet}
                    </span>
                    <span className="tabulaire text-xs text-texte-faible">
                      {mere.telephone || "Sans téléphone"}
                      {mere.village && (
                        <>
                          <span aria-hidden="true"> · </span>
                          {mere.village}
                        </>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        }
        detail={
          choisie ? (
            <FicheMere id={choisie} onFermer={() => setChoisie(null)} />
          ) : (
            <Accueil />
          )
        }
      />

      <Modal
        ouvert={formulaire === "mere"}
        titre="Enregistrer une mère"
        onFermer={() => setFormulaire(null)}
      >
        {formulaire === "mere" && (
          <FormulaireMere
            onTermine={(id) => {
              setFormulaire(null);
              setChoisie(id);
            }}
            onAnnuler={() => setFormulaire(null)}
          />
        )}
      </Modal>

      <Modal
        ouvert={formulaire === "enfant"}
        titre="Enregistrer un enfant"
        onFermer={() => setFormulaire(null)}
      >
        {formulaire === "enfant" && (
          <FormulaireEnfant
            onTermine={() => setFormulaire(null)}
            onAnnuler={() => setFormulaire(null)}
          />
        )}
      </Modal>
    </Coquille>
  );
}

function Accueil() {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <p className="max-w-xs text-sm text-texte-faible">
        Recherchez une mère par son nom, son téléphone ou son village, puis
        sélectionnez-la pour voir ses enfants et leur suivi vaccinal.
      </p>
    </div>
  );
}
