import { naviguer } from '../routeur.js'

/** Lien interne : garde le comportement natif (nouvel onglet, clic milieu…). */
export default function Lien({ vers, onClick, ...props }) {
  const clic = (e) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    naviguer(vers)
  }
  return <a href={vers} onClick={clic} {...props} />
}
