import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bouton } from "@/composants/Bouton";
import { Champ } from "@/composants/Champ";
import { useAuthentification } from "@/etat/authentification";
import { messageDErreur } from "@/etat/messages";

export default function Connexion() {
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const connexion = useAuthentification((e) => e.connexion);
  const naviguer = useNavigate();
  const emplacement = useLocation();

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    setErreur(null);
    setEnCours(true);

    try {
      await connexion(identifiant, motDePasse);
      const destination =
        (emplacement.state as { depuis?: string } | null)?.depuis ?? "/";
      naviguer(destination, { replace: true });
    } catch (e) {
      setErreur(messageDErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-baobab px-4 py-10">
      <div className="w-full max-w-sm">
        <Marque />

        <form
          onSubmit={soumettre}
          className="mt-8 flex flex-col gap-5 rounded-lg bg-white p-6 shadow-lg"
          noValidate
        >
          <div>
            <h1 className="text-xl font-bold text-texte">Connexion</h1>
            <p className="mt-1 text-sm text-texte-faible">
              Accès réservé au personnel du poste de santé.
            </p>
          </div>

          <Champ
            libelle="Identifiant"
            name="identifiant"
            autoComplete="username"
            autoCapitalize="none"
            required
            value={identifiant}
            onChange={(e) => setIdentifiant(e.target.value)}
          />

          <Champ
            libelle="Mot de passe"
            name="motDePasse"
            type="password"
            autoComplete="current-password"
            required
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
          />

          {erreur && (
            <p
              role="alert"
              className="rounded-md bg-retard-fond px-3 py-2 text-sm font-medium text-retard"
            >
              {erreur}
            </p>
          )}

          <Bouton
            type="submit"
            chargement={enCours}
            disabled={!identifiant || !motDePasse}
          >
            Se connecter
          </Bouton>
        </form>
      </div>
    </div>
  );
}

function Marque() {
  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 48 48" className="size-12" aria-hidden="true">
        <g transform="translate(1.5,1.5)">
          <rect width="20" height="20" rx="5" fill="#fff" />
          <rect x="25" width="20" height="20" rx="5" fill="#fff" />
          <rect y="25" width="20" height="20" rx="5" fill="#fff" />
          <rect
            x="26.5"
            y="26.5"
            width="17"
            height="17"
            rx="3.8"
            fill="none"
            stroke="#D9924F"
            strokeWidth="3"
          />
        </g>
      </svg>
      <p className="text-2xl font-bold tracking-wide text-white">SUVAC</p>
    </div>
  );
}
