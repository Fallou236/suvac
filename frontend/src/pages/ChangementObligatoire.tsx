import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { requetes } from "@/api/requetes";
import { Logo } from "@/composants/Logo";
import { Bouton } from "@/composants/Bouton";
import { Champ } from "@/composants/Champ";
import { useAuthentification } from "@/etat/authentification";
import { definirJetons } from "@/api/client";
import { erreursParChamp, messageDErreur } from "@/etat/messages";
import { Navigate, useNavigate } from "react-router-dom";
import { accueilPour } from "@/etat/navigation";

/**
 * Écran imposé à la première connexion et après une réinitialisation.
 *
 * Il n'y a pas d'issue : ni navigation, ni bouton pour reporter. Un mot de
 * passe transmis par un tiers n'est pas un secret, et l'API refuse de toute
 * façon tout le reste tant qu'il n'est pas changé.
 */
export default function ChangementObligatoire() {
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const connecte = useAuthentification((e) => e.connecte);
  const utilisateur = useAuthentification((e) => e.utilisateur);
  const definirUtilisateur = useAuthentification((e) => e.definirUtilisateur);
  const deconnexion = useAuthentification((e) => e.deconnexion);
  const naviguer = useNavigate();

  const mutation = useMutation({
    mutationFn: () =>
      requetes.changerMotDePasse({
        ancien_mot_de_passe: ancien,
        nouveau_mot_de_passe: nouveau,
      }),
    onSuccess: (jetons) => {
      definirJetons(jetons.access, jetons.refresh);
      if (utilisateur) {
        definirUtilisateur({ ...utilisateur, doit_changer_mot_de_passe: false });
      }
      naviguer(accueilPour(utilisateur?.role), { replace: true });
    },
  });

  const erreurs = erreursParChamp(mutation.error);
  const discordance = confirmation !== "" && nouveau !== confirmation;
  const tropCourt = nouveau !== "" && nouveau.length < 10;

  if (!connecte) return <Navigate to="/connexion" replace />;

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    if (!discordance && !tropCourt) mutation.mutate();
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-baobab px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3">
          <Logo taille={44} />
          <p className="text-2xl font-bold tracking-wide text-white">SUVAC</p>
        </div>

        <form
          onSubmit={soumettre}
          className="mt-8 flex flex-col gap-5 rounded-lg bg-white p-6 shadow-lg"
          noValidate
        >
          <div>
            <h1 className="text-xl font-bold text-texte">
              Choisissez votre mot de passe
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-texte-faible">
              Le mot de passe qui vous a été remis est connu d'une autre
              personne. Choisissez-en un que vous seul connaîtrez avant
              d'accéder à l'application.
            </p>
          </div>

          <Champ
            libelle="Mot de passe reçu"
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
            aide="Au moins dix caractères, sans rapport avec votre identifiant."
            erreur={
              tropCourt
                ? "Au moins dix caractères."
                : erreurs.nouveau_mot_de_passe
            }
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
            <p
              role="alert"
              className="rounded-md bg-retard-fond px-3 py-2 text-sm font-medium text-retard"
            >
              {messageDErreur(mutation.error)}
            </p>
          )}

          <Bouton
            type="submit"
            chargement={mutation.isPending}
            disabled={!ancien || !nouveau || discordance || tropCourt}
          >
            Enregistrer et continuer
          </Bouton>

          <button
            type="button"
            onClick={deconnexion}
            className="self-center text-sm text-texte-faible underline-offset-2 hover:underline"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  );
}
