import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { requetes } from "@/api/requetes";
import { Bouton } from "@/composants/Bouton";
import { Champ } from "@/composants/Champ";
import { messageDErreur } from "@/etat/messages";
import type { EcheanceFile } from "@/api/types";

type Props = {
  echeance: EcheanceFile;
  beneficiaire: string;
  onTermine: () => void;
  onAnnuler: () => void;
};

const AUJOURDHUI = new Date().toISOString().slice(0, 10);

export function FormulaireDose({
  echeance,
  beneficiaire,
  onTermine,
  onAnnuler,
}: Props) {
  const [date, setDate] = useState(AUJOURDHUI);
  const [lot, setLot] = useState("");
  const [evenement, setEvenement] = useState("");
  const [afficherEvenement, setAfficherEvenement] = useState(false);

  /**
   * Générée une seule fois pour ce formulaire, pas à chaque soumission :
   * si le réseau coupe après l'écriture serveur, rejouer avec la même clé
   * ne crée pas de doublon (EF-54, ADR 0004).
   */
  const [cle] = useState(() => crypto.randomUUID());

  const client = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      requetes.enregistrerDose({
        echeance_id: echeance.id,
        date_administration: date,
        numero_lot: lot,
        cle_idempotence: cle,
        evenement_indesirable: evenement,
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["file-du-jour-complete"] });
      onTermine();
    },
  });

  function soumettre(evenementForm: FormEvent) {
    evenementForm.preventDefault();
    mutation.mutate();
  }

  return (
    <form onSubmit={soumettre} className="flex flex-col gap-4" noValidate>
      <div className="rounded-md bg-surface-basse px-3 py-2.5">
        <p className="text-sm font-semibold text-texte">
          {echeance.vaccin_libelle}
          <span className="ml-1.5 font-normal text-texte-faible">
            dose {echeance.rang}
          </span>
        </p>
        <p className="mt-0.5 text-sm text-texte-faible">{beneficiaire}</p>
      </div>

      <Champ
        libelle="Date d'administration"
        type="date"
        required
        max={AUJOURDHUI}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        aide="Par défaut aujourd'hui. À corriger pour une saisie rétroactive."
      />

      <Champ
        libelle="Numéro de lot"
        value={lot}
        onChange={(e) => setLot(e.target.value)}
        placeholder="Facultatif"
        autoCapitalize="characters"
      />

      {afficherEvenement ? (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="evenement"
            className="text-sm font-semibold text-texte"
          >
            Événement indésirable
          </label>
          <textarea
            id="evenement"
            rows={3}
            value={evenement}
            onChange={(e) => setEvenement(e.target.value)}
            placeholder="Réaction observée après administration"
            className="rounded-md border border-bordure bg-white px-3 py-2 text-base text-texte transition-colors duration-[120ms] placeholder:text-texte-faible focus:border-cuivre"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAfficherEvenement(true)}
          className="self-start text-sm font-medium text-cuivre underline-offset-2 hover:underline"
        >
          Signaler un événement indésirable
        </button>
      )}

      {mutation.isError && (
        <div
          role="alert"
          className="rounded-md bg-retard-fond px-3 py-2.5 text-sm text-retard"
        >
          <p className="font-semibold">Enregistrement refusé</p>
          <p className="mt-0.5">{messageDErreur(mutation.error)}</p>
        </div>
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
          Enregistrer la dose
        </Bouton>
      </div>
    </form>
  );
}
