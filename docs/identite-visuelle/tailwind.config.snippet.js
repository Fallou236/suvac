// SUVAC — extrait à fusionner dans tailwind.config.js
// Les valeurs pointent vers les variables CSS de tokens.css : une seule
// source de vérité, et le thème reste modifiable à chaud.

export default {
  theme: {
    extend: {
      colors: {
        baobab: {
          DEFAULT: 'var(--suvac-baobab)',
          fonce:   'var(--suvac-baobab-fonce)',
          clair:   'var(--suvac-baobab-clair)',
        },
        cuivre: {
          DEFAULT: 'var(--suvac-cuivre)',
          clair:   'var(--suvac-cuivre-clair)',
          lumiere: 'var(--suvac-cuivre-lumiere)',
        },
        statut: {
          administre: 'var(--statut-administre)',
          avenir:     'var(--statut-a-venir)',
          due:        'var(--statut-due)',
          dueFond:    'var(--statut-due-fond)',
          retard:     'var(--statut-retard)',
          retardFond: 'var(--statut-retard-fond)',
          annule:     'var(--statut-annule)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          basse:   'var(--surface-basse)',
        },
        bordure: 'var(--bordure)',
        texte: {
          DEFAULT: 'var(--texte)',
          faible:  'var(--texte-faible)',
          inverse: 'var(--texte-inverse)',
        },
      },
      fontFamily: {
        sans: ['Public Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm:   'var(--rayon-sm)',
        DEFAULT: 'var(--rayon)',
        lg:   'var(--rayon-lg)',
      },
      minHeight: {
        tactile: 'var(--cible-tactile)',
      },
      minWidth: {
        tactile: 'var(--cible-tactile)',
      },
    },
  },
}
