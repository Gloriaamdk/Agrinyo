import { useEffect } from 'react'
import Accueil from './pages/Accueil.jsx'
import Bienvenue from './pages/Bienvenue.jsx'
import Connexion from './pages/Connexion.jsx'
import Conversation from './pages/Conversation.jsx'
import DemandesRecues from './pages/DemandesRecues.jsx'
import FormulaireMachine from './pages/FormulaireMachine.jsx'
import FormulaireOffre from './pages/FormulaireOffre.jsx'
import Machines from './pages/Machines.jsx'
import MesMachines from './pages/MesMachines.jsx'
import MesReservations from './pages/MesReservations.jsx'
import Offres from './pages/Offres.jsx'
import ModifierProfil from './pages/ModifierProfil.jsx'
import Profil from './pages/Profil.jsx'
import ProposerMachine from './pages/ProposerMachine.jsx'
import TableauDeBord from './pages/TableauDeBord.jsx'
import { adresseCourante, naviguer, useChemin } from './routeur.js'
import { useSession } from './session.jsx'

// role : null = page publique ; 'connecte' = tout compte ; sinon le type d'utilisateur exigé.
const PAGES = {
  '/': { Page: Accueil, role: null, titre: 'Machines agricoles' },
  '/machines': { Page: Machines, role: null, titre: 'Machines disponibles' },
  '/connexion': { Page: Connexion, role: null, titre: 'Connexion' },
  '/reservations': { Page: MesReservations, role: 'AGRICULTEUR', titre: 'Mes réservations' },
  '/tableau-de-bord': { Page: TableauDeBord, role: 'DETENTEUR', titre: 'Tableau de bord' },
  '/mes-machines': { Page: MesMachines, role: 'DETENTEUR', titre: 'Mes machines' },
  '/mes-machines/ajouter': { Page: FormulaireMachine, role: 'DETENTEUR', titre: 'Ajouter une machine' },
  '/demandes': { Page: DemandesRecues, role: 'DETENTEUR', titre: 'Demandes reçues' },
  '/offres': { Page: Offres, role: 'connecte', titre: 'Offres' },
  '/offres/nouvelle': { Page: FormulaireOffre, role: 'AGRICULTEUR', titre: 'Lancer une offre' },
  '/profil': { Page: Profil, role: 'connecte', titre: 'Mon profil' },
  '/profil/modifier': { Page: ModifierProfil, role: 'connecte', titre: 'Modifier le profil' },
}

/** Page du chemin, avec ses paramètres (/mes-machines/12 → { id: 12 }, /conversations/7 → { id: 7 }). */
function trouverPage(chemin) {
  if (PAGES[chemin]) return { ...PAGES[chemin], params: {} }
  const machine = chemin.match(/^\/mes-machines\/(\d+)$/)
  if (machine) {
    return { Page: FormulaireMachine, role: 'DETENTEUR', titre: 'Modifier la machine', params: { id: Number(machine[1]) } }
  }
  const offre = chemin.match(/^\/offres\/(\d+)\/proposer$/)
  if (offre) {
    return { Page: ProposerMachine, role: 'DETENTEUR', titre: 'Proposer une machine', params: { id: Number(offre[1]) } }
  }
  const conversation = chemin.match(/^\/conversations\/(\d+)$/)
  if (conversation) {
    return { Page: Conversation, role: 'connecte', titre: 'Conversation', params: { id: Number(conversation[1]) } }
  }
  return { ...PAGES['/'], params: {} }
}

export default function App() {
  const chemin = useChemin()
  const { utilisateur, etat } = useSession()
  const page = trouverPage(chemin)
  // « / » : présentation pour les visiteurs, accueil de l'agriculteur, tableau de bord du propriétaire.
  const racine = chemin === '/'
  const presentation = racine && !utilisateur
  const titre = presentation ? 'Location de machines agricoles au Togo' : page.titre

  const redirection = racine
    ? etat === 'pret' && utilisateur?.type_utilisateur === 'DETENTEUR' ? '/tableau-de-bord' : null
    : etat !== 'pret' || !page.role
      ? null
      : !utilisateur
        ? `/connexion?suite=${encodeURIComponent(adresseCourante())}`
        : page.role !== 'connecte' && utilisateur.type_utilisateur !== page.role
          ? utilisateur.type_utilisateur === 'DETENTEUR' ? '/tableau-de-bord' : '/reservations'
          : null

  useEffect(() => {
    if (redirection) naviguer(redirection, { remplacer: true })
  }, [redirection])

  useEffect(() => {
    document.title = `AgriLink — ${titre}`
  }, [titre])

  // Déjà connecté : la page de connexion n'a plus d'objet.
  useEffect(() => {
    if (chemin === '/connexion' && utilisateur) naviguer('/', { remplacer: true })
  }, [chemin, utilisateur])

  // Sur « / », on attend de savoir qui est là : pas d'éclair de la présentation pour un compte connecté.
  if ((page.role || racine) && (etat !== 'pret' || redirection)) {
    return <div className="page-chargement" aria-busy="true" aria-label="Chargement" />
  }
  const { params } = page
  const Page = presentation ? Bienvenue : page.Page
  // La clé remet la page à zéro quand on passe d'une machine à l'autre.
  return <Page key={chemin} {...params} />
}
