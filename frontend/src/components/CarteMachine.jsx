import { useState } from 'react'
import { urlMedia } from '../api.js'
import { formaterPrix, iconeMachine } from '../format.js'
import { IconeCoeur } from './Icones.jsx'

export function Visuel({ machine, className, prioritaire = false }) {
  const [echec, setEchec] = useState(false)
  return (
    <div className={className} aria-hidden="true">
      {machine.photo && !echec ? (
        <img
          src={urlMedia(machine.photo)}
          alt=""
          width="560"
          height="420"
          loading={prioritaire ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setEchec(true)}
        />
      ) : (
        <span className="visuel__icone">{iconeMachine(machine.type_machine)}</span>
      )}
    </div>
  )
}

export function BoutonFavori({ actif, onBasculer, nom }) {
  return (
    <button
      type="button"
      className="favori"
      aria-pressed={actif}
      aria-label={actif ? `Retirer ${nom} des favoris` : `Ajouter ${nom} aux favoris`}
      onClick={onBasculer}
    >
      <IconeCoeur plein={actif} />
    </button>
  )
}

export default function CarteMachine({ machine, favori, onFavori, onOuvrir }) {
  return (
    <article className="carte">
      <Visuel machine={machine} className="carte__visuel" />
      <span className="carte__type">{machine.type_machine_libelle}</span>
      <h3 className="carte__titre">
        {/* Le bouton s'étend sur toute la carte (voir .carte__lien::after). */}
        <button type="button" className="carte__lien" onClick={() => onOuvrir(machine.id)}>
          {machine.nom}
        </button>
      </h3>
      <p className="carte__ligne">{machine.localisation}, {machine.zone_libelle}</p>
      <p className="carte__ligne">Par {machine.proprietaire.nom}</p>
      <p className="prix">
        <strong>{formaterPrix(machine.prix)}</strong> / {machine.unite_prix_libelle}
      </p>
      <BoutonFavori actif={favori} nom={machine.nom} onBasculer={() => onFavori(machine.id)} />
    </article>
  )
}
