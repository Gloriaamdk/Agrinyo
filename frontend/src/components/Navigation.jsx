import { getDemandesRecues, useDonnees } from '../api.js'
import { useMessagesNonLus, usePropositionsNonVues } from '../hooks.js'
import { useChemin } from '../routeur.js'
import Lien from './Lien.jsx'
import { useSession } from '../session.jsx'
import {
  IconeDemandes, IconeMaison, IconeOffre, IconeProfil, IconeReservations, IconeTableau, IconeTracteur,
} from './Icones.jsx'

/**
 * Navigation principale, selon le rôle (PRD) :
 * agriculteur (et visiteur) → Accueil | Machines | Offres | Réservations | Profil
 * Pastilles : demandes à traiter, messages non lus.
 * propriétaire              → Tableau de bord | Mes machines | Offres | Demandes | Profil
 * Sur téléphone : barre fixée en bas (variante « bas ») ; sur grand écran : dans l'en-tête (« haut »).
 * sansCompte : sans l'entrée Profil / Connexion, quand la page a déjà son bouton « Se connecter ».
 */
export default function Navigation({ variante, sansCompte = false }) {
  const chemin = useChemin()
  const { utilisateur, estDetenteur } = useSession()

  // Pastille du nombre de demandes à traiter, rafraîchie à chaque changement de page.
  const enAttente = useDonnees(estDetenteur ? `nav-demandes|${chemin}` : null, (signal) =>
    getDemandesRecues('EN_ATTENTE', signal),
  )
  const nombreEnAttente = enAttente.donnees?.length ?? 0
  // Messages non lus : sur « Réservations » (agriculteur) ou « Demandes » (propriétaire),
  // là où se trouvent les réservations acceptées et leur bouton « Écrire ».
  const nonLus = useMessagesNonLus(Boolean(utilisateur), chemin)
  const propositions = usePropositionsNonVues(Boolean(utilisateur) && !estDetenteur, chemin)
  const detailPastille = (...parties) => parties.filter(([n]) => n > 0).map(([n, texte]) => `${n} ${texte}`).join(', ')

  const profil = { vers: '/profil', libelle: utilisateur ? 'Profil' : 'Connexion', Icone: IconeProfil }
  const entrees = estDetenteur
    ? [
        { vers: '/tableau-de-bord', libelle: 'Tableau de bord', Icone: IconeTableau },
        { vers: '/mes-machines', libelle: 'Mes machines', Icone: IconeTracteur },
        { vers: '/offres', libelle: 'Offres', Icone: IconeOffre },
        {
          vers: '/demandes',
          libelle: 'Demandes',
          Icone: IconeDemandes,
          pastille: nombreEnAttente + nonLus,
          detail: detailPastille([nombreEnAttente, 'en attente'], [nonLus, 'message(s) non lu(s)']),
        },
        profil,
      ]
    : [
        { vers: '/', libelle: 'Accueil', Icone: IconeMaison },
        { vers: '/machines', libelle: 'Machines', Icone: IconeTracteur },
        {
          vers: '/offres',
          libelle: 'Offres',
          Icone: IconeOffre,
          pastille: propositions,
          detail: detailPastille([propositions, 'nouvelle(s) proposition(s)']),
        },
        {
          vers: '/reservations',
          libelle: 'Réservations',
          Icone: IconeReservations,
          pastille: nonLus,
          detail: detailPastille([nonLus, 'message(s) non lu(s)']),
        },
        profil,
      ]
  const visibles = sansCompte ? entrees.filter((e) => e !== profil) : entrees

  // « Mes machines » reste actif sur ses sous-pages (ajout, modification).
  const actif = (vers) => chemin === vers || (vers !== '/' && chemin.startsWith(`${vers}/`))

  return (
    <nav className={`nav nav--${variante}`} aria-label="Navigation principale">
      {visibles.map(({ vers, libelle, Icone, pastille, detail }) => (
        <Lien key={vers} vers={vers} className="nav__entree" aria-current={actif(vers) ? 'page' : undefined}>
          <span className="nav__icone">
            <Icone />
            {pastille > 0 && (
              <span className="nav__pastille" aria-label={detail}>{pastille > 99 ? '99+' : pastille}</span>
            )}
          </span>
          <span>{libelle}</span>
        </Lien>
      ))}
    </nav>
  )
}
