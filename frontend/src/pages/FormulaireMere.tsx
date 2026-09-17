import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { requetes } from "@/api/requetes";
import { Bouton } from "@/composants/Bouton";
import { Champ } from "@/composants/Champ";
import { erreursParChamp, messageDErreur } from "@/etat/messages";

type Props = {
  onTermine: (idMere: string) => void;
  onAnnuler: () => void;
};

const CANAUX = [
  { valeur: "whatsapp", libelle: "WhatsApp" },
  { valeur: "sms", libelle: "SMS" },
  { valeur: "application", libelle: "Aucun envoi" },
];

export function FormulaireMere({ onTermine, onAnnuler }: Props) {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [village, setVillage] = useState("");
  const [langue, setLangue] = useState("wo");
  const [canal, setCanal] = useState("whatsapp");

  const client = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const mere = await requetes.creerMere({
        prenom, nom, telephone, village, langue,
      });
      // Le consentement est une entité distincte : il se recueille après
      // la création et reste révocable (ENF-21).
      await requetes.consentir(mere.id, canal);
      return mere;
    },
    onSuccess: (mere) => {
      client.invalidateQueries({ queryKey: ["meres"] });
      onTermine(mere.id);
    },
  });

  const erreurs = erreursParChamp(mutation.error);

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
          erreur={erreurs.prenom}
        />
        <Champ
          libelle="Nom"
          required
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          erreur={erreurs.nom}
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
        aide="Indispensable pour les rappels vocaux."
      />

      <Champ
        libelle="Village ou quartier"
        value={village}
        onChange={(e) => setVillage(e.target.value)}
        erreur={erreurs.village}
      />

      <ChoixRadio
        libelle="Langue des rappels"
        valeur={langue}
        onChanger={setLangue}
        options={[
          { valeur: "wo", libelle: "Wolof" },
          { valeur: "fr", libelle: "Français" },
        ]}
      />

      <ChoixRadio
        libelle="Consentement aux rappels"
        valeur={canal}
        onChanger={setCanal}
        options={CANAUX}
        aide="À recueillir auprès de la mère avant tout envoi."
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
          disabled={!prenom || !nom}
        >
          Enregistrer
        </Bouton>
      </div>
    </form>
  );
}

export function ChoixRadio({
  libelle,
  valeur,
  onChanger,
  options,
  aide,
}: {
  libelle: string;
  valeur: string;
  onChanger: (valeur: string) => void;
  options: { valeur: string; libelle: string }[];
  aide?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-semibold text-texte">{libelle}</legend>
      {aide && <p className="text-sm text-texte-faible">{aide}</p>}

      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <label
            key={option.valeur}
            className={`min-h-[38px] cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition-colors duration-[120ms] ${
              valeur === option.valeur
                ? "border-cuivre bg-cuivre-clair text-cuivre"
                : "border-bordure bg-white text-texte hover:bg-surface-basse"
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              checked={valeur === option.valeur}
              onChange={() => onChanger(option.valeur)}
            />
            {option.libelle}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
