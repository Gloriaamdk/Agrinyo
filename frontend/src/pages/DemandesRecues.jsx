import { useState } from 'react'
import { getDemandesRecues, messageErreur, repondreReservation, useDonnees } from '../api.js'
import CarteReservation, { BoutonEcrire } from '../components/CarteReservation.jsx'
import EnTetePage from '../components/EnTetePage.jsx'
import Navigation from '../components/Navigation.jsx'

const FILTRES = [
  { valeur: 'EN_ATTENTE', libelle: 'À traiter' },
  { valeur: 'ACCEPTEE', libelle: 'Acceptées' },
  { valeur: 'REFUSEE', libelle: 'Refusées' },
  { valeur: '', libelle: 'Toutes' },
]

const chevauche = (a, b) => a.date_debut <= b.date_fin && a.date_fin >= b.date_debut

function ActionsProprietaire({ reservation, concurrentes, onRepondue }) {
  const [confirmation, setConfirmation] = useState(null) // 'accept' | 'reject'
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  if (reservation.statut === 'ACCEPTEE') {
    return (
      <div className="resa__actions">
        <BoutonEcrire reservation={reservation} interlocuteur={reservation.agriculteur.nom} />
      </div>
    )
  }
  if (reservation.statut !== 'EN_ATTENTE') return null

  const repondre = async (action) => {
    setEnvoi(true)
    setErreur(null)
    try {
      await repondreReservation(reservation.id, action)
      onRepondue()
    } catch (err) {
      setErreur(messageErreur(err))
      setEnvoi(false)
    }
  }

  return (
    <div className="resa__actions">
      {confirmation === null && (
        <>
          <button type="button" className="bouton bouton--plein bouton--petit" onClick={() => setConfirmation('accept')}>
            Accepter
          </button>
          <button type="button" className="bouton bouton--contour-danger bouton--petit" onClick={() => setConfirmation('reject')}>
            Refuser
          </button>
        </>
      )}
      {confirmation === 'accept' && (
        <div className="resa__confirmer">
          <p>
            Accepter la demande de <strong>{reservation.agriculteur.nom}</strong> ?
            {concurrentes > 0 && (
              <> {concurrentes === 1 ? 'L’autre demande' : `Les ${concurrentes} autres demandes`} sur ces dates
                {concurrentes === 1 ? ' sera refusée' : ' seront refusées'} automatiquement.</>
            )}
          </p>
          <div className="resa__boutons">
            <button type="button" className="bouton bouton--plein bouton--petit" onClick={() => repondre('accept')} disabled={envoi}>
              Oui, accepter
            </button>
            <button type="button" className="bouton bouton--contour bouton--petit" onClick={() => setConfirmation(null)} disabled={envoi}>
              Retour
            </button>
          </div>
        </div>
      )}
      {confirmation === 'reject' && (
        <div className="resa__confirmer">
          <p>Refuser la demande de <strong>{reservation.agriculteur.nom}</strong> ?</p>
          <div className="resa__boutons">
            <button type="button" className="bouton bouton--danger bouton--petit" onClick={() => repondre('reject')} disabled={envoi}>
              Oui, refuser
            </button>
            <button type="button" className="bouton bouton--contour bouton--petit" onClick={() => setConfirmation(null)} disabled={envoi}>
              Retour
            </button>
          </div>
        </div>
      )}
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
    </div>
  )
}

export default function DemandesRecues() {
  // Le tableau de bord peut ouvrir directement un filtre : /demandes?statut=ACCEPTEE.
  const [filtre, setFiltre] = useState(() => {
    const statut = new URLSearchParams(window.location.search).get('statut')
    return FILTRES.some((f) => f.valeur === statut) ? statut : 'EN_ATTENTE'
  })
  const [version, setVersion] = useState(0)
  // Toute la liste d'un coup : compteurs par statut et détection des demandes concurrentes.
  const liste = useDonnees(`demandes|${version}`, (signal) => getDemandesRecues('', signal))
  const demandes = liste.donnees ?? []
  const visibles = filtre ? demandes.filter((d) => d.statut === filtre) : demandes
  const enAttente = demandes.filter((d) => d.statut === 'EN_ATTENTE')
  const nonLus = demandes.reduce((total, d) => total + d.messages_non_lus, 0)

  const concurrentes = (demande) =>
    enAttente.filter((d) => d.id !== demande.id && d.machine.id === demande.machine.id && chevauche(d, demande)).length

  return (
    <div className="page">
      <EnTetePage
        titre="Demandes reçues"
        sousTitre={
          liste.etat === 'pret' && enAttente.length > 0
            ? `${enAttente.length} demande${enAttente.length > 1 ? 's' : ''} à traiter`
            : 'Acceptez ou refusez les demandes des agriculteurs.'
        }
      />

      <main className="contenu contenu--moyen">
        {liste.etat === 'pret' && demandes.length > 0 && (
          <div className="types" role="group" aria-label="Filtrer par statut">
            {FILTRES.map((f) => (
              <button key={f.valeur} type="button" className="type" aria-pressed={filtre === f.valeur} onClick={() => setFiltre(f.valeur)}>
                {f.libelle} ({f.valeur ? demandes.filter((d) => d.statut === f.valeur).length : demandes.length})
                {f.valeur === 'ACCEPTEE' && nonLus > 0 && (
                  <span className="type__point" aria-label={`${nonLus} message${nonLus > 1 ? 's' : ''} non lu${nonLus > 1 ? 's' : ''}`} />
                )}
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

        {liste.etat === 'pret' && demandes.length === 0 && (
          <div className="message">
            <p>Aucune demande pour l’instant. Les demandes des agriculteurs pour vos machines apparaîtront ici.</p>
          </div>
        )}

        {liste.etat === 'pret' && demandes.length > 0 && (
          <ul className="liste-resa">
            {visibles.map((demande) => (
              <li key={demande.id}>
                <CarteReservation reservation={demande} vue="proprietaire">
                  <ActionsProprietaire
                    reservation={demande}
                    concurrentes={concurrentes(demande)}
                    onRepondue={() => setVersion((v) => v + 1)}
                  />
                </CarteReservation>
              </li>
            ))}
            {visibles.length === 0 && <p className="vide">Rien dans cette catégorie.</p>}
          </ul>
        )}
      </main>

      <Navigation variante="bas" />
    </div>
  )
}
