import { useState } from 'react'
import { getTableauDeBord, messageErreur, useDonnees } from '../api.js'
import CarteReservation, { BoutonEcrire } from '../components/CarteReservation.jsx'
import EnTetePage from '../components/EnTetePage.jsx'
import { IconeDemandes, IconeReservations, IconeTracteur } from '../components/Icones.jsx'
import Lien from '../components/Lien.jsx'
import Navigation from '../components/Navigation.jsx'
import { useSession } from '../session.jsx'

function Chiffre({ vers, valeur, libelle, Icone, accent }) {
  return (
    <Lien vers={vers} className={`chiffre${accent ? ' chiffre--accent' : ''}`}>
      <Icone className="chiffre__icone" />
      <strong className="chiffre__valeur">{valeur ?? '–'}</strong>
      <span className="chiffre__libelle">{libelle}</span>
    </Lien>
  )
}

/** Accueil du propriétaire (PRD) : ses chiffres clés et les prochaines réservations. */
export default function TableauDeBord() {
  const { utilisateur } = useSession()
  const [essai, setEssai] = useState(0)
  // Compteurs et prochaines réservations calculés par le serveur (GET /api/dashboard/).
  const tableau = useDonnees(`tdb|${essai}`, getTableauDeBord)
  const chiffres = tableau.donnees
  const enAttente = chiffres?.demandes_en_attente
  const aVenir = chiffres?.reservations_a_venir
  const prochaines = chiffres?.prochaines_reservations ?? []

  return (
    <div className="page">
      <EnTetePage titre={`Bonjour ${utilisateur.first_name}`} sousTitre="Voici où en sont vos machines." />

      <main className="contenu contenu--moyen">
        {tableau.erreur ? (
          <div className="message" role="alert">
            <p>{messageErreur(tableau.erreur)}</p>
            <button type="button" className="bouton bouton--plein" onClick={() => setEssai((n) => n + 1)}>Réessayer</button>
          </div>
        ) : (
          <>
            <nav className="chiffres" aria-label="Résumé">
              <Chiffre vers="/mes-machines" valeur={chiffres?.nombre_machines} libelle="Mes machines" Icone={IconeTracteur} />
              <Chiffre
                vers="/demandes"
                valeur={enAttente}
                libelle={`Demande${enAttente > 1 ? 's' : ''} en attente`}
                Icone={IconeDemandes}
                accent={enAttente > 0}
              />
              <Chiffre
                vers="/demandes?statut=ACCEPTEE"
                valeur={aVenir}
                libelle={`Réservation${aVenir > 1 ? 's' : ''} à venir`}
                Icone={IconeReservations}
              />
            </nav>

            <section aria-labelledby="titre-prochaines" aria-busy={tableau.etat === 'chargement'}>
              <div className="section__entete">
                <h2 id="titre-prochaines" className="section__titre">Prochaines réservations</h2>
                {aVenir > prochaines.length && (
                  <Lien vers="/demandes?statut=ACCEPTEE" className="lien-voir-tout">Tout voir</Lien>
                )}
              </div>

              {tableau.etat === 'chargement' && (
                <div className="liste-resa" aria-hidden="true">
                  {[0, 1].map((i) => <div key={i} className="resa squelette" style={{ height: 130 }} />)}
                </div>
              )}

              {tableau.etat === 'pret' && prochaines.length === 0 && (
                <div className="message">
                  <p>
                    {enAttente > 0
                      ? 'Aucune réservation acceptée pour l’instant. Des demandes attendent votre réponse.'
                      : 'Aucune réservation à venir.'}
                  </p>
                  {enAttente > 0 ? (
                    <Lien vers="/demandes" className="bouton bouton--plein">Répondre aux demandes</Lien>
                  ) : chiffres.nombre_machines === 0 ? (
                    <Lien vers="/mes-machines/ajouter" className="bouton bouton--plein">Ajouter une machine</Lien>
                  ) : null}
                </div>
              )}

              {prochaines.length > 0 && (
                <ul className="liste-resa">
                  {prochaines.map((reservation) => (
                    <li key={reservation.id}>
                      <CarteReservation reservation={reservation} vue="proprietaire">
                        <div className="resa__actions">
                          <BoutonEcrire reservation={reservation} interlocuteur={reservation.agriculteur.nom} />
                        </div>
                      </CarteReservation>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <Navigation variante="bas" />
    </div>
  )
}
