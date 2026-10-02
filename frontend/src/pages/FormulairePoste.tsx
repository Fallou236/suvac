import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { requetes } from "@/api/requetes";
import type { PosteSante } from "@/api/types";
import { Bouton } from "@/composants/Bouton";
import { Champ } from "@/composants/Champ";
import { erreursParChamp, messageDErreur } from "@/etat/messages";

type Props = {
  poste?: PosteSante;
  estAdmin?: boolean;
  onTermine: (id: string) => void;
  onAnnuler: () => void;
};

export function FormulairePoste({
  poste,
  estAdmin = false,
  onTermine,
  onAnnuler,
}: Props) {
  const [nom, setNom] = useState(poste?.nom ?? "");
  const [district, setDistrict] = useState(poste?.district ?? "");
  const [region, setRegion] = useState(poste?.region ?? "");
  const [telephone, setTelephone] = useState(poste?.telephone ?? "");
  const [latitude, setLatitude] = useState(poste?.latitude ?? "");
  const [longitude, setLongitude] = useState(poste?.longitude ?? "");
  const [localisation, setLocalisation] = useState<string | null>(null);

  const client = useQueryClient();
  const modification = poste !== undefined;

  // Le rattachement administratif n'est pas du ressort du poste : un
  // superviseur corrige son nom et ses coordonnées, pas son district.
  const peutChangerRattachement = estAdmin || !modification;

  const mutation = useMutation({
    mutationFn: () => {
      const saisie = {
        nom,
        district,
        region,
        telephone,
        latitude: latitude || null,
        longitude: longitude || null,
      };
      return modification
        ? requetes.modifierPoste(poste.id, saisie)
        : requetes.creerPoste(saisie);
    },
    onSuccess: (resultat) => {
      client.invalidateQueries({ queryKey: ["postes"] });
      onTermine(resultat.id);
    },
  });

  const erreurs = erreursParChamp(mutation.error);

  /**
   * Relève la position depuis l'appareil. L'agent est au poste quand il
   * saisit : c'est le moment où la coordonnée est juste.
   */
  function releverPosition() {
    if (!navigator.geolocation) {
      setLocalisation("Votre appareil ne sait pas donner sa position.");
      return;
    }

    setLocalisation("Relevé en cours…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setLocalisation(null);
      },
      () => setLocalisation("Position refusée ou indisponible."),
      { timeout: 10000 },
    );
  }

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    mutation.mutate();
  }

  return (
    <form onSubmit={soumettre} className="flex flex-col gap-4" noValidate>
      <Champ
        libelle="Nom du poste"
        required
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        aide="Tel qu'il figure sur les documents du district."
        erreur={erreurs.nom}
      />

      {peutChangerRattachement ? (
        <div className="grid grid-cols-2 gap-3">
          <Champ
            libelle="District"
            required
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            erreur={erreurs.district}
          />
          <Champ
            libelle="Région"
            required
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            erreur={erreurs.region}
          />
        </div>
      ) : (
        <p className="rounded-md border border-bordure bg-surface-basse px-3 py-2.5 text-sm text-texte-faible">
          Rattaché à {district}, {region}. Un changement de district relève de
          l'administration.
        </p>
      )}

      <Champ
        libelle="Téléphone du poste"
        type="tel"
        inputMode="tel"
        value={telephone}
        onChange={(e) => setTelephone(e.target.value)}
        placeholder="+221 33 900 00 00"
        aide="Communiqué aux bénéficiaires dans les messages."
        erreur={erreurs.telephone}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-texte">
          Localisation
        </legend>

        <div className="grid grid-cols-2 gap-3">
          <Champ
            libelle="Latitude"
            inputMode="decimal"
            value={latitude ?? ""}
            onChange={(e) => setLatitude(e.target.value)}
            placeholder="14.789000"
            erreur={erreurs.latitude}
          />
          <Champ
            libelle="Longitude"
            inputMode="decimal"
            value={longitude ?? ""}
            onChange={(e) => setLongitude(e.target.value)}
            placeholder="-16.926000"
            erreur={erreurs.longitude}
          />
        </div>

        <div className="flex items-center gap-3">
          <Bouton
            type="button"
            variante="secondaire"
            taille="compact"
            onClick={releverPosition}
          >
            Relever ma position
          </Bouton>
          {localisation && (
            <span className="text-xs text-texte-faible">{localisation}</span>
          )}
        </div>
      </fieldset>

      {mutation.isError && Object.keys(erreurs).length === 0 && (
        <p
          role="alert"
          className="rounded-md bg-retard-fond px-3 py-2 text-sm text-retard"
        >
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
          disabled={!nom || !district || !region}
        >
          {modification ? "Enregistrer" : "Créer le poste"}
        </Bouton>
      </div>
    </form>
  );
}
