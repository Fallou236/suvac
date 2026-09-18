import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { requetes } from "@/api/requetes";
import { Bouton } from "@/composants/Bouton";
import { Champ } from "@/composants/Champ";
import { erreursParChamp, messageDErreur } from "@/etat/messages";

type Props = {
  mereId: string;
  mereNom: string;
  /** Rang suggéré : nombre de grossesses déjà enregistrées, plus une. */
  rangSuggere: number;
  onTermine: () => void;
  onAnnuler: () => void;
};

const AUJOURDHUI = new Date().toISOString().slice(0, 10);

/** Terme estimé par défaut : environ sept mois après le premier contact. */
function termePropose(reference: string): string {
  const date = new Date(reference);
  date.setDate(date.getDate() + 210);
  return date.toISOString().slice(0, 10);
}

export function FormulaireGrossesse({
  mereId,
  mereNom,
  rangSuggere,
  onTermine,
  onAnnuler,
}: Props) {
  const [reference, setReference] = useState(AUJOURDHUI);
  const [terme, setTerme] = useState(termePropose(AUJOURDHUI));
  const [rang, setRang] = useState(String(rangSuggere));

  const client = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      requetes.creerGrossesse({
        mere_id: mereId,
        rang: Number(rang),
        date_reference: reference,
        terme_estime: terme || null,
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["grossesses-de", mereId] });
      client.invalidateQueries({ queryKey: ["file-du-jour-complete"] });
      onTermine();
    },
  });

  const erreurs = erreursParChamp(mutation.error);

  function changerReference(valeur: string) {
    setReference(valeur);
    // Le terme suit la date de référence tant que l'agent ne l'a pas figé.
    if (terme === termePropose(reference)) setTerme(termePropose(valeur));
  }

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    mutation.mutate();
  }

  return (
    <form onSubmit={soumettre} className="flex flex-col gap-4" noValidate>
      <div className="rounded-md bg-surface-basse px-3 py-2.5">
        <p className="text-sm">
          <span className="text-texte-faible">Mère : </span>
          <span className="font-semibold text-texte">{mereNom}</span>
        </p>
      </div>

      <Champ
        libelle="Date du premier contact prénatal"
        type="date"
        required
        max={AUJOURDHUI}
        value={reference}
        onChange={(e) => changerReference(e.target.value)}
        erreur={erreurs.date_reference}
        aide="Le calendrier antitétanique sera calculé à partir de cette date."
      />

      <Champ
        libelle="Terme estimé"
        type="date"
        value={terme}
        onChange={(e) => setTerme(e.target.value)}
        erreur={erreurs.terme_estime}
        aide="Facultatif. Proposé à sept mois du premier contact."
      />

      <Champ
        libelle="Rang de la grossesse"
        type="number"
        inputMode="numeric"
        min={1}
        max={20}
        required
        value={rang}
        onChange={(e) => setRang(e.target.value)}
        erreur={erreurs.rang}
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
        <Bouton type="submit" taille="compact" chargement={mutation.isPending}>
          Enregistrer
        </Bouton>
      </div>
    </form>
  );
}
