import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import detecteur from "i18next-browser-languagedetector";
import fr from "./fr.json";
import wo from "./wo.json";

/**
 * L'interface professionnelle est en français : c'est la langue de
 * l'administration sanitaire sénégalaise, des formulaires et du carnet
 * de vaccination lui-même.
 *
 * Le wolof est réservé à ce qui s'adresse aux mères — les messages vocaux
 * du sprint 3 — où il fait une différence réelle. Ce fichier de traduction
 * reste donc partiel, et `fallbackLng` renvoie au français pour toute clé
 * manquante. Voir ADR 0005.
 */
i18n
  .use(detecteur)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { traduction: fr },
      wo: { traduction: wo },
    },
    defaultNS: "traduction",
    fallbackLng: "fr",
    supportedLngs: ["fr", "wo"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "suvac.langue",
      caches: ["localStorage"],
    },
  });

export default i18n;
