import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  envoyerMessage, ErreurApi, getDemandesRecues, getMesReservations, getMessages, messageErreur, useDonnees,
} from '../api.js'
import EnTetePage from '../components/EnTetePage.jsx'
import { IconeFleche } from '../components/Icones.jsx'
import Lien from '../components/Lien.jsx'
import { formaterPeriodeCourte } from '../format.js'
import { EVENEMENT_MESSAGES_LUS, useRafraichissement } from '../hooks.js'
import { useSession } from '../session.jsx'

const INTERVALLE = 4000
const LONGUEUR_MAX = 1000 // Message.LONGUEUR_MAX côté serveur

// Phrases toutes prêtes pour une conversation vide : moins de texte à taper.
const SUGGESTIONS = {
  AGRICULTEUR: ['Bonjour, à quelle heure pouvez-vous venir ?', 'Où se trouve la machine ?', 'Le chauffeur est-il compris ?'],
  DETENTEUR: ['Bonjour, où se trouve votre champ ?', 'Je peux venir à 7 h, ça vous va ?', 'Merci pour la réservation.'],
}

const heure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const jourLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

function libelleJour(date) {
  const aujourdhui = new Date()
  const hier = new Date()
  hier.setDate(hier.getDate() - 1)
  if (date.toDateString() === aujourdhui.toDateString()) return 'Aujourd’hui'
  if (date.toDateString() === hier.toDateString()) return 'Hier'
  return jourLong.format(date)
}

/** Ajoute ou remplace des messages par id, en gardant l'ordre d'envoi. */
function fusionner(actuels, nouveaux) {
  const parId = new Map(actuels.map((m) => [m.id, m]))
  for (const m of nouveaux) parId.set(m.id, m)
  return [...parId.values()].sort((a, b) => a.id - b.id)
}

const presDuBas = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160

function Bulle({ message, vu, onReessayer }) {
  const classes = ['bulle', message.de_moi ? 'bulle--moi' : 'bulle--autre']
  if (message.etat === 'echec') classes.push('bulle--echec')
  return (
    <li className={classes.join(' ')}>
      <p className="bulle__texte">{message.texte}</p>
      <span className="bulle__meta">
        {message.etat === 'envoi' ? 'Envoi…' : message.etat === 'echec' ? 'Non envoyé' : heure.format(new Date(message.date_envoi))}
        {vu && <span className="bulle__vu"> · Vu</span>}
      </span>
      {message.etat === 'echec' && (
        <button type="button" className="bulle__reessayer" onClick={() => onReessayer(message)}>
          Réessayer
        </button>
      )}
    </li>
  )
}

/** Conversation d'une réservation acceptée, rafraîchie toute seule toutes les quelques secondes. */
export default function Conversation({ id }) {
  const { utilisateur, estDetenteur } = useSession()
  // Pas d'adresse pour une seule réservation : on la retrouve dans la liste de la personne.
  const reservations = useDonnees(`conversation-resa|${id}`, (signal) =>
    estDetenteur ? getDemandesRecues('', signal) : getMesReservations(signal),
  )
  const reservation = reservations.donnees?.find((r) => r.id === id)

  const [messages, setMessages] = useState([]) // envoyés et reçus (id numérique)
  const [enCours, setEnCours] = useState([]) // envois locaux (id « local-… »)
  const [etat, setEtat] = useState('chargement')
  const [erreur, setErreur] = useState(null)
  const [texte, setTexte] = useState('')
  const [erreurEnvoi, setErreurEnvoi] = useState(null)
  const [nouveauxEnBas, setNouveauxEnBas] = useState(false)
  const champ = useRef(null)
  const compteurLocal = useRef(0)
  const suivreLeBas = useRef(true)
  const enChargement = useRef(false)

  const charger = useCallback(async () => {
    if (enChargement.current) return
    enChargement.current = true
    try {
      // On reprend à partir du premier message envoyé pas encore lu : son « Vu » se met à jour.
      const pivot = messages.find((m) => m.de_moi && !m.lu)
      const dernier = messages.at(-1)
      const apres = pivot ? pivot.id - 1 : dernier?.id
      const recus = await getMessages(id, { apres })
      suivreLeBas.current = presDuBas()
      setMessages((actuels) => fusionner(actuels, recus))
      setEtat('pret')
      setErreur(null)
      if (recus.some((m) => !m.de_moi)) {
        window.dispatchEvent(new Event(EVENEMENT_MESSAGES_LUS)) // le serveur vient de les marquer lus
        if (!suivreLeBas.current) setNouveauxEnBas(true)
      }
    } catch (err) {
      // Coupure réseau passagère : on garde la conversation affichée et on réessaie au prochain tour.
      if (etat === 'chargement' || (err instanceof ErreurApi && [403, 404].includes(err.statut))) {
        setErreur(err)
        setEtat('erreur')
      }
    } finally {
      enChargement.current = false
    }
  }, [id, messages, etat])

  useEffect(() => {
    charger()
    // Premier chargement seulement ; la suite passe par useRafraichissement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  useRafraichissement(charger, INTERVALLE, etat !== 'erreur')

  // Défile vers le bas à l'ouverture et quand un message arrive, sauf si la personne relit plus haut.
  const nombre = messages.length + enCours.length
  useLayoutEffect(() => {
    if (suivreLeBas.current) window.scrollTo(0, document.documentElement.scrollHeight)
  }, [nombre])

  useEffect(() => {
    const defilement = () => {
      if (presDuBas()) setNouveauxEnBas(false)
    }
    window.addEventListener('scroll', defilement, { passive: true })
    return () => window.removeEventListener('scroll', defilement)
  }, [])

  const expedier = async (local) => {
    setEnCours((liste) => [...liste.filter((m) => m.id !== local.id), { ...local, etat: 'envoi' }])
    suivreLeBas.current = true
    try {
      const envoye = await envoyerMessage(id, local.texte)
      setEnCours((liste) => liste.filter((m) => m.id !== local.id))
      setMessages((actuels) => fusionner(actuels, [envoye]))
    } catch (err) {
      setEnCours((liste) => liste.map((m) => (m.id === local.id ? { ...m, etat: 'echec' } : m)))
      setErreurEnvoi(messageErreur(err))
    }
  }

  const envoyer = (e) => {
    e?.preventDefault()
    const contenu = texte.trim()
    if (!contenu || contenu.length > LONGUEUR_MAX) return
    compteurLocal.current += 1
    setTexte('')
    setErreurEnvoi(null)
    expedier({ id: `local-${compteurLocal.current}`, texte: contenu, de_moi: true })
    champ.current?.focus()
  }

  // Sur ordinateur, Entrée envoie (Maj + Entrée pour aller à la ligne). Sur téléphone, le bouton.
  const touche = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(hover: hover)').matches) envoyer(e)
  }

  const interlocuteur = reservation
    ? estDetenteur ? reservation.agriculteur.nom : reservation.machine.proprietaire.nom
    : 'Conversation'
  const retour = estDetenteur ? '/demandes?statut=ACCEPTEE' : '/reservations'
  const dernierVu = [...messages].reverse().find((m) => m.de_moi && m.lu)
  const toutes = [...messages, ...enCours]
  const reste = LONGUEUR_MAX - texte.length

  return (
    <div className="page page--conversation">
      <EnTetePage
        titre={interlocuteur}
        sousTitre={
          reservation
            ? `${reservation.machine.nom} · ${formaterPeriodeCourte(reservation.date_debut, reservation.date_fin)}`
            : null
        }
      />

      <main className="contenu contenu--moyen conversation">
        <Lien vers={retour} className="lien-retour">← {estDetenteur ? 'Demandes' : 'Mes réservations'}</Lien>

        {etat === 'chargement' && <div className="conversation__chargement squelette" aria-busy="true" aria-label="Chargement" />}

        {etat === 'erreur' && (
          <div className="message" role="alert">
            <p>
              {erreur instanceof ErreurApi && erreur.statut === 404
                ? 'Cette conversation n’existe pas.'
                : messageErreur(erreur)}
            </p>
            <Lien vers={retour} className="bouton bouton--plein">Retour</Lien>
          </div>
        )}

        {etat === 'pret' && toutes.length === 0 && (
          <div className="conversation__vide">
            <p>Aucun message pour l’instant. Convenez ensemble de l’heure et du lieu.</p>
            <div className="suggestions">
              {SUGGESTIONS[utilisateur.type_utilisateur].map((s) => (
                <button key={s} type="button" className="suggestion" onClick={() => setTexte(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {etat === 'pret' && toutes.length > 0 && (
          <ol className="fil" aria-label="Messages" aria-live="polite">
            {toutes.flatMap((m, i) => {
              const date = m.date_envoi ? new Date(m.date_envoi) : new Date()
              const precedent = toutes[i - 1]
              const datePrecedente = precedent && (precedent.date_envoi ? new Date(precedent.date_envoi) : new Date())
              const bulle = <Bulle key={m.id} message={m} vu={m === dernierVu} onReessayer={expedier} />
              if (datePrecedente && datePrecedente.toDateString() === date.toDateString()) return [bulle]
              return [<li key={`jour-${m.id}`} className="fil__jour">{libelleJour(date)}</li>, bulle]
            })}
          </ol>
        )}
      </main>

      {nouveauxEnBas && (
        <button
          type="button"
          className="nouveaux-messages"
          onClick={() => {
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
            setNouveauxEnBas(false)
          }}
        >
          Nouveaux messages ↓
        </button>
      )}

      {etat === 'pret' && (
        <form className="composer" onSubmit={envoyer}>
          {erreurEnvoi && <p className="erreur composer__erreur" role="alert">{erreurEnvoi}</p>}
          <div className="composer__ligne">
            <label className="visuellement-cache" htmlFor="message">Votre message à {interlocuteur}</label>
            <textarea
              id="message"
              ref={champ}
              className="composer__champ"
              rows={1}
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              onKeyDown={touche}
              placeholder="Écrire un message…"
              maxLength={LONGUEUR_MAX}
              enterKeyHint="send"
            />
            <button type="submit" className="composer__envoyer" disabled={!texte.trim()} aria-label="Envoyer">
              <IconeFleche />
            </button>
          </div>
          {reste < 100 && <p className="composer__reste">{reste} caractère{reste > 1 ? 's' : ''} restant{reste > 1 ? 's' : ''}</p>}
        </form>
      )}
    </div>
  )
}
