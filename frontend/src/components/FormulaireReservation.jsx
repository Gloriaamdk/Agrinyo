import { useState } from 'react'
import { creerReservation, ErreurApi, messageErreur } from '../api.js'
import {
  ajouterJours,
  aujourdhui,
  formaterPeriode,
  formaterPeriodeCourte,
  formaterPrix,
  formaterQuantite,
  UNITES,
} from '../format.js'
import { naviguer } from '../routeur.js'
import Lien from './Lien.jsx'
import { useSession } from '../session.jsx'
import { IconeCalendrier, IconeCoche, IconeMoins, IconePlus } from './Icones.jsx'

const CLE_BROUILLON = 'agrilink.brouillon'
const HORIZON_JOURS = 180

// Brouillon gardé pendant la connexion, pour retrouver sa saisie ensuite.
function lireBrouillon(machineId) {
  try {
    const brouillon = JSON.parse(sessionStorage.getItem(CLE_BROUILLON))
    return brouillon?.machine === machineId ? brouillon : null
  } catch {
    return null
  }
}

function ecrireBrouillon(brouillon) {
  try {
    if (brouillon) sessionStorage.setItem(CLE_BROUILLON, JSON.stringify(brouillon))
    else sessionStorage.removeItem(CLE_BROUILLON)
  } catch {
    // Stockage indisponible : la saisie sera simplement à refaire.
  }
}

const finPeriode = (debut, unite, quantite) => (unite === 'JOUR' ? ajouterJours(debut, quantite - 1) : debut)

export default function FormulaireReservation({ machine }) {
  const { utilisateur, estDetenteur } = useSession()
  const unite = UNITES[machine.unite_prix]
  const brouillon = lireBrouillon(machine.id)

  const [date, setDate] = useState(brouillon?.date ?? '')
  const [quantite, setQuantite] = useState(brouillon?.quantite ?? unite.min)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [reservation, setReservation] = useState(null)

  const min = aujourdhui()
  const max = ajouterJours(min, HORIZON_JOURS)
  const fin = date ? finPeriode(date, machine.unite_prix, quantite) : null
  const total = Math.round(machine.prix * quantite)
  const periodes = machine.periodes_reservees ?? []
  const conflit = date && periodes.find((p) => p.debut <= fin && p.fin >= date)
  const saMachine = utilisateur && machine.proprietaire.id === utilisateur.id

  const changerQuantite = (delta) => {
    setErreur(null)
    setQuantite((q) => Math.min(unite.max, Math.max(unite.min, Math.round((q + delta) * 2) / 2)))
  }

  const reserver = async (e) => {
    e.preventDefault()
    if (!date) {
      setErreur({ date_debut: 'Choisissez une date.' })
      return
    }
    if (conflit) return
    if (!utilisateur) {
      ecrireBrouillon({ machine: machine.id, date, quantite })
      naviguer(`/connexion?suite=${encodeURIComponent(`/#machine-${machine.id}`)}`)
      return
    }
    setEnvoi(true)
    setErreur(null)
    try {
      setReservation(await creerReservation({ machine: machine.id, date_debut: date, quantite }))
      ecrireBrouillon(null)
    } catch (err) {
      setErreur(
        err instanceof ErreurApi && (err.champ('date_debut') || err.champ('quantite'))
          ? { date_debut: err.champ('date_debut'), quantite: err.champ('quantite') }
          : { general: messageErreur(err) },
      )
    } finally {
      setEnvoi(false)
    }
  }

  if (reservation) {
    return (
      <div className="confirmation" role="status">
        <span className="confirmation__icone" aria-hidden="true"><IconeCoche /></span>
        <h3>Demande envoyée !</h3>
        <p>
          {formaterPeriode(reservation.date_debut, reservation.date_fin)} ·{' '}
          {formaterQuantite(reservation.quantite, reservation.unite_prix)} ·{' '}
          <strong>{formaterPrix(reservation.montant_estime)}</strong>
        </p>
        <p className="fiche__petit">
          {machine.proprietaire.nom} va accepter ou refuser votre demande. Suivez la réponse dans vos réservations.
        </p>
        <Lien vers="/reservations" className="bouton bouton--plein">Voir mes réservations</Lien>
      </div>
    )
  }

  if (estDetenteur || saMachine) {
    return (
      <p className="reservation__note">
        {saMachine
          ? 'C’est votre machine : vous recevrez les demandes des agriculteurs dans « Demandes ».'
          : 'Les réservations se font avec un compte agriculteur.'}
      </p>
    )
  }

  const erreurDate = conflit
    ? `Déjà réservée (${formaterPeriode(conflit.debut, conflit.fin)}). Choisissez une autre date.`
    : erreur?.date_debut

  return (
    <form className="reservation" onSubmit={reserver} noValidate>
      <div className="reservation__ligne">
        <p className="reservation__prix">
          <span>Prix :</span> <strong>{formaterPrix(machine.prix)}</strong>/{unite.abrege}
        </p>

        <label className="reservation__date">
          <IconeCalendrier />
          <span className="reservation__date-libelle">Date</span>
          <input
            type="date"
            value={date}
            min={min}
            max={max}
            required
            aria-invalid={Boolean(erreurDate)}
            aria-describedby={erreurDate ? 'erreur-date' : undefined}
            onChange={(e) => {
              setDate(e.target.value)
              setErreur(null)
            }}
          />
        </label>
      </div>
      {erreurDate && <p id="erreur-date" className="erreur">{erreurDate}</p>}

      {periodes.length > 0 && (
        <p className="reservation__indispo">
          Déjà réservée : {periodes.map((p) => formaterPeriodeCourte(p.debut, p.fin)).join(', ')}
        </p>
      )}

      <div className="reservation__quantite">
        <span id="libelle-quantite">{unite.libelle}</span>
        <div className="compteur-saisie" role="group" aria-labelledby="libelle-quantite">
          <button type="button" onClick={() => changerQuantite(-unite.pas)} disabled={quantite <= unite.min} aria-label="Diminuer">
            <IconeMoins />
          </button>
          <output aria-live="polite">{formaterQuantite(quantite, machine.unite_prix)}</output>
          <button type="button" onClick={() => changerQuantite(unite.pas)} disabled={quantite >= unite.max} aria-label="Augmenter">
            <IconePlus />
          </button>
        </div>
      </div>
      {erreur?.quantite && <p className="erreur">{erreur.quantite}</p>}

      <p className="reservation__total">
        <span>Total estimé</span>
        <strong>{formaterPrix(total)}</strong>
      </p>
      {date && !conflit && machine.unite_prix === 'JOUR' && quantite > 1 && (
        <p className="fiche__petit">Location {formaterPeriode(date, fin)}</p>
      )}

      {erreur?.general && <p className="erreur" role="alert">{erreur.general}</p>}

      <button type="submit" className="bouton bouton--reserver" disabled={envoi || Boolean(conflit)}>
        {envoi ? 'Envoi…' : utilisateur ? 'Réserver' : 'Se connecter pour réserver'}
      </button>
      <p className="fiche__petit reservation__rassurance">
        Aucun paiement maintenant : le propriétaire doit d’abord accepter votre demande.
      </p>
    </form>
  )
}
