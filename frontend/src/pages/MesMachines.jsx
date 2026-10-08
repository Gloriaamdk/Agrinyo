import { useState } from 'react'
import { getMesMachines, messageErreur, modifierMachine, useDonnees } from '../api.js'
import { Visuel } from '../components/CarteMachine.jsx'
import EnTetePage from '../components/EnTetePage.jsx'
import { IconePlus } from '../components/Icones.jsx'
import Lien from '../components/Lien.jsx'
import Navigation from '../components/Navigation.jsx'
import { formaterPrix } from '../format.js'

/** Interrupteur « Disponible » : un appui suffit, la carte se met à jour sans attendre le serveur. */
export function InterrupteurDisponible({ disponible, onBasculer, desactive, nom }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={disponible}
      aria-label={nom ? `${nom} : disponible à la location` : 'Disponible à la location'}
      className="interrupteur"
      onClick={onBasculer}
      disabled={desactive}
    >
      <span className="interrupteur__piste" aria-hidden="true">
        <span className="interrupteur__bouton" />
      </span>
      <span className="interrupteur__texte">{disponible ? 'Disponible' : 'Indisponible'}</span>
    </button>
  )
}

function CarteMaMachine({ machine, onModifiee }) {
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  const basculer = async () => {
    const avant = machine
    onModifiee({ ...machine, disponible: !machine.disponible })
    setEnvoi(true)
    setErreur(null)
    try {
      const maj = await modifierMachine(machine.id, { disponible: !avant.disponible })
      onModifiee({ ...avant, ...maj })
    } catch (err) {
      onModifiee(avant) // le serveur a refusé : on remet l'état d'avant
      setErreur(messageErreur(err))
    } finally {
      setEnvoi(false)
    }
  }

  const demandes = machine.demandes_en_attente
  return (
    <article className={`ma-machine${machine.disponible ? '' : ' ma-machine--indispo'}`}>
      <Visuel machine={machine} className="ma-machine__visuel" />
      <div className="ma-machine__corps">
        <h3 className="ma-machine__titre">
          {/* Le lien couvre la photo et le texte (voir .ma-machine__lien::after). */}
          <Lien vers={`/mes-machines/${machine.id}`} className="ma-machine__lien">{machine.nom}</Lien>
        </h3>
        <p className="prix">
          <strong>{formaterPrix(machine.prix)}</strong> / {machine.unite_prix_libelle}
        </p>
        <p className="ma-machine__lieu">{machine.localisation}, {machine.zone_libelle}</p>
        {demandes > 0 && (
          <Lien vers="/demandes" className="ma-machine__demandes">
            {demandes} demande{demandes > 1 ? 's' : ''} en attente
          </Lien>
        )}
      </div>
      <div className="ma-machine__pied">
        <InterrupteurDisponible disponible={machine.disponible} onBasculer={basculer} desactive={envoi} nom={machine.nom} />
        <Lien vers={`/mes-machines/${machine.id}`} className="bouton bouton--contour bouton--petit ma-machine__modifier">
          Modifier
        </Lien>
      </div>
      {erreur && <p className="erreur ma-machine__erreur" role="alert">{erreur}</p>}
    </article>
  )
}

export default function MesMachines() {
  const [version, setVersion] = useState(0)
  const [modifiees, setModifiees] = useState({})
  const liste = useDonnees(`mes-machines|${version}`, getMesMachines)
  const machines = (liste.donnees ?? []).map((m) => modifiees[m.id] ?? m)
  const disponibles = machines.filter((m) => m.disponible).length

  return (
    <div className="page">
      <EnTetePage
        titre="Mes machines"
        sousTitre={
          liste.etat === 'pret' && machines.length > 0
            ? `${machines.length} machine${machines.length > 1 ? 's' : ''}, ${disponibles} disponible${disponibles > 1 ? 's' : ''}`
            : 'Publiez vos machines pour les louer aux agriculteurs.'
        }
      />

      <main className="contenu contenu--moyen">
        <Lien vers="/mes-machines/ajouter" className="bouton bouton--plein bouton--large bouton--grand">
          <IconePlus /> Ajouter une machine
        </Lien>

        {liste.etat === 'chargement' && (
          <div className="liste-resa" aria-hidden="true">
            {[0, 1, 2].map((i) => <div key={i} className="resa squelette" style={{ height: 150 }} />)}
          </div>
        )}

        {liste.etat === 'erreur' && (
          <div className="message" role="alert">
            <p>{messageErreur(liste.erreur)}</p>
            <button type="button" className="bouton bouton--plein" onClick={() => setVersion((v) => v + 1)}>Réessayer</button>
          </div>
        )}

        {liste.etat === 'pret' && machines.length === 0 && (
          <div className="message">
            <p>Vous n’avez encore publié aucune machine. Ajoutez-en une : les agriculteurs pourront la réserver.</p>
          </div>
        )}

        {liste.etat === 'pret' && machines.length > 0 && (
          <ul className="liste-resa">
            {machines.map((machine) => (
              <li key={machine.id}>
                <CarteMaMachine machine={machine} onModifiee={(maj) => setModifiees((m) => ({ ...m, [maj.id]: maj }))} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <Navigation variante="bas" />
    </div>
  )
}
