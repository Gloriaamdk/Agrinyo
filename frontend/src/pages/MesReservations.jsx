import { useState } from 'react'
import { getMesReservations, messageErreur, repondreReservation, useDonnees } from '../api.js'
import CarteReservation, { BoutonEcrire } from '../components/CarteReservation.jsx'
import EnTetePage from '../components/EnTetePage.jsx'
import Navigation from '../components/Navigation.jsx'
import Lien from '../components/Lien.jsx'

const FILTRES = [
  { valeur: '', libelle: 'Toutes' },
  { valeur: 'EN_ATTENTE', libelle: 'En attente' },
  { valeur: 'ACCEPTEE', libelle: 'Acceptées' },
  { valeur: 'FINIES', libelle: 'Refusées / annulées', statuts: ['REFUSEE', 'ANNULEE'] },
]

function ActionsAgriculteur({ reservation, onModifiee }) {
  const [confirmation, setConfirmation] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  if (reservation.statut === 'ACCEPTEE') {
    return (
      <div className="resa__actions">
        <p className="resa__info">Le propriétaire a accepté. Écrivez-lui pour convenir de l’heure et du lieu.</p>
        <BoutonEcrire reservation={reservation} interlocuteur={reservation.machine.proprietaire.nom} />
      </div>
    )
  }
  if (reservation.statut === 'REFUSEE') {
    return <p className="resa__info resa__info--neutre">Le propriétaire n’est pas disponible. Essayez une autre date ou une autre machine.</p>
  }
  if (reservation.statut !== 'EN_ATTENTE') return null

  const annuler = async () => {
    setEnvoi(true)
    setErreur(null)
    try {
      onModifiee(await repondreReservation(reservation.id, 'cancel'))
    } catch (err) {
      setErreur(messageErreur(err))
      setEnvoi(false)
    }
  }

  return (
    <div className="resa__actions">
      {confirmation ? (
        <>
          <span className="resa__question">Annuler cette demande ?</span>
          <button type="button" className="bouton bouton--danger bouton--petit" onClick={annuler} disabled={envoi}>
            Oui, annuler
          </button>
          <button type="button" className="bouton bouton--contour bouton--petit" onClick={() => setConfirmation(false)} disabled={envoi}>
            Non
          </button>
        </>
      ) : (
        <button type="button" className="bouton bouton--contour bouton--petit" onClick={() => setConfirmation(true)}>
          Annuler la demande
        </button>
      )}
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
    </div>
  )
}

export default function MesReservations() {
  const [filtre, setFiltre] = useState('')
  const [version, setVersion] = useState(0)
  const [modifiees, setModifiees] = useState({})
  const liste = useDonnees(`mes-reservations|${version}`, getMesReservations)

  // Les changements faits ici s'appliquent tout de suite, sans recharger la liste.
  const reservations = (liste.donnees ?? []).map((r) => modifiees[r.id] ?? r)
  const { statuts, valeur } = FILTRES.find((f) => f.valeur === filtre)
  const visibles = valeur ? reservations.filter((r) => (statuts ?? [valeur]).includes(r.statut)) : reservations
  const compter = (f) => (f.valeur ? reservations.filter((r) => (f.statuts ?? [f.valeur]).includes(r.statut)).length : reservations.length)

  return (
    <div className="page">
      <EnTetePage titre="Mes réservations" sousTitre="Suivez la réponse des propriétaires." />

      <main className="contenu contenu--moyen">
        {liste.etat === 'pret' && reservations.length > 0 && (
          <div className="types" role="group" aria-label="Filtrer par statut">
            {FILTRES.map((f) => (
              <button key={f.valeur} type="button" className="type" aria-pressed={filtre === f.valeur} onClick={() => setFiltre(f.valeur)}>
                {f.libelle} ({compter(f)})
              </button>
            ))}
          </div>
        )}

        {liste.etat === 'chargement' && (
          <div className="liste-resa" aria-hidden="true">
            {[0, 1, 2].map((i) => <div key={i} className="resa squelette" style={{ height: 130 }} />)}
          </div>
        )}

        {liste.etat === 'erreur' && (
          <div className="message" role="alert">
            <p>{messageErreur(liste.erreur)}</p>
            <button type="button" className="bouton bouton--plein" onClick={() => setVersion((v) => v + 1)}>Réessayer</button>
          </div>
        )}

        {liste.etat === 'pret' && reservations.length === 0 && (
          <div className="message">
            <p>Vous n’avez encore fait aucune demande de réservation.</p>
            <Lien vers="/machines" className="bouton bouton--plein">Trouver une machine</Lien>
          </div>
        )}

        {liste.etat === 'pret' && reservations.length > 0 && (
          <ul className="liste-resa">
            {visibles.map((reservation) => (
              <li key={reservation.id}>
                <CarteReservation reservation={reservation} vue="agriculteur">
                  <ActionsAgriculteur
                    reservation={reservation}
                    onModifiee={(maj) => setModifiees((m) => ({ ...m, [maj.id]: maj }))}
                  />
                </CarteReservation>
              </li>
            ))}
            {visibles.length === 0 && <p className="vide">Aucune réservation dans cette catégorie.</p>}
          </ul>
        )}
      </main>

      <Navigation variante="bas" />
    </div>
  )
}
