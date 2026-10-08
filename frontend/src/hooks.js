import { useCallback, useEffect, useRef, useState } from 'react'
import { getMessagesNonLus, getPropositionsNonVues } from './api.js'

const CLE_FAVORIS = 'agrilink.favoris'

function lireFavoris() {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLE_FAVORIS)) ?? [])
  } catch {
    return new Set()
  }
}

/** Favoris gardés dans le téléphone (localStorage) en attendant les comptes utilisateurs. */
export function useFavoris() {
  const [favoris, setFavoris] = useState(lireFavoris)

  const basculer = useCallback((id) => {
    setFavoris((actuels) => {
      const suivants = new Set(actuels)
      if (suivants.has(id)) suivants.delete(id)
      else suivants.add(id)
      try {
        localStorage.setItem(CLE_FAVORIS, JSON.stringify([...suivants]))
      } catch {
        // Stockage indisponible (navigation privée) : les favoris restent le temps de la visite.
      }
      return suivants
    })
  }, [])

  return { favoris, basculer }
}

const lireIdFiche = () => {
  const correspondance = window.location.hash.match(/^#machine-(\d+)$/)
  return correspondance ? Number(correspondance[1]) : null
}

/**
 * Fiche machine ouverte, reflétée dans l'adresse (#machine-5) : le bouton « retour »
 * d'Android ferme la fiche, et le lien peut être partagé.
 */
export function useFicheOuverte() {
  const [id, setId] = useState(lireIdFiche)

  useEffect(() => {
    const synchroniser = () => setId(lireIdFiche())
    window.addEventListener('popstate', synchroniser)
    return () => window.removeEventListener('popstate', synchroniser)
  }, [])

  const ouvrir = useCallback((nouvelId) => {
    window.history.pushState({ fiche: true }, '', `#machine-${nouvelId}`)
    setId(nouvelId)
  }, [])

  const fermer = useCallback(() => {
    if (window.history.state?.fiche) {
      window.history.back() // déclenche popstate, qui remet l'id à null
    } else {
      // Fiche ouverte depuis un lien partagé : pas d'entrée d'historique à dépiler.
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      setId(null)
    }
  }, [])

  return { id, ouvrir, fermer }
}

/**
 * Appelle `rappel` toutes les `intervalle` ms tant que la page est visible, et aussitôt qu'elle
 * le redevient : pas de requêtes inutiles quand le téléphone est en veille ou l'onglet caché.
 */
export function useRafraichissement(rappel, intervalle, actif = true) {
  const dernier = useRef(rappel)
  useEffect(() => {
    dernier.current = rappel
  })

  useEffect(() => {
    if (!actif) return
    let minuteur = null
    const arreter = () => {
      clearInterval(minuteur)
      minuteur = null
    }
    const lancer = () => {
      arreter()
      if (document.visibilityState === 'visible') minuteur = setInterval(() => dernier.current(), intervalle)
    }
    const visibilite = () => {
      if (document.visibilityState === 'visible') {
        dernier.current()
        lancer()
      } else {
        arreter()
      }
    }
    lancer()
    document.addEventListener('visibilitychange', visibilite)
    return () => {
      arreter()
      document.removeEventListener('visibilitychange', visibilite)
    }
  }, [intervalle, actif])
}

/** Émis par la conversation après lecture : la pastille se met à jour sans attendre. */
export const EVENEMENT_MESSAGES_LUS = 'agrilink:messages-lus'
/** Émis par « Mes offres » : les propositions affichées sont désormais vues. */
export const EVENEMENT_PROPOSITIONS_VUES = 'agrilink:propositions-vues'
const INTERVALLE_PASTILLES = 20000

/** Compteur de pastille ({ total }), rafraîchi régulièrement, à chaque changement de `cle` et sur `evenement`. */
function useCompteur(charger, evenement, actif, cle) {
  const [total, setTotal] = useState(0)
  const rafraichir = useCallback(() => {
    charger()
      .then((reponse) => setTotal(reponse.total))
      .catch(() => {}) // hors ligne : on garde le dernier chiffre connu
  }, [charger])

  useEffect(() => {
    if (!actif) return
    rafraichir()
    window.addEventListener(evenement, rafraichir)
    return () => window.removeEventListener(evenement, rafraichir)
  }, [actif, cle, evenement, rafraichir])

  useRafraichissement(rafraichir, INTERVALLE_PASTILLES, actif)
  return actif ? total : 0
}

/** Messages reçus non lus (agriculteur et propriétaire). */
export const useMessagesNonLus = (actif, cle) => useCompteur(getMessagesNonLus, EVENEMENT_MESSAGES_LUS, actif, cle)

/** Propositions de machines pas encore vues sur les offres de l'agriculteur. */
export const usePropositionsNonVues = (actif, cle) =>
  useCompteur(getPropositionsNonVues, EVENEMENT_PROPOSITIONS_VUES, actif, cle)
