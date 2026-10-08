import { useEffect, useRef } from 'react'
import { getMachine, useDonnees } from '../api.js'
import Avatar from './Avatar.jsx'
import { BoutonFavori, Visuel } from './CarteMachine.jsx'
import FormulaireReservation from './FormulaireReservation.jsx'
import { IconeEffacer } from './Icones.jsx'

/**
 * Fiche d'une machine (maquette « pop-up ») dans une <dialog> native : focus piégé,
 * touche Échap et arrière-plan inerte sont gérés par le navigateur.
 */
export default function FicheMachine({ id, apercu, favori, onFavori, onFermer }) {
  const dialogue = useRef(null)
  const detail = useDonnees(`fiche|${id}`, (signal) => getMachine(id, signal))
  // On affiche tout de suite ce que la liste connaît déjà ; le formulaire attend le détail
  // (il a besoin des dates déjà réservées).
  const machine = detail.donnees ?? apercu

  useEffect(() => {
    const el = dialogue.current
    if (!el.open) el.showModal()
    return () => el.open && el.close()
  }, [])

  // Toucher l'arrière-plan (hors du contenu) ferme la fiche.
  const clicFond = (e) => {
    if (e.target === dialogue.current) onFermer()
  }

  return (
    <dialog
      ref={dialogue}
      className="fiche"
      aria-labelledby="fiche-titre"
      onCancel={(e) => {
        e.preventDefault()
        onFermer()
      }}
      onClick={clicFond}
    >
      <div className="fiche__contenu">
        <div className="fiche__barre">
          <button type="button" className="fiche__fermer" onClick={onFermer} aria-label="Fermer la fiche">
            <IconeEffacer />
          </button>
        </div>

        {!machine && detail.etat === 'chargement' && <div className="fiche__chargement squelette" />}

        {!machine && detail.etat === 'erreur' && (
          <div className="message fiche__message" role="alert">
            <p>Cette machine est introuvable ou la connexion a échoué.</p>
            <button type="button" className="bouton bouton--plein" onClick={onFermer}>Retour à la liste</button>
          </div>
        )}

        {machine && (
          <>
            <div className="fiche__titre-ligne">
              <h2 id="fiche-titre" className="fiche__titre">{machine.nom}</h2>
            </div>

            <figure className="fiche__media">
              <div className="fiche__photo">
                <Visuel machine={machine} className="fiche__visuel" prioritaire />
                <BoutonFavori actif={favori} nom={machine.nom} onBasculer={() => onFavori(machine.id)} />
                {/* Sur la photo, comme les textes du carrousel de l'accueil. */}
                <div className="fiche__proprio">
                  <Avatar nom={machine.proprietaire.nom} photo={machine.proprietaire.photo} />
                  <span className="fiche__proprio-texte">
                    <span>Propriétaire</span>
                    <strong>{machine.proprietaire.nom}</strong>
                  </span>
                </div>
              </div>
              {/* Le crédit reste sous la photo : la licence (CC BY-SA) l'exige à côté de l'image. */}
              {machine.credit_photo && (
                <figcaption>
                  <span className="fiche__credit">Photo : {machine.credit_photo}</span>
                </figcaption>
              )}
            </figure>

            <div className="fiche__corps">
              {detail.donnees ? (
                <FormulaireReservation machine={detail.donnees} />
              ) : detail.etat === 'erreur' ? (
                <p className="erreur" role="alert">Impossible de charger les disponibilités. Vérifiez votre connexion.</p>
              ) : (
                <div className="reservation squelette" style={{ height: 230 }} aria-hidden="true" />
              )}

              <section>
                <h3 className="fiche__sous-titre">Description</h3>
                <p className="fiche__lieu">
                  {machine.type_machine_libelle} · {machine.localisation}, région {machine.zone_libelle}
                </p>
                {machine.description && <p className="fiche__description">{machine.description}</p>}
              </section>
            </div>
          </>
        )}
      </div>
    </dialog>
  )
}
