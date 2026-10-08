import { useEffect } from 'react'

const DUREE_MS = 2000

/**
 * Écran de démarrage (maquette verte « AGRILINK ») affiché avant la connexion.
 * Il s'efface tout seul ; un appui permet de passer tout de suite.
 */
export default function EcranDemarrage({ onTermine }) {
  useEffect(() => {
    const minuteur = setTimeout(onTermine, DUREE_MS)
    return () => clearTimeout(minuteur)
  }, [onTermine])

  return (
    <button type="button" className="demarrage" onClick={onTermine} aria-label="AgriLink. Continuer vers la connexion">
      <span className="demarrage__cercle" aria-hidden="true" />
      <span className="demarrage__logo" aria-hidden="true">
        <span className="demarrage__nom">AgriLink</span>
        <span className="demarrage__slogan">« Trouvez. Réservez. Cultivez. »</span>
      </span>
    </button>
  )
}
