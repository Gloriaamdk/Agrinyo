import { formaterDate, formaterPrix, iconeMachine } from '../format.js'
import { IconeCalendrier, IconeRepere } from './Icones.jsx'

/** Une offre (« je cherche une batteuse à Kara »), vue par l'agriculteur ou par les propriétaires. */
export default function CarteOffre({ offre, titre, children }) {
  return (
    <article className={`offre${offre.statut === 'FERMEE' ? ' offre--fermee' : ''}`}>
      <div className="offre__entete">
        <span className="offre__icone" aria-hidden="true">{iconeMachine(offre.type_machine)}</span>
        <div className="offre__titres">
          <h3 className="offre__titre">{titre ?? offre.type_machine_libelle}</h3>
          <p className="offre__lieu">
            <IconeRepere width={16} height={16} /> {offre.localisation}, {offre.zone_libelle}
          </p>
        </div>
        {offre.statut === 'FERMEE' && <span className="statut statut--annulee">Fermée</span>}
      </div>
      <p className="offre__description">{offre.description}</p>
      {(offre.date_souhaitee || offre.budget) && (
        <ul className="offre__details">
          {offre.date_souhaitee && (
            <li>
              <IconeCalendrier width={16} height={16} /> Dès le {formaterDate(offre.date_souhaitee)}
            </li>
          )}
          {offre.budget && (
            <li>
              Budget : <strong>{formaterPrix(offre.budget)}</strong> / {offre.unite_budget_libelle}
            </li>
          )}
        </ul>
      )}
      {children}
    </article>
  )
}
