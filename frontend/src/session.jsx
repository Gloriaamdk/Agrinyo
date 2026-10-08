import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as api from './api.js'

const SessionContexte = createContext(null)

/**
 * Utilisateur connecté, partagé par toutes les pages.
 * etat : « verification » au démarrage, le temps de demander au serveur si le cookie de session est valide
 * (cookie HttpOnly : le JavaScript ne peut pas le lire lui-même).
 */
export function SessionProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(null)
  const [etat, setEtat] = useState('verification')

  useEffect(() => {
    if (etat !== 'verification') return
    const controleur = new AbortController()
    api
      .getProfil(controleur.signal)
      .then((profil) => {
        setUtilisateur(profil)
        setEtat('pret')
      })
      .catch((erreur) => {
        if (erreur.name === 'AbortError') return
        // Pas connecté (401) ou hors ligne : le cookie reste, on réessaiera au prochain chargement.
        setEtat('pret')
      })
    return () => controleur.abort()
  }, [etat])

  useEffect(() => {
    const expiree = () => setUtilisateur(null)
    window.addEventListener('agrilink:session-expiree', expiree)
    return () => window.removeEventListener('agrilink:session-expiree', expiree)
  }, [])

  // Le cookie de session est déjà posé par la réponse du serveur.
  const ouvrirSession = useCallback(({ utilisateur: profil }) => {
    setUtilisateur(profil)
    return profil
  }, [])

  const seConnecter = useCallback(
    async (identifiant, motDePasse, { seSouvenir = true } = {}) =>
      ouvrirSession(await api.connexion(identifiant, motDePasse, seSouvenir)),
    [ouvrirSession],
  )

  const sInscrire = useCallback(async (donnees) => ouvrirSession(await api.inscription(donnees)), [ouvrirSession])

  // Pas de « Se souvenir de moi » sur cet écran : le serveur ferme la session avec le navigateur.
  const reinitialiserMotDePasse = useCallback(
    async (donnees) => ouvrirSession(await api.reinitialiserMotDePasse(donnees)),
    [ouvrirSession],
  )

  /** donnees : objet de champs (JSON) ou File (photo). Renvoie le profil à jour. */
  const modifierProfil = useCallback(async (donnees) => {
    const profil = donnees instanceof File ? await api.envoyerPhoto(donnees) : await api.modifierProfil(donnees)
    setUtilisateur(profil)
    return profil
  }, [])

  const confirmerTelephone = useCallback(async (code) => {
    const profil = await api.confirmerTelephone(code)
    setUtilisateur(profil)
    return profil
  }, [])

  // Le serveur garde cette session (et son choix « Se souvenir de moi ») et ferme les autres.
  const changerMotDePasse = useCallback(
    async (ancien, nouveau) => ouvrirSession(await api.changerMotDePasse(ancien, nouveau)),
    [ouvrirSession],
  )

  const seDeconnecter = useCallback(async () => {
    try {
      await api.deconnexion()
    } catch {
      // Hors ligne : le cookie reste côté navigateur, mais on affiche l'état déconnecté.
    }
    setUtilisateur(null)
  }, [])

  const valeur = useMemo(
    () => ({
      utilisateur,
      etat,
      estAgriculteur: utilisateur?.type_utilisateur === 'AGRICULTEUR',
      estDetenteur: utilisateur?.type_utilisateur === 'DETENTEUR',
      seConnecter,
      sInscrire,
      reinitialiserMotDePasse,
      modifierProfil,
      confirmerTelephone,
      changerMotDePasse,
      seDeconnecter,
    }),
    [
      utilisateur, etat, seConnecter, sInscrire, reinitialiserMotDePasse, modifierProfil, confirmerTelephone,
      changerMotDePasse, seDeconnecter,
    ],
  )

  return <SessionContexte.Provider value={valeur}>{children}</SessionContexte.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession() {
  return useContext(SessionContexte)
}
