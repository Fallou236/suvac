import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { requetes } from "@/api/requetes";
import { Coquille } from "@/composants/Coquille";
import { Bouton } from "@/composants/Bouton";
import { Champ } from "@/composants/Champ";
import { Etiquette } from "@/composants/Etiquette";
import { useAuthentification } from "@/etat/authentification";
import { definirJetons } from "@/api/client";
import { erreursParChamp, messageDErreur } from "@/etat/messages";


export default function Parametres() {
  const utilisateur = useAuthentification((e) => e.utilisateur);

  return (
    <Coquille titre="Paramètres">
      <div className="defilement h-full overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 p-5">
          <Identite />
          <MotDePasse />
          <Apropos role={utilisateur?.role} />
        </div>
      </div>
    </Coquille>
  );
}

/* ---------------------------------------------------------------- */

function Section({
  titre,
  description,
  children,
}: {
  titre: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-bordure bg-white p-5">
      <h2 className="text-base font-bold text-texte">{titre}</h2>
      {description && (
        <p className="mt-1 text-sm text-texte-faible">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Identite() {
  const utilisateur = useAuthentification((e) => e.utilisateur);
  const definirUtilisateur = useAuthentification((e) => e.definirUtilisateur);
  const { i18n } = useTranslation();

  const [prenom, setPrenom] = useState(utilisateur?.first_name ?? "");
  const [nom, setNom] = useState(utilisateur?.last_name ?? "");
  const [telephone, setTelephone] = useState(utilisateur?.telephone ?? "");
  const [langue, setLangue] = useState(utilisateur?.langue ?? "fr");
  const [enregistre, setEnregistre] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      requetes.modifierProfil({
        first_name: prenom,
        last_name: nom,
        telephone,
        langue,
      }),
    onSuccess: (profil) => {
      setEnregistre(true);
      definirUtilisateur(profil);
      if (profil.langue !== i18n.resolvedLanguage) {
        i18n.changeLanguage(profil.langue);
      }
      setTimeout(() => setEnregistre(false), 3000);
    },
  });

  const erreurs = erreursParChamp(mutation.error);

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    mutation.mutate();
  }

  return (
    <Section
      titre="Mon profil"
      description="Ces informations apparaissent dans le journal des actes que vous enregistrez."
    >
      <form onSubmit={soumettre} className="flex flex-col gap-4" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ
            libelle="Prénom"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            erreur={erreurs.first_name}
          />
          <Champ
            libelle="Nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            erreur={erreurs.last_name}
          />
        </div>

        <Champ
          libelle="Téléphone"
          type="tel"
          inputMode="tel"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          placeholder="+221 77 123 45 67"
          erreur={erreurs.telephone}
        />

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-semibold text-texte">
            Langue de l'interface
          </legend>
          <div className="flex gap-1.5">
            {(
              [
                { valeur: "fr", libelle: "Français" },
                { valeur: "wo", libelle: "Wolof" },
              ] as const
            ).map((option) => (
              <label
                key={option.valeur}
                className={`min-h-[38px] cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition-colors duration-[120ms] ${
                  langue === option.valeur
                    ? "border-cuivre bg-cuivre-clair text-cuivre"
                    : "border-bordure bg-white text-texte hover:bg-surface-basse"
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  checked={langue === option.valeur}
                  onChange={() => setLangue(option.valeur)}
                />
                {option.libelle}
              </label>
            ))}
          </div>
        </fieldset>

        {mutation.isError && Object.keys(erreurs).length === 0 && (
          <p role="alert" className="rounded-md bg-retard-fond px-3 py-2 text-sm text-retard">
            {messageDErreur(mutation.error)}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          {enregistre && (
            <span role="status" className="text-sm font-medium text-baobab">
              Modifications enregistrées
            </span>
          )}
          <Bouton
            type="submit"
            taille="compact"
            aria-label="Enregistrer le profil"
            chargement={mutation.isPending}
          >
            Enregistrer
          </Bouton>
        </div>
      </form>
    </Section>
  );
}

function MotDePasse() {
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [succes, setSucces] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      requetes.changerMotDePasse({
        ancien_mot_de_passe: ancien,
        nouveau_mot_de_passe: nouveau,
      }),
    onSuccess: (jetons) => {
      definirJetons(jetons.access, jetons.refresh);
      setAncien("");
      setNouveau("");
      setConfirmation("");
      setSucces(true);
      setTimeout(() => setSucces(false), 5000);
    },
  });

  const erreurs = erreursParChamp(mutation.error);
  const discordance = confirmation !== "" && nouveau !== confirmation;

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    if (!discordance) mutation.mutate();
  }

  return (
    <Section
      titre="Mot de passe"
      description="Choisissez un mot de passe d'au moins dix caractères, sans rapport avec votre identifiant."
    >
      <form onSubmit={soumettre} className="flex flex-col gap-4" noValidate>
        <Champ
          libelle="Mot de passe actuel"
          type="password"
          autoComplete="current-password"
          required
          value={ancien}
          onChange={(e) => setAncien(e.target.value)}
          erreur={erreurs.ancien_mot_de_passe}
        />

        <Champ
          libelle="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          required
          value={nouveau}
          onChange={(e) => setNouveau(e.target.value)}
          erreur={erreurs.nouveau_mot_de_passe}
        />

        <Champ
          libelle="Confirmation"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          erreur={discordance ? "Les deux saisies diffèrent." : undefined}
        />

        {mutation.isError && Object.keys(erreurs).length === 0 && (
          <p role="alert" className="rounded-md bg-retard-fond px-3 py-2 text-sm text-retard">
            {messageDErreur(mutation.error)}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          {succes && (
            <span role="status" className="text-sm font-medium text-baobab">
              Mot de passe modifié
            </span>
          )}
          <Bouton
            type="submit"
            taille="compact"
            chargement={mutation.isPending}
            disabled={!ancien || !nouveau || discordance}
          >
            Modifier
          </Bouton>
        </div>
      </form>
    </Section>
  );
}

const ROLES: Record<string, string> = {
  agent: "Agent de santé",
  superviseur: "Superviseur de district",
  admin: "Administrateur",
  mere: "Bénéficiaire",
};

function Apropos({ role }: { role?: string }) {
  const utilisateur = useAuthentification((e) => e.utilisateur);

  return (
    <Section titre="Mon compte">
      <dl className="flex flex-col gap-2.5 text-sm">
        <Ligne cle="Identifiant">
          <span className="tabulaire">{utilisateur?.username}</span>
        </Ligne>
        <Ligne cle="Rôle">
          <Etiquette ton="accent">{ROLES[role ?? ""] ?? role}</Etiquette>
        </Ligne>
        <Ligne cle="Poste de rattachement">
          {utilisateur?.poste?.nom ?? "Aucun"}
        </Ligne>
        {utilisateur?.poste && (
          <Ligne cle="District">
            {utilisateur.poste.district}, {utilisateur.poste.region}
          </Ligne>
        )}
      </dl>
    </Section>
  );
}

function Ligne({ cle, children }: { cle: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-bordure pb-2.5 last:border-0 last:pb-0">
      <dt className="text-texte-faible">{cle}</dt>
      <dd className="font-medium text-texte">{children}</dd>
    </div>
  );
}
