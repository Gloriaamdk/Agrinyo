// Icônes SVG en ligne : aucune police d'icônes ni requête réseau supplémentaire.
const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
}

export const IconeRepere = (props) => (
  <svg {...base} {...props}>
    <path d="M12 22s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z" fill="currentColor" stroke="none" />
    <circle cx="12" cy="10" r="2.6" fill="#fff" stroke="none" />
  </svg>
)

export const IconeChevron = (props) => (
  <svg {...base} width={18} height={18} {...props}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export const IconeFleche = ({ sens = 'droite', ...props }) => (
  <svg {...base} {...props}>
    <path d={sens === 'droite' ? 'm9 5 7 7-7 7' : 'm15 5-7 7 7 7'} />
  </svg>
)

export const IconeLoupe = (props) => (
  <svg {...base} {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

export const IconeEffacer = (props) => (
  <svg {...base} width={18} height={18} {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

export const IconeCoeur = ({ plein, ...props }) => (
  <svg {...base} {...props}>
    <path
      d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.9 3.8 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.4 0 5.5 3.4 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"
      fill={plein ? 'currentColor' : 'none'}
    />
  </svg>
)

export const IconeRetour = (props) => (
  <svg {...base} {...props}>
    <path d="M20 12H4m6-6-6 6 6 6" />
  </svg>
)

export const IconeCalendrier = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4m8-4v4" />
    <path d="M7.5 14h.01M12 14h.01M16.5 14h.01M7.5 17.5h.01M12 17.5h.01" strokeWidth="2.6" />
  </svg>
)

export const IconeMoins = (props) => (
  <svg {...base} {...props}>
    <path d="M5 12h14" />
  </svg>
)

export const IconePlus = (props) => (
  <svg {...base} {...props}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconeCoche = (props) => (
  <svg {...base} {...props}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)

export const IconeOeil = ({ barre, ...props }) => (
  <svg {...base} {...props}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {barre && <path d="M3 3l18 18" />}
  </svg>
)

export const IconeCadenas = (props) => (
  <svg {...base} {...props}>
    <path d="M7.5 10V7.5a4.5 4.5 0 0 1 9 0V10" />
    <rect x="4.5" y="10" width="15" height="11.5" rx="3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="15" r="1.6" fill="#fff" stroke="none" />
    <path d="M12 15.5v2.2" stroke="#fff" strokeWidth="1.8" />
  </svg>
)

export const IconeTelephone = (props) => (
  <svg {...base} {...props}>
    <rect x="6" y="2" width="12" height="20" rx="3" fill="currentColor" stroke="none" />
    <path d="M10.5 18.5h3" stroke="#fff" strokeWidth="1.8" />
  </svg>
)

export const IconeEnveloppe = (props) => (
  <svg {...base} {...props}>
    <rect x="2.5" y="5" width="19" height="14" rx="3" fill="currentColor" stroke="none" />
    <path d="m5.5 8.5 6.5 4.5 6.5-4.5" stroke="#fff" strokeWidth="1.8" />
  </svg>
)

/** Pousse à deux feuilles : le logo AgriLink. */
export const IconeFeuille = (props) => (
  <svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true" focusable="false" {...props}>
    <path d="M16 28V15" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M16 16c0-6 3.5-9.5 10-9.5 0 6-3.5 9.5-10 9.5zM16 20c0-4.5-3-7-8.5-7 0 4.5 3 7 8.5 7z" fill="currentColor" />
  </svg>
)

export const IconeSortie = (props) => (
  <svg {...base} {...props}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" />
  </svg>
)

export const IconeReservations = (props) => (
  <svg {...base} {...props}>
    <path d="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="currentColor" stroke="none" />
    <path d="M3 10h18" stroke="#fff" strokeWidth="1.8" />
    <path d="m8.5 15 2.2 2.2 4.8-4.7" stroke="#fff" strokeWidth="2" />
    <path d="M8 2.5v4m8-4v4" />
  </svg>
)

export const IconeDemandes = (props) => (
  <svg {...base} {...props}>
    <path d="M3 13.5 5.5 5h13l2.5 8.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="currentColor" stroke="none" />
    <path d="M3 13.5h5l1.5 2.5h5l1.5-2.5h5" stroke="#fff" strokeWidth="1.8" />
  </svg>
)

export const IconeMaison = (props) => (
  <svg {...base} {...props}>
    <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" fill="currentColor" stroke="none" />
  </svg>
)

export const IconeMessage = (props) => (
  <svg {...base} {...props}>
    <path d="M12 3c5 0 9 3.4 9 7.5S17 18 12 18c-1 0-2-.1-2.9-.4L4 20l1.4-4C4 14.6 3 12.6 3 10.5 3 6.4 7 3 12 3z" fill="currentColor" stroke="none" />
    <circle cx="8" cy="10.5" r="1.2" fill="#fff" stroke="none" />
    <circle cx="12" cy="10.5" r="1.2" fill="#fff" stroke="none" />
    <circle cx="16" cy="10.5" r="1.2" fill="#fff" stroke="none" />
  </svg>
)

export const IconeProfil = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="7.5" r="4.5" fill="currentColor" stroke="none" />
    <path d="M3.5 21c.8-4.5 4.3-7 8.5-7s7.7 2.5 8.5 7z" fill="currentColor" stroke="none" />
  </svg>
)

export const IconeTableau = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="3" width="8" height="10" rx="2" fill="currentColor" stroke="none" />
    <rect x="13" y="3" width="8" height="6" rx="2" fill="currentColor" stroke="none" />
    <rect x="3" y="15" width="8" height="6" rx="2" fill="currentColor" stroke="none" />
    <rect x="13" y="11" width="8" height="10" rx="2" fill="currentColor" stroke="none" />
  </svg>
)

export const IconeTracteur = (props) => (
  <svg {...base} {...props}>
    <path d="M4 15V9h7l2 4h6a2 2 0 0 1 2 2v1H4z" fill="currentColor" stroke="none" />
    <path d="M6 9V5h4l1 4" />
    <circle cx="7.5" cy="17.5" r="3.5" fill="#fff" />
    <circle cx="18" cy="18.5" r="2.5" fill="#fff" />
  </svg>
)

export const IconePoubelle = (props) => (
  <svg {...base} {...props}>
    <path d="M4 7h16M10 3h4M6 7l1 13a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 20l1-13" />
    <path d="M10 11v6m4-6v6" />
  </svg>
)

export const IconePhoto = (props) => (
  <svg {...base} {...props}>
    <path d="M4 7.5h3l1.5-2.5h7L17 7.5h3a1.5 1.5 0 0 1 1.5 1.5v9.5A1.5 1.5 0 0 1 20 20H4a1.5 1.5 0 0 1-1.5-1.5V9A1.5 1.5 0 0 1 4 7.5z" fill="currentColor" stroke="none" />
    <circle cx="12" cy="13.5" r="3.6" fill="#fff" stroke="none" />
  </svg>
)

/** Porte-voix : les offres (« je cherche une machine »). */
export const IconeOffre = (props) => (
  <svg {...base} {...props}>
    <path d="M3 10v4a1 1 0 0 0 1 1h3l8 5V4L7 9H4a1 1 0 0 0-1 1z" fill="currentColor" stroke="none" />
    <path d="M18.5 8.5a5 5 0 0 1 0 7" />
  </svg>
)
