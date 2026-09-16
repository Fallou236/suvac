import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { requetes } from "@/api/requetes";
import { Bouton } from "@/composants/Bouton";
import { Etiquette } from "@/composants/Etiquette";
import { Chargement } from "@/composants/Chargement";
import { Modal } from "@/composants/Modal";
import { messageDErreur } from "@/etat/messages";
import { FormulaireEnfant } from "./FormulaireEnfant";

type Props = {
  id: string;
  onFermer: () => void;
};

export function FicheMere({ id, onFermer }: Props) {
  const [ajoutEnfant, setAjoutEnfant] = useState(false);
  const client = useQueryClient();

  const { data: mere, isPending, error } = useQuery({
    queryKey: ["mere", id],
    queryFn: () => requetes.mere(id),
  });

  const { data: enfants } = useQuery({
    queryKey: ["enfants-de", id],
    queryFn: () => requetes.rechercherEnfants("", id),
    select: (page) => page.results,
  });

  if (isPending) return <Chargement />;

  if (error) {
    return (
      <p className="px-6 py-10 text-center text-sm text-retard">
        {messageDErreur(error)}
      </p>
    );
  }

  const consentement = mere.consentements?.find((c) => c.actif);

  return (
    <div className="flex flex-col">
      <div className="border-b border-bordure bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-bold text-texte">
                {mere.nom_complet}
              </h2>
              {mere.accepte_les_rappels ? (
                <Etiquette ton="succes">Rappels acceptés</Etiquette>
              ) : (
                <Etiquette>Sans rappel</Etiquette>
              )}
            </div>

            <p className="tabulaire mt-1 text-sm text-texte-faible">
              {mere.telephone ? (
                <a
                  href={`tel:${mere.telephone}`}
                  className="font-semibold text-cuivre underline-offset-2 hover:underline"
                >
                  {mere.telephone}
                </a>
              ) : (
                "Sans téléphone"
              )}
              {mere.village && (
                <>
                  <span aria-hidden="true"> · </span>
                  {mere.village}
                </>
              )}
              <span aria-hidden="true"> · </span>
              {mere.langue === "wo" ? "Wolof" : "Français"}
            </p>
          </div>

          <button
            onClick={onFermer}
            aria-label="Fermer la fiche"
            className="grid size-9 shrink-0 place-items-center rounded-md text-texte-faible transition-colors duration-[120ms] hover:bg-surface-basse lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex max-w-3xl flex-col gap-6 p-5">
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wide text-texte-faible">
              Enfants
              <span className="ml-1.5 font-semibold opacity-70">
                {enfants?.length ?? 0}
              </span>
            </h3>
            <Bouton
              variante="secondaire"
              taille="compact"
              onClick={() => setAjoutEnfant(true)}
            >
              Ajouter
            </Bouton>
          </div>

          {enfants && enfants.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {enfants.map((enfant) => (
                <li
                  key={enfant.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-bordure bg-white px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-texte">
                      {enfant.nom_complet}
                    </span>
                    <span className="tabulaire text-xs text-texte-faible">
                      né{enfant.sexe === "F" ? "e" : ""} le{" "}
                      {formatDate(enfant.date_naissance)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-md border border-bordure bg-white px-3 py-2.5 text-sm text-texte-faible">
              Aucun enfant enregistré pour cette mère.
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-texte-faible">
            Consentement
          </h3>
          <div className="rounded-md border border-bordure bg-white px-3 py-2.5">
            {consentement ? (
              <p className="text-sm text-texte">
                {libelleCanal(consentement.canal)}
                <span className="ml-1.5 text-texte-faible">
                  depuis le {formatDate(consentement.accorde_le)}
                </span>
              </p>
            ) : (
              <p className="text-sm text-texte-faible">
                Aucun consentement actif. Aucun rappel ne sera envoyé.
              </p>
            )}

            {mere.consentements && mere.consentements.length > 1 && (
              <p className="mt-1.5 text-xs text-texte-faible">
                {mere.consentements.length} entrées dans l'historique.
              </p>
            )}
          </div>
        </section>
      </div>

      <Modal
        ouvert={ajoutEnfant}
        titre="Enregistrer un enfant"
        onFermer={() => setAjoutEnfant(false)}
      >
        {ajoutEnfant && (
          <FormulaireEnfant
            mereId={mere.id}
            mereNom={mere.nom_complet}
            onTermine={() => {
              setAjoutEnfant(false);
              client.invalidateQueries({ queryKey: ["enfants-de", id] });
            }}
            onAnnuler={() => setAjoutEnfant(false)}
          />
        )}
      </Modal>
    </div>
  );
}

function libelleCanal(canal: string): string {
  if (canal === "whatsapp") return "Rappels par WhatsApp";
  if (canal === "sms") return "Rappels par SMS";
  return "Consultation dans l'application uniquement";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
