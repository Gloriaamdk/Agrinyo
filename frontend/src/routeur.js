import { useSyncExternalStore } from 'react'

// Petit routeur maison (History API) : quelques pages, pas besoin d'une bibliothèque.
const EVENEMENT = 'agrilink:navigation'

function abonner(rappel) {
  window.addEventListener('popstate', rappel)
  window.addEventListener(EVENEMENT, rappel)
  return () => {
    window.removeEventListener('popstate', rappel)
    window.removeEventListener(EVENEMENT, rappel)
  }
}

export function useChemin() {
  return useSyncExternalStore(abonner, () => window.location.pathname)
}

export function naviguer(url, { remplacer = false } = {}) {
  if (remplacer) window.history.replaceState(null, '', url)
  else window.history.pushState(null, '', url)
  window.dispatchEvent(new Event(EVENEMENT))
  window.scrollTo(0, 0)
}

/** Adresse de la page courante, pour y revenir après la connexion. */
export const adresseCourante = () => window.location.pathname + window.location.search + window.location.hash
