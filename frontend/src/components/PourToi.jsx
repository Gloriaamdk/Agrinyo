import { useEffect, useRef, useState } from 'react'
import { formaterPrix } from '../format.js'
import { Visuel } from './CarteMachine.jsx'
import { IconeFleche } from './Icones.jsx'

const INTERVALLE = 5000
const ECART = 12 // doit correspondre au gap de .pourtoi

// Bandeau « #PourToi » : défilement natif avec accroche (scroll-snap), sans bibliothèque.
export default function PourToi({ machines, onOuvrir }) {
  const piste = useRef(null)
  const enPause = useRef(false)
  const [actif, setActif] = useState(0)

  const allerA = (index) => {
    const el = piste.current
    if (!el) return
    const cible = (index + machines.length) % machines.length
    const largeur = el.firstElementChild.offsetWidth + ECART
    el.scrollTo({ left: cible * largeur, behavior: 'smooth' })
  }

  const suivreDefilement = () => {
    const el = piste.current
    const largeur = el.firstElementChild.offsetWidth + ECART
    setActif(Math.round(el.scrollLeft / largeur))
  }

  // Défilement automatique, interrompu dès que la personne touche ou survole le bandeau.
  useEffect(() => {
    if (machines.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const minuteur = setInterval(() => {
      if (!enPause.current && document.visibilityState === 'visible') {
        allerA(actif + 1)
      }
    }, INTERVALLE)
    return () => clearInterval(minuteur)
    // allerA ne dépend que de machines.length, déjà dans les dépendances.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, machines.length])

  const pause = () => {
    enPause.current = true
  }
  const reprise = () => {
    enPause.current = false
  }

  return (
    <div className="pourtoi-cadre" onPointerEnter={pause} onPointerLeave={reprise} onTouchStart={pause}>
      <ul className="pourtoi" ref={piste} onScroll={suivreDefilement} aria-label="Nouveautés">
        {machines.map((machine, i) => (
          <li key={machine.id} className="pourtoi__diapo">
            <Visuel machine={machine} className="pourtoi__visuel" prioritaire={i === 0} />
            <div className="pourtoi__texte">
              <span className="pastille">Nouveau !</span>
              <h3 className="pourtoi__titre">
                <button type="button" className="carte__lien" onClick={() => onOuvrir(machine.id)}>
                  {machine.nom}
                </button>
              </h3>
              <p>Prêt à utiliser · {machine.localisation}</p>
              <p className="pourtoi__prix">
                <strong>{formaterPrix(machine.prix)}</strong> / {machine.unite_prix_libelle}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {machines.length > 1 && (
        <>
          <button type="button" className="pourtoi__fleche pourtoi__fleche--gauche" onClick={() => allerA(actif - 1)} aria-label="Nouveauté précédente">
            <IconeFleche sens="gauche" />
          </button>
          <button type="button" className="pourtoi__fleche pourtoi__fleche--droite" onClick={() => allerA(actif + 1)} aria-label="Nouveauté suivante">
            <IconeFleche />
          </button>
          <div className="points">
            {machines.map((machine, i) => (
              <button
                key={machine.id}
                type="button"
                className="point"
                aria-label={`Afficher ${machine.nom}`}
                aria-current={i === actif ? 'true' : undefined}
                onClick={() => allerA(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
