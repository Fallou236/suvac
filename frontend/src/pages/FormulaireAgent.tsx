import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requetes } from "@/api/requetes";
import { Bouton } from "@/composants/Bouton";
import { Champ } from "@/composants/Champ";
import { erreursParChamp, messageDErreur } from "@/etat/messages";
import { useAuthentification } from "@/etat/authentification";
import { ChoixRadio } from "./FormulaireMere";

type Props = {
  onTermine: (id: string) => void;
  onAnnuler: () => void;
};

export function FormulaireAgent({ onTermine, onAnnuler }: Props) {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [identifiant, setIdentifiant] = useState("");
  const [telephone, setTelephone] = useState("");
  const [role, setRole] = useState("agent");
  const [motDePasse, setMotDePasse] = useState("");
  const [posteId, setPosteId] = useState("");

  const moi = useAuthentification((e) => e.utilisateur);
  const estAdmin = moi?.role === "admin";
  const client = useQueryClient();

  // L'administrateur choisit le poste ; le superviseur crée dans le sien.
  const { data: postes } = useQuery({
    queryKey: ["postes"],
    queryFn: requetes.postes,
    enabled: estAdmin,
  });

  const mutation = useMutation({
    mutationFn: () =>
      requetes.creerAgent({
        username: identifiant,
        first_name: prenom,
        last_name: nom,
        telephone,
        role,
        mot_de_passe: motDePasse,
        poste_id: estAdmin ? posteId : undefined,
      }),
    onSuccess: (agent) => {
      client.invalidateQueries({ queryKey: ["agents"] });
      onTermine(agent.id);
    },
  });

  const erreurs = erreursParChamp(mutation.error);

  /** Propose un identifiant à partir du nom, que l'agent pourra retenir. */
  function proposerIdentifiant(p: string, n: string) {
    const normaliser = (texte: string) =>
      texte
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z]/g, "");
    if (p && n) setIdentifiant(`${normaliser(p)}.${normaliser(n)}`);
  }

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    mutation.mutate();
  }

  return (
    <form onSubmit={soumettre} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Champ
          libelle="Prénom"
          required
          value={prenom}
          onChange={(e) => setPrenom(e.target.value)}
          onBlur={() => proposerIdentifiant(prenom, nom)}
          erreur={erreurs.first_name}
        />
        <Champ
          libelle="Nom"
          aria-label="Nom de famille"
          required
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          onBlur={() => proposerIdentifiant(prenom, nom)}
          erreur={erreurs.last_name}
        />
      </div>

      <Champ
        libelle="Identifiant de connexion"
        required
        autoCapitalize="none"
        value={identifiant}
        onChange={(e) => setIdentifiant(e.target.value)}
        aide="C'est ce que la personne saisira pour se connecter."
        erreur={erreurs.username}
      />

      <Champ
        libelle="Téléphone"
        type="tel"
        inputMode="tel"
        value={telephone}
        onChange={(e) => setTelephone(e.target.value)}
        placeholder="Facultatif"
        erreur={erreurs.telephone}
      />

      <ChoixRadio
        libelle="Rôle"
        valeur={role}
        onChanger={setRole}
        options={[
          { valeur: "agent", libelle: "Agent de santé" },
          { valeur: "superviseur", libelle: "Superviseur" },
        ]}
      />

      {estAdmin && postes && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-semibold text-texte">
            Poste de rattachement
          </legend>
          <select
            value={posteId}
            onChange={(e) => setPosteId(e.target.value)}
            className="min-h-tactile rounded-md border border-bordure bg-white px-3 text-base text-texte focus:border-cuivre"
          >
            <option value="">Choisir un poste</option>
            {postes.results.map((poste) => (
              <option key={poste.id} value={poste.id}>
                {poste.nom}
              </option>
            ))}
          </select>
        </fieldset>
      )}

      <Champ
        libelle="Mot de passe initial"
        required
        value={motDePasse}
        onChange={(e) => setMotDePasse(e.target.value)}
        aide="Notez-le pour le transmettre. La personne devra le changer à sa première connexion."
        erreur={erreurs.mot_de_passe}
      />

      {mutation.isError && Object.keys(erreurs).length === 0 && (
        <p role="alert" className="rounded-md bg-retard-fond px-3 py-2 text-sm text-retard">
          {messageDErreur(mutation.error)}
        </p>
      )}

      <div className="mt-1 flex justify-end gap-2">
        <Bouton
          type="button"
          variante="secondaire"
          taille="compact"
          onClick={onAnnuler}
          disabled={mutation.isPending}
        >
          Annuler
        </Bouton>
        <Bouton
          type="submit"
          taille="compact"
          chargement={mutation.isPending}
          disabled={
            !prenom || !nom || !identifiant || motDePasse.length < 8 ||
            (estAdmin && !posteId)
          }
        >
          Créer le compte
        </Bouton>
      </div>
    </form>
  );
}
