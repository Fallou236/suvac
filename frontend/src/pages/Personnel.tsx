import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { requetes, type Agent } from "@/api/requetes";
import { Coquille } from "@/composants/Coquille";
import { DeuxColonnes } from "@/composants/DeuxColonnes";
import { Recherche } from "@/composants/Recherche";
import { Bouton } from "@/composants/Bouton";
import { Modal } from "@/composants/Modal";
import { EtatVide } from "@/composants/EtatVide";
import { Chargement } from "@/composants/Chargement";
import { cn } from "@/composants/cn";
import { messageDErreur } from "@/etat/messages";
import { useAuthentification } from "@/etat/authentification";
import { FormulaireAgent } from "./FormulaireAgent";
import { FicheAgent } from "./FicheAgent";

export default function Personnel() {
  const [recherche, setRecherche] = useState("");
  const [choisi, setChoisi] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);

  const moi = useAuthentification((e) => e.utilisateur);

  const { data, isPending, error } = useQuery({
    queryKey: ["agents"],
    queryFn: () => requetes.agents(),
  });

  const filtres = (data?.results ?? []).filter((agent) =>
    `${agent.nom_complet} ${agent.username}`
      .toLowerCase()
      .includes(recherche.toLowerCase()),
  );

  const actif = filtres.find((a) => a.id === choisi) ?? null;
  const inactifs = filtres.filter((a) => !a.is_active).length;

  return (
    <Coquille
      titre="Personnel"
      actions={
        <Bouton taille="compact" onClick={() => setCreation(true)}>
          Nouveau compte
        </Bouton>
      }
    >
      {isPending ? (
        <Chargement />
      ) : error ? (
        <p className="px-6 py-16 text-center text-retard">
          {messageDErreur(error)}
        </p>
      ) : (
        <DeuxColonnes
          detailVisible={actif !== null}
          liste={
            <div>
              <div className="sticky top-0 z-10 border-b border-bordure bg-white p-3">
                <Recherche
                  valeur={recherche}
                  onChanger={setRecherche}
                  placeholder="Nom ou identifiant"
                />
                <p className="mt-2 text-xs text-texte-faible">
                  {filtres.length} compte{filtres.length > 1 ? "s" : ""}
                  {inactifs > 0 && (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span className="text-texte-faible">
                        {inactifs} désactivé{inactifs > 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                </p>
              </div>

              {filtres.length === 0 ? (
                <EtatVide
                  titre="Aucun compte"
                  description={
                    recherche
                      ? "Aucun compte ne correspond à cette recherche."
                      : "Créez le premier compte de votre poste."
                  }
                />
              ) : (
                <ul>
                  {filtres.map((agent) => (
                    <li key={agent.id}>
                      <Ligne
                        agent={agent}
                        estMoi={agent.username === moi?.username}
                        actif={agent.id === choisi}
                        onChoisir={() => setChoisi(agent.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          }
          detail={
            actif ? (
              <FicheAgent
                agent={actif}
                estMoi={actif.username === moi?.username}
                onFermer={() => setChoisi(null)}
              />
            ) : (
              <Accueil nombre={filtres.length} />
            )
          }
        />
      )}

      <Modal
        ouvert={creation}
        titre="Nouveau compte"
        onFermer={() => setCreation(false)}
      >
        {creation && (
          <FormulaireAgent
            onTermine={(id) => {
              setCreation(false);
              setChoisi(id);
            }}
            onAnnuler={() => setCreation(false)}
          />
        )}
      </Modal>
    </Coquille>
  );
}

/* ---------------------------------------------------------------- */

function Ligne({
  agent,
  estMoi,
  actif,
  onChoisir,
}: {
  agent: Agent;
  estMoi: boolean;
  actif: boolean;
  onChoisir: () => void;
}) {
  return (
    <button
      onClick={onChoisir}
      aria-current={actif ? "true" : undefined}
      className={cn(
        "flex w-full items-start gap-3 border-b border-bordure px-3.5 py-2.5 text-left",
        "transition-colors duration-[120ms]",
        actif ? "bg-cuivre-clair" : "hover:bg-surface-basse",
        !agent.is_active && "opacity-60",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          agent.is_active ? "bg-baobab" : "bg-annule",
        )}
      />

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-texte">
            {agent.nom_complet}
          </span>
          {estMoi && (
            <span className="shrink-0 text-[11px] font-medium text-texte-faible">
              vous
            </span>
          )}
        </span>
        <span className="tabulaire mt-0.5 block truncate text-xs text-texte-faible">
          {agent.username}
          <span aria-hidden="true"> · </span>
          {agent.role_libelle}
          {agent.doit_changer_mot_de_passe && (
            <span className="ml-1.5 font-medium text-cuivre">
              mot de passe à changer
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function Accueil({ nombre }: { nombre: number }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div className="max-w-sm">
        <p className="tabulaire text-4xl font-bold text-baobab">{nombre}</p>
        <p className="mt-1 text-sm font-medium text-texte">
          compte{nombre > 1 ? "s" : ""} dans votre poste
        </p>
        <p className="mt-4 text-sm text-texte-faible">
          Sélectionnez un compte pour réinitialiser son mot de passe, le
          transférer vers un autre poste ou le désactiver.
        </p>
      </div>
    </div>
  );
}
