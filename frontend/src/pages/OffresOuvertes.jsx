import { useState } from 'react'
import { getFiltres, getOffresOuvertes, messageErreur, useDonnees } from '../api.js'
import CarteOffre from '../components/CarteOffre.jsx'
import EnTetePage from '../components/EnTetePage.jsx'
import { IconeCoche } from '../components/Icones.jsx'
import Lien from '../components/Lien.jsx'
import Navigation from '../components/Navigation.jsx'

const FILTRES_VIDES = { zones: [], tous_les_types: [] }

/** Propriétaire : les machines que les agriculteurs cherchent, pour leur en proposer une. */
export default function OffresOuvertes() {
  const [zone, setZone] = useState('')
  const [type, setType] = useState('')
  const [essai, setEssai] = useState(0)
  const filtres = useDonnees('filtres', getFiltres).donnees ?? FILTRES_VIDES
  const liste = useDonnees(`offres|${zone}|${type}|${essai}`, (signal) => getOffresOuvertes({ zone, type }, signal))
  const offres = liste.donnees ?? []
  // Message après une proposition envoyée depuis le formulaire « Ajouter une machine ».
  const [proposee] = useState(() => new URLSearchParams(window.location.search).has('proposee'))

  return (
    <div className="page">
      <EnTetePage titre="Offres des agriculteurs" sousTitre="Ils cherchent ces machines : proposez la vôtre." />

      <main className="contenu contenu--moyen">
        {proposee && <p className="succes" role="status">Proposition envoyée. L’agriculteur la verra dans ses offres.</p>}

        <label className="tri">
          <span>Région :</span>
          <select value={zone} onChange={(e) => setZone(e.target.value)}>
            <option value="">Toutes</option>
            {filtres.zones.map((z) => <option key={z.valeur} value={z.valeur}>{z.libelle}</option>)}
          </select>
        </label>
        <div className="types" role="group" aria-label="Filtrer par type de machine">
          <button type="button" className="type" aria-pressed={type === ''} onClick={() => setType('')}>Tout</button>
          {filtres.tous_les_types.map((t) => (
            <button key={t.valeur} type="button" className="type" aria-pressed={type === t.valeur} onClick={() => setType(t.valeur)}>
              {t.libelle}
            </button>
          ))}
        </div>

        {liste.etat === 'chargement' && (
          <div className="liste-resa" aria-hidden="true">
            {[0, 1].map((i) => <div key={i} className="resa squelette" style={{ height: 180 }} />)}
          </div>
        )}

        {liste.etat === 'erreur' && (
          <div className="message" role="alert">
            <p>{messageErreur(liste.erreur)}</p>
            <button type="button" className="bouton bouton--plein" onClick={() => setEssai((n) => n + 1)}>Réessayer</button>
          </div>
        )}

        {liste.etat === 'pret' && offres.length === 0 && (
          <div className="message">
            <p>
              {zone || type
                ? 'Aucune offre pour ces critères.'
                : 'Aucune offre pour l’instant. Quand un agriculteur cherche une machine, elle apparaît ici.'}
            </p>
          </div>
        )}

        {offres.length > 0 && (
          <ul className="liste-resa">
            {offres.map((offre) => (
              <li key={offre.id}>
                <CarteOffre offre={offre} titre={`${offre.agriculteur.prenom} cherche : ${offre.type_machine_libelle.toLowerCase()}`}>
                  <div className="offre__pied">
                    <span className="offre__compte">
                      {offre.nombre_propositions === 0
                        ? 'Aucune proposition : soyez le premier'
                        : `${offre.nombre_propositions} proposition${offre.nombre_propositions > 1 ? 's' : ''}`}
                    </span>
                    {offre.mes_machines_proposees.length > 0 && (
                      <span className="offre__deja">
                        <IconeCoche width={16} height={16} /> Vous avez proposé {offre.mes_machines_proposees.length > 1 ? `${offre.mes_machines_proposees.length} machines` : 'une machine'}
                      </span>
                    )}
                  </div>
                  <Lien vers={`/offres/${offre.id}/proposer`} className="bouton bouton--plein bouton--large">
                    {offre.mes_machines_proposees.length > 0 ? 'Proposer une autre machine' : 'Proposer une machine'}
                  </Lien>
                </CarteOffre>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Navigation variante="bas" />
    </div>
  )
}
