import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requetes } from "@/api/requetes";
import { Bouton } from "@/composants/Bouton";
import { Etiquette } from "@/composants/Etiquette";
import { Chargement } from "@/composants/Chargement";
import { Modal } from "@/composants/Modal";
import { erreursParChamp, messageDErreur } from "@/etat/messages";
import { FormulaireEnfant } from "./FormulaireEnfant";
import { FormulaireGrossesse } from "./FormulaireGrossesse";
import { Champ } from "@/composants/Champ";

type Props = {
  id: string;
  onFermer: () => void;
};

export function FicheMere({ id, onFermer }: Props) {
  const [ajoutEnfant, setAjoutEnfant] = useState(false);
  const client = useQueryClient();
  const [ajoutGrossesse, setAjoutGrossesse] = useState(false);

  const { data: grossesses } = useQuery({
    queryKey: ["grossesses-de", id],
    queryFn: () => requetes.grossessesDe(id),
    select: (page) => page.results,
  });

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
              aria-label="Ajouter un enfant"
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
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wide text-texte-faible">
              Grossesses
              <span className="ml-1.5 font-semibold opacity-70">
                {grossesses?.length ?? 0}
              </span>
            </h3>
            <Bouton
              variante="secondaire"
              taille="compact"
              aria-label="Ajouter une grossesse"
              onClick={() => setAjoutGrossesse(true)}
            >
              Ajouter
            </Bouton>
          </div>

          {grossesses && grossesses.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {grossesses.map((grossesse) => (
                <li
                  key={grossesse.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-bordure bg-white px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-texte">
                      Grossesse {grossesse.rang}
                    </span>
                    <span className="tabulaire text-xs text-texte-faible">
                      suivi depuis le {formatDate(grossesse.date_reference)}
                      {grossesse.terme_estime && (
                        <>
                          <span aria-hidden="true"> · </span>
                          terme le {formatDate(grossesse.terme_estime)}
                        </>
                      )}
                    </span>
                  </span>
                  <Etiquette
                    ton={grossesse.statut === "en_cours" ? "accent" : "neutre"}
                  >
                    {libelleStatut(grossesse.statut)}
                  </Etiquette>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-md border border-bordure bg-white px-3 py-2.5 text-sm text-texte-faible">
              Aucune grossesse suivie.
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
        <SectionAcces mere={mere} />
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

      <Modal
        ouvert={ajoutGrossesse}
        titre="Enregistrer une grossesse"
        onFermer={() => setAjoutGrossesse(false)}
      >
        {ajoutGrossesse && (
          <FormulaireGrossesse
            mereId={mere.id}
            mereNom={mere.nom_complet}
            rangSuggere={(grossesses?.length ?? 0) + 1}
            onTermine={() => setAjoutGrossesse(false)}
            onAnnuler={() => setAjoutGrossesse(false)}
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

function libelleStatut(statut: string): string {
  if (statut === "en_cours") return "En cours";
  if (statut === "terminee") return "Terminée";
  return "Interrompue";
}

function SectionAcces({ mere }: { mere: { id: string; a_un_acces?: boolean } }) {
  const [ouvert, setOuvert] = useState(false);
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const client = useQueryClient();

  const ouvrir = useMutation({
    mutationFn: () => requetes.ouvrirAcces(mere.id, identifiant, motDePasse),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["mere", mere.id] });
      setOuvert(false);
    },
  });

  const fermer = useMutation({
    mutationFn: () => requetes.fermerAcces(mere.id),
    onSuccess: () => client.invalidateQueries({ queryKey: ["mere", mere.id] }),
  });

  return (
    <section>
      <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-texte-faible">
        Espace personnel
      </h3>
      <div className="rounded-md border border-bordure bg-white px-3 py-3">
        {mere.a_un_acces ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-texte">
              La mère peut consulter ses carnets et ses messages.
            </p>
            <Bouton
              variante="secondaire"
              taille="compact"
              chargement={fermer.isPending}
              onClick={() => fermer.mutate()}
            >
              Fermer l'accès
            </Bouton>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-texte-faible">
              Aucun accès. La mère ne peut pas consulter ses carnets en ligne.
            </p>
            <Bouton taille="compact" onClick={() => setOuvert(true)}>
              Ouvrir un accès
            </Bouton>
          </div>
        )}
      </div>

      <Modal ouvert={ouvert} titre="Ouvrir un accès" onFermer={() => setOuvert(false)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ouvrir.mutate();
          }}
          className="flex flex-col gap-4"
          noValidate
        >
          <p className="text-sm text-texte-faible">
            Choisissez un identifiant et un mot de passe à transmettre à la mère.
            Notez-les pour elle : elle en aura besoin pour se connecter.
          </p>
          <Champ
            libelle="Identifiant"
            value={identifiant}
            onChange={(e) => setIdentifiant(e.target.value)}
            autoCapitalize="none"
            erreur={erreursParChamp(ouvrir.error).identifiant}
          />
          <Champ
            libelle="Mot de passe"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            aide="Au moins huit caractères."
            erreur={erreursParChamp(ouvrir.error).mot_de_passe}
          />
          <div className="flex justify-end gap-2">
            <Bouton type="button" variante="secondaire" taille="compact" onClick={() => setOuvert(false)}>
              Annuler
            </Bouton>
            <Bouton
              type="submit"
              taille="compact"
              chargement={ouvrir.isPending}
              disabled={!identifiant || motDePasse.length < 8}
            >
              Ouvrir l'accès
            </Bouton>
          </div>
        </form>
      </Modal>
    </section>
  );
}
