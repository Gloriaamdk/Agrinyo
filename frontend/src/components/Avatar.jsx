import { urlMedia } from '../api.js'

/** Photo de profil, ou l'initiale du prénom quand il n'y en a pas. */
export default function Avatar({ nom, photo, grand = false }) {
  const classe = `avatar${grand ? ' avatar--grand' : ''}`
  if (photo) return <img className={`${classe} avatar--photo`} src={urlMedia(photo)} alt="" />
  return (
    <span className={classe} aria-hidden="true">
      {nom?.charAt(0)}
    </span>
  )
}
