import Avatar from '../components/Avatar.jsx'
import { formaterTelephone } from '../format.js'
import EnTetePage from '../components/EnTetePage.jsx'
import { IconeSortie } from '../components/Icones.jsx'
import Navigation from '../components/Navigation.jsx'
import { naviguer } from '../routeur.js'
import Lien from '../components/Lien.jsx'
import { useSession } from '../session.jsx'

export default function Profil() {
  const { utilisateur, estDetenteur, seDeconnecter } = useSession()

  const deconnexion = async () => {
    await seDeconnecter()
    naviguer('/', { remplacer: true })
  }

  return (
    <div className="page">
      <EnTetePage titre="Mon profil" />

      <main className="contenu contenu--etroit">
        <section className="profil">
          <Avatar nom={utilisateur.first_name} photo={utilisateur.photo} grand />
          <div>
            <h2 className="profil__nom">{utilisateur.nom_complet}</h2>
            <p className="profil__role">{utilisateur.type_utilisateur_libelle}</p>
          </div>
        </section>

        <dl className="profil__infos">
          {/* Les anciens comptes ont leur numéro comme nom d'utilisateur : inutile de l'afficher deux fois. */}
          {!utilisateur.username.startsWith('+') && (
            <div>
              <dt>Nom d’utilisateur</dt>
              <dd>{utilisateur.username}</dd>
            </div>
          )}
          <div>
            <dt>Téléphone</dt>
            <dd>{formaterTelephone(utilisateur.telephone)}</dd>
          </div>
          {utilisateur.email && (
            <div>
              <dt>E-mail</dt>
              <dd>{utilisateur.email}</dd>
            </div>
          )}
          {utilisateur.localisation && (
            <div>
              <dt>Localisation</dt>
              <dd>{utilisateur.localisation}</dd>
            </div>
          )}
        </dl>

        <Lien vers="/profil/modifier" className="bouton bouton--contour bouton--large">
          Modifier le profil
        </Lien>
        <Lien vers={estDetenteur ? '/tableau-de-bord' : '/reservations'} className="bouton bouton--plein bouton--large">
          {estDetenteur ? 'Voir mon tableau de bord' : 'Voir mes réservations'}
        </Lien>
        <button type="button" className="bouton bouton--contour bouton--large" onClick={deconnexion}>
          <IconeSortie /> Se déconnecter
        </button>
      </main>

      <Navigation variante="bas" />
    </div>
  )
}
