import { IconeFeuille } from './Icones.jsx'
import Lien from './Lien.jsx'
import Navigation from './Navigation.jsx'
import { useSession } from '../session.jsx'

export function Marque() {
  const { estDetenteur } = useSession()
  return (
    <Lien vers={estDetenteur ? '/tableau-de-bord' : '/'} className="marque" aria-label="AgriLink, accueil">
      <span className="marque__logo" aria-hidden="true">
        <IconeFeuille />
      </span>
      AgriLink
    </Lien>
  )
}

/** En-tête des pages secondaires : bandeau vert avec le titre, logo et menu sur grand écran. */
export default function EnTetePage({ titre, sousTitre }) {
  return (
    <header className="entete entete--page">
      <div className="entete__interieur">
        <Marque />
        <div className="entete__titres">
          <h1 className="entete__titre">{titre}</h1>
          {sousTitre && <p className="entete__sous-titre">{sousTitre}</p>}
        </div>
        <Navigation variante="haut" />
      </div>
    </header>
  )
}
