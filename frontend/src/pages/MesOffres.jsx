import { useEffect, useState } from 'react'
import { fermerOffre, getMesOffres, marquerPropositionsVues, messageErreur, useDonnees } from '../api.js'
import { Visuel } from '../components/CarteMachine.jsx'
import CarteOffre from '../components/CarteOffre.jsx'
import EnTetePage from '../components/EnTetePage.jsx'
import { IconePlus } from '../components/Icones.jsx'
import Lien from '../components/Lien.jsx'
import Navigation from '../components/Navigation.jsx'
import { formaterPrix } from '../format.js'
import { EVENEMENT_PROPOSITIONS_VUES } from '../hooks.js'

/** Machine proposée par un propriétaire : un appui ouvre sa fiche pour réserver. */
function Proposition({ proposition }) {
  const { machine } = proposition
  return (
    <li>
      <Lien vers={`/machines#machine-${machine.id}`} className="proposition">
        <Visuel machine={machine} className="proposition__visuel" />
        <span className="proposition__corps">
          <span className="proposition__nom">
            {machine.nom}
            {proposition.nouvelle && <span className="proposition__nouvelle">Nouveau</span>}
          </span>
          <span className="proposition__ligne">
            {machine.proprietaire.nom} · {machine.localisation}
          </span>
          <span className="prix">
            <strong>{formaterPrix(machine.prix)}</strong> / {machine.unite_prix_libelle}
          </span>
          {proposition.message && <span className="proposition__message">« {proposition.message} »</span>}
        </span>
        <span className="proposition__action" aria-hidden="true">Voir ›</span>
      </Lien>
    </li>
  )
}

function Fermer({ offre, onFermee }) {
  const [confirmation, setConfirmation] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  const fermer = async () => {
    setEnvoi(true)
    setErreur(null)
    try {
      onFermee(await fermerOffre(offre.id))
    } catch (err) {
      setErreur(messageErreur(err))
      setEnvoi(false)
    }
  }

  return (
    <div className="resa__actions">
      {confirmation ? (
        <>
          <span className="resa__question">Fermer cette offre ? Les propriétaires ne la verront plus.</span>
          <button type="button" className="bouton bouton--danger bouton--petit" onClick={fermer} disabled={envoi}>
            Oui, fermer
          </button>
          <button type="button" className="bouton bouton--contour bouton--petit" onClick={() => setConfirmation(false)} disabled={envoi}>
            Non
          </button>
        </>
      ) : (
        <button type="button" className="bouton bouton--contour bouton--petit" onClick={() => setConfirmation(true)}>
          J’ai trouvé / fermer l’offre
        </button>
      )}
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
    </div>
  )
}

/** Agriculteur : ses offres et les machines que les propriétaires lui proposent. */
export default function MesOffres() {
  const [version, setVersion] = useState(0)
  const [fermees, setFermees] = useState({})
  const liste = useDonnees(`mes-offres|${version}`, getMesOffres)
  const offres = (liste.donnees ?? []).map((o) => fermees[o.id] ?? o)
  const ouvertes = offres.filter((o) => o.statut === 'OUVERTE')
  const anciennes = offres.filter((o) => o.statut !== 'OUVERTE')

  // Propositions affichées (le badge « Nouveau » reste à l'écran) : on les marque vues, puis la pastille suit.
  const nouvelles = offres.some((o) => o.propositions.some((p) => p.nouvelle))
  useEffect(() => {
    if (!nouvelles) return
    marquerPropositionsVues()
      .then(() => window.dispatchEvent(new Event(EVENEMENT_PROPOSITIONS_VUES)))
      .catch(() => {}) // hors ligne : elles resteront « nouvelles » à la prochaine visite
  }, [nouvelles])

  const carte = (offre) => (
    <li key={offre.id}>
      <CarteOffre offre={offre}>
        <div className="offre__propositions">
          <h4 className="offre__sous-titre">
            {offre.propositions.length === 0
              ? 'Pas encore de proposition'
              : `${offre.propositions.length} machine${offre.propositions.length > 1 ? 's' : ''} proposée${offre.propositions.length > 1 ? 's' : ''}`}
          </h4>
          {offre.propositions.length === 0 && offre.statut === 'OUVERTE' && (
            <p className="champ__aide">Les propriétaires de votre région voient votre offre. Revenez bientôt.</p>
          )}
          {offre.propositions.length > 0 && (
            <ul className="propositions">
              {offre.propositions.map((p) => <Proposition key={p.id} proposition={p} />)}
            </ul>
          )}
        </div>
        {offre.statut === 'OUVERTE' && (
          <Fermer offre={offre} onFermee={(maj) => setFermees((f) => ({ ...f, [maj.id]: maj }))} />
        )}
      </CarteOffre>
    </li>
  )

  return (
    <div className="page">
      <EnTetePage titre="Mes offres" sousTitre="Vous ne trouvez pas une machine ? Les propriétaires vous en proposent." />

      <main className="contenu contenu--moyen">
        <Lien vers="/offres/nouvelle" className="bouton bouton--plein bouton--large bouton--grand">
          <IconePlus /> Lancer une offre
        </Lien>

        {liste.etat === 'chargement' && (
          <div className="liste-resa" aria-hidden="true">
            {[0, 1].map((i) => <div key={i} className="resa squelette" style={{ height: 180 }} />)}
          </div>
        )}

        {liste.etat === 'erreur' && (
          <div className="message" role="alert">
            <p>{messageErreur(liste.erreur)}</p>
            <button type="button" className="bouton bouton--plein" onClick={() => setVersion((v) => v + 1)}>Réessayer</button>
          </div>
        )}

        {liste.etat === 'pret' && offres.length === 0 && (
          <div className="message">
            <p>
              Décrivez la machine qu’il vous faut : les propriétaires de votre région pourront l’ajouter sur
              AgriLink et vous la proposer.
            </p>
          </div>
        )}

        {ouvertes.length > 0 && <ul className="liste-resa">{ouvertes.map(carte)}</ul>}

        {anciennes.length > 0 && (
          <details className="offres-fermees">
            <summary>Offres fermées ({anciennes.length})</summary>
            <ul className="liste-resa">{anciennes.map(carte)}</ul>
          </details>
        )}
      </main>

      <Navigation variante="bas" />
    </div>
  )
}
