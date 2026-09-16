import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requetes } from "@/api/requetes";
import { Bouton } from "@/composants/Bouton";
import { Champ } from "@/composants/Champ";
import { Recherche } from "@/composants/Recherche";
import { erreursParChamp, messageDErreur } from "@/etat/messages";
import { ChoixRadio } from "./FormulaireMere";

type Props = {
  /** Pré-sélectionne la mère quand on part de sa fiche. */
  mereId?: string;
  mereNom?: string;
  onTermine: () => void;
  onAnnuler: () => void;
};

const AUJOURDHUI = new Date().toISOString().slice(0, 10);

export function FormulaireEnfant({
  mereId,
  mereNom,
  onTermine,
  onAnnuler,
}: Props) {
  const [mere, setMere] = useState<{ id: string; nom: string } | null>(
    mereId && mereNom ? { id: mereId, nom: mereNom } : null,
  );
  const [recherche, setRecherche] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [naissance, setNaissance] = useState(AUJOURDHUI);
  const [sexe, setSexe] = useState("F");
  const [gestation, setGestation] = useState("");
  const [poids, setPoids] = useState("");

  const client = useQueryClient();

  const { data: meres } = useQuery({
    queryKey: ["meres", recherche],
    queryFn: () => requetes.rechercherMeres(recherche),
    enabled: mere === null && recherche.length > 1,
  });

  const mutation = useMutation({
    mutationFn: () =>
      requetes.creerEnfant({
        mere_id: mere!.id,
        prenom,
        nom,
        date_naissance: naissance,
        sexe,
        semaines_gestation: gestation ? Number(gestation) : null,
        poids_naissance_grammes: poids ? Number(poids) : null,
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["meres"] });
      client.invalidateQueries({ queryKey: ["file-du-jour-complete"] });
      onTermine();
    },
  });

  const erreurs = erreursParChamp(mutation.error);

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    if (mere) mutation.mutate();
  }

  if (!mere) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-texte-faible">
          Sélectionnez d'abord la mère de l'enfant.
        </p>

        <Recherche
          valeur={recherche}
          onChanger={setRecherche}
          placeholder="Nom ou téléphone de la mère"
        />

        {meres && meres.results.length > 0 && (
          <ul className="max-h-56 overflow-y-auto rounded-md border border-bordure">
            {meres.results.map((candidate) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  onClick={() =>
                    setMere({ id: candidate.id, nom: candidate.nom_complet })
                  }
                  className="flex w-full flex-col gap-0.5 border-b border-bordure px-3 py-2 text-left last:border-0 hover:bg-surface-basse"
                >
                  <span className="text-sm font-medium text-texte">
                    {candidate.nom_complet}
                  </span>
                  <span className="tabulaire text-xs text-texte-faible">
                    {candidate.telephone || "Sans téléphone"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {meres && meres.results.length === 0 && recherche.length > 1 && (
          <p className="text-sm text-texte-faible">
            Aucune mère trouvée. Enregistrez-la d'abord.
          </p>
        )}

        <div className="flex justify-end">
          <Bouton variante="secondaire" taille="compact" onClick={onAnnuler}>
            Annuler
          </Bouton>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={soumettre} className="flex flex-col gap-4" noValidate>
      <div className="flex items-center justify-between rounded-md bg-surface-basse px-3 py-2.5">
        <span className="text-sm">
          <span className="text-texte-faible">Mère : </span>
          <span className="font-semibold text-texte">{mere.nom}</span>
        </span>
        {!mereId && (
          <button
            type="button"
            onClick={() => setMere(null)}
            className="text-sm font-medium text-cuivre underline-offset-2 hover:underline"
          >
            Changer
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Champ
          libelle="Prénom"
          value={prenom}
          onChange={(e) => setPrenom(e.target.value)}
          erreur={erreurs.prenom}
          aide="Peut rester vide avant le baptême."
        />
        <Champ
          libelle="Nom"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          erreur={erreurs.nom}
        />
      </div>

      <Champ
        libelle="Date de naissance"
        type="date"
        required
        max={AUJOURDHUI}
        value={naissance}
        onChange={(e) => setNaissance(e.target.value)}
        erreur={erreurs.date_naissance}
        aide="Le calendrier vaccinal sera calculé à partir de cette date."
      />

      <ChoixRadio
        libelle="Sexe"
        valeur={sexe}
        onChanger={setSexe}
        options={[
          { valeur: "F", libelle: "Féminin" },
          { valeur: "M", libelle: "Masculin" },
        ]}
      />

      <div className="grid grid-cols-2 gap-3">
        <Champ
          libelle="Semaines de gestation"
          type="number"
          inputMode="numeric"
          min={20}
          max={45}
          value={gestation}
          onChange={(e) => setGestation(e.target.value)}
          placeholder="Facultatif"
          erreur={erreurs.semaines_gestation}
        />
        <Champ
          libelle="Poids de naissance (g)"
          type="number"
          inputMode="numeric"
          min={300}
          max={7000}
          value={poids}
          onChange={(e) => setPoids(e.target.value)}
          placeholder="Facultatif"
          erreur={erreurs.poids_naissance_grammes}
        />
      </div>

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
        <Bouton type="submit" taille="compact" chargement={mutation.isPending}>
          Enregistrer
        </Bouton>
      </div>
    </form>
  );
}
