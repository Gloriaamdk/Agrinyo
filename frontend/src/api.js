import { useEffect, useState } from 'react'

// Adresse de l'API (frontend/.env). Vide : même adresse que le site.
const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

/** Chemin renvoyé par l'API (« /media/machines/x.jpg ») → adresse complète, ou null. */
export const urlMedia = (chemin) => (chemin ? `${chemin.startsWith('/') ? API_URL : ''}${chemin}` : null)

// La session vit dans un cookie HttpOnly posé par Django : aucun jeton n'est lisible ni stocké par le JavaScript.
// Seul le jeton CSRF est lu (cookie « csrftoken ») pour l'en-tête X-CSRFToken des écritures.
function cookieCsrf() {
  const cookie = document.cookie.split('; ').find((c) => c.startsWith('csrftoken='))
  return cookie ? decodeURIComponent(cookie.slice('csrftoken='.length)) : null
}

// API sur un autre domaine (VITE_API_URL) : son cookie n'est pas lisible ici, on demande le jeton à /api/csrf/.
// Gardé en mémoire seulement ; redemandé quand Django le refuse (il change à chaque connexion).
let jetonMemoire = null

async function jetonCsrf({ renouveler = false } = {}) {
  const cookie = cookieCsrf()
  if (cookie && !renouveler) return cookie
  if (!jetonMemoire || renouveler) {
    const reponse = await fetch(`${API_URL}/api/csrf/`, { credentials: 'include', headers: { Accept: 'application/json' } })
    jetonMemoire = reponse.ok ? (await reponse.json()).csrf : null
  }
  return jetonMemoire ?? cookieCsrf()
}

const refusCsrf = (statut, donnees) => statut === 403 && typeof donnees?.detail === 'string' && donnees.detail.includes('CSRF')

// Anciennes versions : le jeton d'API était gardé dans le navigateur. On l'efface.
for (const nom of ['localStorage', 'sessionStorage']) {
  try {
    window[nom].removeItem('agrilink.jeton')
  } catch {
    // stockage indisponible : rien à effacer
  }
}

/** Erreur renvoyée par l'API, avec les messages par champ de Django REST Framework. */
export class ErreurApi extends Error {
  constructor(statut, details) {
    super(`Erreur ${statut}`)
    this.statut = statut
    this.details = details ?? {}
  }

  /** Premier message d'erreur pour un champ du formulaire, ou undefined. */
  champ(nom) {
    const valeur = this.details[nom]
    return Array.isArray(valeur) ? valeur[0] : valeur
  }
}

/** Message lisible pour n'importe quelle erreur (réseau, serveur, validation). */
export function messageErreur(erreur) {
  if (!(erreur instanceof ErreurApi)) {
    return 'Pas de connexion internet. Vérifiez votre réseau et réessayez.'
  }
  if (erreur.statut === 429) return 'Trop d’essais. Patientez une minute avant de réessayer.'
  const { details } = erreur
  if (erreur.statut >= 500) {
    // 503 « SMS non envoyé » : le serveur donne un message précis.
    return typeof details.detail === 'string' ? details.detail : 'Le serveur rencontre un problème. Réessayez dans un instant.'
  }
  if (typeof details.detail === 'string') return details.detail
  if (Array.isArray(details)) return details[0]
  if (details.non_field_errors) return details.non_field_errors[0]
  const premier = Object.values(details)[0]
  return (Array.isArray(premier) ? premier[0] : premier) ?? 'Une erreur est survenue.'
}

async function requete(url, { methode = 'GET', corps, signal } = {}, nouvelEssai = false) {
  // X-Agrilink-Client : Django ouvre une session par cookie au lieu de renvoyer un jeton.
  const entetes = { Accept: 'application/json', 'X-Agrilink-Client': 'web' }
  // Un FormData (envoi de fichier) fixe lui-même son Content-Type multipart.
  const formulaire = corps instanceof FormData
  if (corps !== undefined && !formulaire) entetes['Content-Type'] = 'application/json'
  const csrf = methode === 'GET' ? null : await jetonCsrf({ renouveler: nouvelEssai })
  if (csrf) entetes['X-CSRFToken'] = csrf

  const reponse = await fetch(`${API_URL}${url}`, {
    method: methode,
    headers: entetes,
    body: corps === undefined || formulaire ? corps : JSON.stringify(corps),
    // « include » : le cookie de session part aussi quand l'API est sur une autre adresse (VITE_API_URL).
    credentials: 'include',
    signal,
  })
  if (reponse.status === 204) return null
  const donnees = await reponse.json().catch(() => null)
  // Jeton CSRF périmé (nouvelle connexion, autre onglet) : un nouveau jeton et un seul nouvel essai.
  if (!nouvelEssai && refusCsrf(reponse.status, donnees)) return requete(url, { methode, corps, signal }, true)
  if (!reponse.ok) {
    // Session expirée ou fermée ailleurs.
    if (reponse.status === 401) window.dispatchEvent(new Event('agrilink:session-expiree'))
    throw new ErreurApi(reponse.status, donnees)
  }
  return donnees
}

// --- Machines ---

export function getMachines({ zone, type, recherche }, signal) {
  const params = new URLSearchParams({ disponible: 'true' })
  if (zone) params.set('zone', zone)
  if (type) params.set('type', type)
  if (recherche) params.set('q', recherche)
  return requete(`/api/machines/?${params}`, { signal })
}

export const getMachine = (id, signal) => requete(`/api/machines/${id}/`, { signal })
export const getFiltres = (signal) => requete('/api/machines/filtres/', { signal })

// --- Machines du propriétaire ---

/** Ses machines, disponibles ou non, avec `demandes_en_attente`. */
export const getMesMachines = (signal) => requete('/api/machines/mine/', { signal })
/** donnees : objet (JSON) ou FormData quand une photo est jointe. */
export const creerMachine = (donnees) => requete('/api/machines/', { methode: 'POST', corps: donnees })
export const modifierMachine = (id, donnees) => requete(`/api/machines/${id}/`, { methode: 'PATCH', corps: donnees })
/** Refusée (409) s'il reste des réservations acceptées à venir : la machine devient alors indisponible. */
export const supprimerMachine = (id) => requete(`/api/machines/${id}/`, { methode: 'DELETE' })

// --- Comptes ---

/** identifiant : nom d'utilisateur, e-mail ou numéro de téléphone. */
/** seSouvenir : faux = session fermée avec le navigateur. */
export const connexion = (identifiant, motDePasse, seSouvenir = true) =>
  requete('/api/login/', {
    methode: 'POST',
    corps: { identifiant, mot_de_passe: motDePasse, se_souvenir: seSouvenir },
  })
export const inscription = (donnees) => requete('/api/register/', { methode: 'POST', corps: donnees })
export const deconnexion = () => requete('/api/logout/', { methode: 'POST', corps: {} })
export const getProfil = (signal) => requete('/api/profile/', { signal })
export const demanderCode = (identifiant) =>
  requete('/api/password/forgot/', { methode: 'POST', corps: { identifiant } })
/** donnees : { identifiant, code, mot_de_passe } ; ouvre une session comme la connexion. */
export const reinitialiserMotDePasse = (donnees) =>
  requete('/api/password/reset/', { methode: 'POST', corps: donnees })
/** donnees : username, email, first_name, last_name, localisation, supprimer_photo (au choix). */
export const modifierProfil = (donnees) => requete('/api/profile/', { methode: 'PATCH', corps: donnees })
export function envoyerPhoto(fichier) {
  const formulaire = new FormData()
  formulaire.append('photo', fichier)
  return requete('/api/profile/', { methode: 'PATCH', corps: formulaire })
}
/** Étape 1 : un code part par SMS au nouveau numéro. */
export const demanderChangementTelephone = (telephone) =>
  requete('/api/profile/phone/', { methode: 'POST', corps: { telephone } })
/** Étape 2 : renvoie le profil avec le nouveau numéro. */
export const confirmerTelephone = (code) => requete('/api/profile/phone/confirm/', { methode: 'POST', corps: { code } })
/** Les autres appareils sont déconnectés ; celui-ci reste connecté. */
export const changerMotDePasse = (ancien, nouveau) =>
  requete('/api/password/change/', {
    methode: 'POST',
    corps: { ancien_mot_de_passe: ancien, nouveau_mot_de_passe: nouveau },
  })

// --- Réservations ---

export const creerReservation = (donnees) => requete('/api/reservations/', { methode: 'POST', corps: donnees })
export const getMesReservations = (signal) => requete('/api/reservations/me/', { signal })
export function getDemandesRecues(statut, signal) {
  const params = statut ? `?statut=${statut}` : ''
  return requete(`/api/reservations/received/${params}`, { signal })
}
export const repondreReservation = (id, action) =>
  requete(`/api/reservations/${id}/${action}/`, { methode: 'PATCH', corps: {} })

// --- Messagerie (réservations acceptées) ---

/** Conversation d'une réservation. apres : id du dernier message connu, pour ne recevoir que les nouveaux. */
export function getMessages(reservationId, { apres } = {}, signal) {
  const params = apres ? `?apres=${apres}` : ''
  return requete(`/api/reservations/${reservationId}/messages/${params}`, { signal })
}
export const envoyerMessage = (reservationId, texte) =>
  requete(`/api/reservations/${reservationId}/messages/`, { methode: 'POST', corps: { texte } })
/** Accueil du propriétaire : compteurs et 5 prochaines réservations acceptées. */
export const getTableauDeBord = (signal) => requete('/api/dashboard/', { signal })
/** { total } : messages reçus non lus, pour la pastille de la navigation. */
export const getMessagesNonLus = (signal) => requete('/api/messages/unread/', { signal })

// --- Offres : un agriculteur cherche une machine absente du catalogue ---

/** Agriculteur : ses offres, avec les machines proposées (les nouvelles ont `nouvelle: true`). */
export const getMesOffres = (signal) => requete('/api/offres/mine/', { signal })
export const lancerOffre = (donnees) => requete('/api/offres/', { methode: 'POST', corps: donnees })
/** À appeler une fois les propositions affichées : elles ne sont plus « nouvelles ». */
export const marquerPropositionsVues = () => requete('/api/offres/seen/', { methode: 'POST', corps: {} })
export const fermerOffre = (id) => requete(`/api/offres/${id}/close/`, { methode: 'PATCH', corps: {} })
/** { total } : propositions pas encore vues, pour la pastille de la navigation. */
export const getPropositionsNonVues = (signal) => requete('/api/offres/unseen/', { signal })

/** Propriétaire : offres ouvertes. */
export function getOffresOuvertes({ zone, type } = {}, signal) {
  const params = new URLSearchParams()
  if (zone) params.set('zone', zone)
  if (type) params.set('type', type)
  return requete(`/api/offres/${params.size ? `?${params}` : ''}`, { signal })
}
export const getOffre = (id, signal) => requete(`/api/offres/${id}/`, { signal })
/** donnees : { machine, message } */
export const proposerMachine = (offreId, donnees) =>
  requete(`/api/offres/${offreId}/propose/`, { methode: 'POST', corps: donnees })

/**
 * Charge des données à chaque changement de `cle` et annule la requête précédente.
 * Le résultat garde la clé qui l'a produit : tant qu'il ne correspond pas à la clé
 * courante, l'état est « chargement ».
 */
export function useDonnees(cle, charger) {
  const [resultat, setResultat] = useState({ cle: null, donnees: null, erreur: null })

  useEffect(() => {
    if (cle === null) return
    const controleur = new AbortController()
    charger(controleur.signal)
      .then((donnees) => setResultat({ cle, donnees, erreur: null }))
      .catch((erreur) => {
        if (erreur.name !== 'AbortError') setResultat({ cle, donnees: null, erreur })
      })
    return () => controleur.abort()
    // `charger` change à chaque rendu ; seule la clé décide d'un nouveau chargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle])

  if (cle === null) return { etat: 'inactif', donnees: null }
  if (resultat.cle !== cle) return { etat: 'chargement', donnees: null }
  if (resultat.erreur) return { etat: 'erreur', donnees: null, erreur: resultat.erreur }
  return { etat: 'pret', donnees: resultat.donnees }
}
