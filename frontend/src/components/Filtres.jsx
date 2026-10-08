import { IconeChevron, IconeEffacer, IconeLoupe, IconeRepere } from './Icones.jsx'

/** « Localisation » de l'en-tête vert : un sélecteur natif invisible posé sur le texte. */
export function ChoixZone({ zones, zone, onChange }) {
  const libelle = zones.find((z) => z.valeur === zone)?.libelle
  return (
    <label className="localisation">
      <span className="localisation__libelle">Localisation</span>
      <span className="localisation__valeur">
        <IconeRepere className="localisation__repere" />
        {libelle ? `${libelle}, Togo` : 'Tout le Togo'}
        <IconeChevron />
      </span>
      {/* La liste du téléphone s'ouvre au toucher. */}
      <select className="localisation__select" value={zone} onChange={(e) => onChange(e.target.value)} aria-label="Choisir la zone">
        <option value="">Tout le Togo</option>
        {zones.map((z) => (
          <option key={z.valeur} value={z.valeur}>
            Région {z.libelle}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Champ de recherche de l'en-tête vert. onSubmit : appelé à la validation (touche « Rechercher »). */
export function ChampRecherche({ valeur, onChange, onSubmit, autoFocus = false }) {
  const valider = (e) => {
    e.preventDefault()
    onSubmit?.(valeur.trim())
  }
  return (
    <form className="recherche" role="search" onSubmit={valider}>
      <IconeLoupe className="recherche__loupe" />
      <input
        type="search"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher une machine"
        aria-label="Rechercher une machine, une ville ou un propriétaire"
        enterKeyHint="search"
        autoFocus={autoFocus}
      />
      {valeur && (
        <button type="button" className="recherche__effacer" onClick={() => onChange('')} aria-label="Effacer la recherche">
          <IconeEffacer />
        </button>
      )}
    </form>
  )
}
