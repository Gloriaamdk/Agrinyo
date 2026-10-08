import { useState } from 'react'
import { IconeCadenas, IconeOeil, IconeRetour } from './Icones.jsx'

/**
 * Champ de la maquette : pastille grise avec une icône à gauche.
 * Le libellé reste lu par les lecteurs d'écran ; à l'écran, il sert de texte indicatif.
 */
export function Champ({ libelle, Icone, prefixe, erreur, aide, apres, ...attributs }) {
  return (
    <label className="champ-icone">
      <span className="visuellement-cache">{libelle}</span>
      <span className="champ-icone__boite">
        <Icone className="champ-icone__icone" />
        {prefixe && <span className="champ-icone__prefixe" aria-hidden="true">{prefixe}</span>}
        <input placeholder={libelle} aria-invalid={Boolean(erreur)} {...attributs} />
        {apres}
      </span>
      {aide && !erreur && <span className="champ__aide">{aide}</span>}
      {erreur && <span className="erreur">{erreur}</span>}
    </label>
  )
}

export function ChampMotDePasse({ valeur, onChange, erreur, nouveau = false, libelle = 'Mot de passe' }) {
  const [visible, setVisible] = useState(false)
  return (
    <Champ
      libelle={libelle}
      Icone={IconeCadenas}
      type={visible ? 'text' : 'password'}
      autoComplete={nouveau ? 'new-password' : 'current-password'}
      value={valeur}
      onChange={(e) => onChange(e.target.value)}
      erreur={erreur}
      aide={nouveau ? '8 caractères minimum, pas seulement des chiffres.' : null}
      required
      apres={
        <button
          type="button"
          className="champ-icone__oeil"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        >
          <IconeOeil barre={!visible} />
        </button>
      }
    />
  )
}

/** Bouton principal de la maquette : pilule verte avec une flèche dans un rond. */
export function BoutonFleche({ children, ...attributs }) {
  return (
    <button type="submit" className="bouton-fleche" {...attributs}>
      <span>{children}</span>
      <span className="bouton-fleche__rond" aria-hidden="true">
        <IconeRetour />
      </span>
    </button>
  )
}
