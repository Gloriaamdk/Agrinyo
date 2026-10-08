import { urlMedia } from '../api.js'
import { formaterPeriode, formaterPrix, formaterQuantite, iconeMachine, STATUTS } from '../format.js'
import { IconeMessage } from './Icones.jsx'
import Lien from './Lien.jsx'

export function Statut({ statut }) {
  const { libelle, classe } = STATUTS[statut]
  return <span className={`statut statut--${classe}`}>{libelle}</span>
}

/** « Écrire » : ouvre la conversation d'une réservation acceptée, avec le nombre de messages non lus. */
export function BoutonEcrire({ reservation, interlocuteur }) {
  if (!reservation.messagerie_ouverte) return null
  const nonLus = reservation.messages_non_lus
  return (
    <Lien
      vers={`/conversations/${reservation.id}`}
      className="bouton bouton--plein bouton--petit bouton-ecrire"
      aria-label={`Écrire à ${interlocuteur}${nonLus > 0 ? `, ${nonLus} message${nonLus > 1 ? 's' : ''} non lu${nonLus > 1 ? 's' : ''}` : ''}`}
    >
      <IconeMessage width={20} height={20} />
      Écrire
      {nonLus > 0 && <span className="bouton-ecrire__pastille" aria-hidden="true">{nonLus}</span>}
    </Lien>
  )
}

/** Une réservation, vue par l'agriculteur ou par le propriétaire (`vue`). */
export default function CarteReservation({ reservation, vue, children }) {
  const { machine } = reservation
  return (
    <article className="resa">
      <div className="resa__visuel" aria-hidden="true">
        {machine.photo ? (
          <img src={urlMedia(machine.photo)} alt="" loading="lazy" width="96" height="72" />
        ) : (
          <span>{iconeMachine(machine.type_machine)}</span>
        )}
      </div>
      <div className="resa__corps">
        <div className="resa__entete">
          <h3 className="resa__titre">{machine.nom}</h3>
          <Statut statut={reservation.statut} />
        </div>
        <p className="resa__ligne">
          {vue === 'proprietaire' ? (
            <>Demandée par <strong>{reservation.agriculteur.nom}</strong></>
          ) : (
            <>Propriétaire : {machine.proprietaire.nom} · {machine.localisation}</>
          )}
        </p>
        <p className="resa__periode">{formaterPeriode(reservation.date_debut, reservation.date_fin)}</p>
        <p className="resa__ligne">
          {formaterQuantite(reservation.quantite, reservation.unite_prix)} ·{' '}
          <strong className="resa__montant">{formaterPrix(reservation.montant_estime)}</strong>
        </p>
        {children}
      </div>
    </article>
  )
}
