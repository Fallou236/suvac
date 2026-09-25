import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requetes, type Agent } from "@/api/requetes";
import { Bouton } from "@/composants/Bouton";
import { Champ } from "@/composants/Champ";
import { Modal } from "@/composants/Modal";
import { Etiquette } from "@/composants/Etiquette";
import { cn } from "@/composants/cn";
import { erreursParChamp, messageDErreur } from "@/etat/messages";

type Props = {
  agent: Agent;
  estMoi: boolean;
  onFermer: () => void;
};

export function FicheAgent({ agent, estMoi, onFermer }: Props) {
  const [action, setAction] = useState<"reinitialiser" | "transferer" | null>(
    null,
  );
  const client = useQueryClient();

  const activation = useMutation({
    mutationFn: () => requetes.basculerActivation(agent.id),
    onSuccess: () => client.invalidateQueries({ queryKey: ["agents"] }),
  });

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6 p-5 lg:p-8">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-bold text-texte">
              {agent.nom_complet}
            </h2>
            <Etiquette ton={agent.role === "superviseur" ? "accent" : "neutre"}>
              {agent.role_libelle}
            </Etiquette>
            {!agent.is_active && <Etiquette ton="alerte">Désactivé</Etiquette>}
          </div>
          <p className="tabulaire mt-1 text-sm text-texte-faible">
            {agent.username}
            {agent.telephone && (
              <>
                <span aria-hidden="true"> · </span>
                <a
                  href={`tel:${agent.telephone}`}
                  className="font-medium text-cuivre underline-offset-2 hover:underline"
                >
                  {agent.telephone}
                </a>
              </>
            )}
          </p>
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
      </header>

      {agent.doit_changer_mot_de_passe && (
        <p className="rounded-md border border-cuivre/25 bg-cuivre-clair px-4 py-3 text-sm text-texte">
          Cette personne n'a pas encore choisi son mot de passe. Elle ne peut
          rien faire dans l'application tant qu'elle ne l'a pas fait.
        </p>
      )}

      <section>
        <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-texte-faible">
          Compte
        </h3>
        <dl className="flex flex-col gap-2.5 rounded-lg border border-bordure bg-white px-4 py-3 text-sm">
          <Ligne cle="Poste">{agent.poste?.nom ?? "Aucun"}</Ligne>
          {agent.poste && (
            <Ligne cle="District">
              {agent.poste.district}, {agent.poste.region}
            </Ligne>
          )}
          <Ligne cle="Créé le">{formatDate(agent.date_joined)}</Ligne>
          <Ligne cle="Dernière connexion">
            {agent.derniere_connexion
              ? formatHorodatage(agent.derniere_connexion)
              : "Jamais connecté"}
          </Ligne>
        </dl>
      </section>

      {estMoi ? (
        <p className="rounded-md border border-bordure bg-surface-basse px-4 py-3 text-sm text-texte-faible">
          C'est votre propre compte. Vous ne pouvez ni le désactiver, ni
          réinitialiser son mot de passe — un poste sans superviseur actif ne
          pourrait plus créer de comptes. Passez par vos paramètres pour
          changer votre mot de passe.
        </p>
      ) : (
        <section>
          <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-texte-faible">
            Actions
          </h3>
          <div className="flex flex-col gap-2">
            <ActionCarte
              titre="Réinitialiser le mot de passe"
              description="À faire si la personne a oublié son mot de passe. Elle devra en choisir un nouveau à sa prochaine connexion."
              bouton="Réinitialiser"
              onCliquer={() => setAction("reinitialiser")}
            />

            <ActionCarte
              titre="Transférer vers un autre poste"
              description="Les actes déjà enregistrés restent rattachés à cette personne."
              bouton="Transférer"
              onCliquer={() => setAction("transferer")}
            />

            <ActionCarte
              titre={agent.is_active ? "Désactiver le compte" : "Réactiver le compte"}
              description={
                agent.is_active
                  ? "La personne ne pourra plus se connecter. Son compte et son historique sont conservés."
                  : "La personne pourra de nouveau se connecter avec ses identifiants."
              }
              bouton={agent.is_active ? "Désactiver" : "Réactiver"}
              danger={agent.is_active}
              chargement={activation.isPending}
              onCliquer={() => activation.mutate()}
            />
          </div>

          {activation.isError && (
            <p role="alert" className="mt-2 text-sm text-retard">
              {messageDErreur(activation.error)}
            </p>
          )}
        </section>
      )}

      <Modal
        ouvert={action === "reinitialiser"}
        titre="Réinitialiser le mot de passe"
        onFermer={() => setAction(null)}
      >
        {action === "reinitialiser" && (
          <FormulaireReinitialisation
            agent={agent}
            onTermine={() => setAction(null)}
            onAnnuler={() => setAction(null)}
          />
        )}
      </Modal>

      <Modal
        ouvert={action === "transferer"}
        titre="Transférer vers un autre poste"
        onFermer={() => setAction(null)}
      >
        {action === "transferer" && (
          <FormulaireTransfert
            agent={agent}
            onTermine={() => setAction(null)}
            onAnnuler={() => setAction(null)}
          />
        )}
      </Modal>
    </article>
  );
}

/* ---------------------------------------------------------------- */

function ActionCarte({
  titre,
  description,
  bouton,
  danger,
  chargement,
  onCliquer,
}: {
  titre: string;
  description: string;
  bouton: string;
  danger?: boolean;
  chargement?: boolean;
  onCliquer: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 rounded-lg border px-4 py-3",
        danger ? "border-retard/25 bg-retard-fond" : "border-bordure bg-white",
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-texte">{titre}</p>
        <p className="mt-0.5 text-sm text-texte-faible">{description}</p>
      </div>
      <Bouton
        variante={danger ? "danger" : "secondaire"}
        taille="compact"
        chargement={chargement}
        onClick={onCliquer}
      >
        {bouton}
      </Bouton>
    </div>
  );
}

function FormulaireReinitialisation({
  agent,
  onTermine,
  onAnnuler,
}: {
  agent: Agent;
  onTermine: () => void;
  onAnnuler: () => void;
}) {
  const [motDePasse, setMotDePasse] = useState("");
  const client = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => requetes.reinitialiserAgent(agent.id, motDePasse),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["agents"] });
      onTermine();
    },
  });

  const erreurs = erreursParChamp(mutation.error);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      <p className="text-sm text-texte-faible">
        Choisissez un mot de passe provisoire pour {agent.nom_complet} et
        notez-le pour le lui transmettre. Ses sessions ouvertes seront fermées,
        et il devra en choisir un nouveau à sa prochaine connexion.
      </p>

      <Champ
        libelle="Mot de passe provisoire"
        required
        value={motDePasse}
        onChange={(e) => setMotDePasse(e.target.value)}
        aide="Au moins huit caractères."
        erreur={erreurs.mot_de_passe}
      />

      {mutation.isError && Object.keys(erreurs).length === 0 && (
        <p role="alert" className="rounded-md bg-retard-fond px-3 py-2 text-sm text-retard">
          {messageDErreur(mutation.error)}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Bouton type="button" variante="secondaire" taille="compact" onClick={onAnnuler}>
          Annuler
        </Bouton>
        <Bouton
          type="submit"
          taille="compact"
          chargement={mutation.isPending}
          disabled={motDePasse.length < 8}
        >
          Réinitialiser
        </Bouton>
      </div>
    </form>
  );
}

function FormulaireTransfert({
  agent,
  onTermine,
  onAnnuler,
}: {
  agent: Agent;
  onTermine: () => void;
  onAnnuler: () => void;
}) {
  const [posteId, setPosteId] = useState("");
  const client = useQueryClient();

  const { data: postes } = useQuery({
    queryKey: ["postes"],
    queryFn: requetes.postes,
  });

  const mutation = useMutation({
    mutationFn: () => requetes.transfererAgent(agent.id, posteId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["agents"] });
      onTermine();
    },
  });

  const autres = (postes?.results ?? []).filter((p) => p.id !== agent.poste?.id);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      <p className="text-sm text-texte-faible">
        {agent.nom_complet} ne verra plus les bénéficiaires de{" "}
        {agent.poste?.nom ?? "son poste actuel"}, mais les actes qu'il y a
        enregistrés lui restent rattachés.
      </p>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-semibold text-texte">
          Nouveau poste
        </legend>
        <select
          value={posteId}
          onChange={(e) => setPosteId(e.target.value)}
          className="min-h-tactile rounded-md border border-bordure bg-white px-3 text-base text-texte focus:border-cuivre"
        >
          <option value="">Choisir un poste</option>
          {autres.map((poste) => (
            <option key={poste.id} value={poste.id}>
              {poste.nom} — {poste.district}
            </option>
          ))}
        </select>
      </fieldset>

      {mutation.isError && (
        <p role="alert" className="rounded-md bg-retard-fond px-3 py-2 text-sm text-retard">
          {messageDErreur(mutation.error)}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Bouton type="button" variante="secondaire" taille="compact" onClick={onAnnuler}>
          Annuler
        </Bouton>
        <Bouton
          type="submit"
          taille="compact"
          chargement={mutation.isPending}
          disabled={!posteId}
        >
          Transférer
        </Bouton>
      </div>
    </form>
  );
}

function Ligne({ cle, children }: { cle: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-bordure pb-2.5 last:border-0 last:pb-0">
      <dt className="text-texte-faible">{cle}</dt>
      <dd className="text-right font-medium text-texte">{children}</dd>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatHorodatage(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
