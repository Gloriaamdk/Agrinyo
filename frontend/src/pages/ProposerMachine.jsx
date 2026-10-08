import { useState } from 'react'
import { ErreurApi, getMesMachines, getOffre, messageErreur, proposerMachine, useDonnees } from '../api.js'
import { Visuel } from '../components/CarteMachine.jsx'
import CarteOffre from '../components/CarteOffre.jsx'
import EnTetePage from '../components/EnTetePage.jsx'
import { IconePlus } from '../components/Icones.jsx'
import Lien from '../components/Lien.jsx'
import Navigation from '../components/Navigation.jsx'
import { formaterPrix } from '../format.js'
import { naviguer } from '../routeur.js'

const MESSAGE_MAX = 500 // Proposition.LONGUEUR_MAX côté serveur

function Formulaire({ offre, machines }) {
  // Machines du même type d'abord : ce sont elles que l'agriculteur cherche.
  const triees = [...machines].sort(
    (a, b) => (b.type_machine === offre.type_machine) - (a.type_machine === offre.type_machine),
  )
  const possible = (m) => m.disponible && !offre.mes_machines_proposees.includes(m.id)
  const [choisie, setChoisie] = useState(() => triees.find((m) => possible(m) && m.type_machine === offre.type_machine)?.id ?? null)
  const [message, setMessage] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  const envoyer = async (e) => {
    e.preventDefault()
    if (!choisie) return
    setEnvoi(true)
    setErreur(null)
    try {
      await proposerMachine(offre.id, { machine: choisie, message: message.trim() })
      naviguer('/offres?proposee', { remplacer: true })
    } catch (err) {
      setErreur(err instanceof ErreurApi ? (err.champ('machine') ?? messageErreur(err)) : messageErreur(err))
      setEnvoi(false)
    }
  }

  return (
    <form className="formulaire" onSubmit={envoyer} noValidate>
      <fieldset className="choix-machines">
        <legend className="champ__libelle">Choisissez une de vos machines</legend>
        {triees.length === 0 && <p className="champ__aide">Vous n’avez encore aucune machine sur AgriLink.</p>}
        {triees.map((m) => {
          const deja = offre.mes_machines_proposees.includes(m.id)
          return (
            <label key={m.id} className={`choix-machine${possible(m) ? '' : ' choix-machine--impossible'}`}>
              <input
                type="radio"
                name="machine"
                value={m.id}
                checked={choisie === m.id}
                onChange={() => setChoisie(m.id)}
                disabled={!possible(m)}
              />
              <Visuel machine={m} className="choix-machine__visuel" />
              <span className="choix-machine__corps">
                <span className="choix-machine__nom">{m.nom}</span>
                <span className="prix">
                  <strong>{formaterPrix(m.prix)}</strong> / {m.unite_prix_libelle}
                </span>
                <span className="choix-machine__note">
                  {deja
                    ? 'Déjà proposée'
                    : !m.disponible
                      ? 'Indisponible : rendez-la disponible pour la proposer'
                      : m.type_machine === offre.type_machine
                        ? 'Correspond à la recherche'
                        : m.type_machine_libelle}
                </span>
              </span>
            </label>
          )
        })}
      </fieldset>

      <Lien vers={`/mes-machines/ajouter?offre=${offre.id}`} className="bouton bouton--contour bouton--large">
        <IconePlus /> Ajouter une nouvelle machine pour cette offre
      </Lien>

      <label className="champ">
        <span className="champ__libelle">
          Message à l’agriculteur <span className="champ__facultatif">(facultatif)</span>
        </span>
        <textarea
          rows={3}
          maxLength={MESSAGE_MAX}
          placeholder="Ex. : disponible dès la semaine prochaine, chauffeur compris."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>

      {erreur && <p className="erreur" role="alert">{erreur}</p>}

      <button type="submit" className="bouton bouton--plein bouton--large bouton--grand" disabled={envoi || !choisie}>
        {envoi ? 'Envoi…' : 'Envoyer la proposition'}
      </button>
    </form>
  )
}

/** Propriétaire : proposer une machine existante pour une offre, ou en ajouter une. */
export default function ProposerMachine({ id }) {
  const [essai, setEssai] = useState(0)
  const offre = useDonnees(`offre|${id}|${essai}`, (signal) => getOffre(id, signal))
  const machines = useDonnees(`mes-machines|${essai}`, getMesMachines)
  const erreur = offre.erreur ?? machines.erreur

  return (
    <div className="page">
      <EnTetePage titre="Proposer une machine" sousTitre={offre.donnees ? `Pour ${offre.donnees.agriculteur.prenom}, à ${offre.donnees.localisation}` : null} />
      <main className="contenu contenu--etroit">
        <Lien vers="/offres" className="lien-retour">← Offres</Lien>

        {erreur && (
          <div className="message" role="alert">
            <p>
              {erreur instanceof ErreurApi && erreur.statut === 404
                ? 'Cette offre est fermée ou n’existe plus.'
                : messageErreur(erreur)}
            </p>
            {erreur instanceof ErreurApi && erreur.statut === 404 ? (
              <Lien vers="/offres" className="bouton bouton--plein">Voir les offres</Lien>
            ) : (
              <button type="button" className="bouton bouton--plein" onClick={() => setEssai((n) => n + 1)}>Réessayer</button>
            )}
          </div>
        )}

        {!erreur && (offre.etat === 'chargement' || machines.etat === 'chargement') && (
          <div className="carte-formulaire squelette" style={{ height: 360 }} aria-busy="true" aria-label="Chargement" />
        )}

        {offre.etat === 'pret' && machines.etat === 'pret' && (
          <>
            <CarteOffre offre={offre.donnees} titre={`${offre.donnees.agriculteur.prenom} cherche : ${offre.donnees.type_machine_libelle.toLowerCase()}`} />
            <Formulaire offre={offre.donnees} machines={machines.donnees} />
          </>
        )}

      </main>
      <Navigation variante="bas" />
    </div>
  )
}
