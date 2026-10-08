import { useMemo, useState } from 'react'
import { getFiltres, getMachines, useDonnees } from '../api.js'
import CarteMachine from '../components/CarteMachine.jsx'
import { Marque } from '../components/EnTetePage.jsx'
import FicheMachine from '../components/FicheMachine.jsx'
import { ChampRecherche, ChoixZone } from '../components/Filtres.jsx'
import Lien from '../components/Lien.jsx'
import Navigation from '../components/Navigation.jsx'
import PourToi from '../components/PourToi.jsx'
import { iconeMachine } from '../format.js'
import { useFavoris, useFicheOuverte } from '../hooks.js'
import { naviguer } from '../routeur.js'

const FILTRES_VIDES = { zones: [], types: [] }
const NOMBRE_RECOMMANDATIONS = 6

/** Adresse de la page Machines avec ses filtres. */
function versMachines(filtres) {
  const params = new URLSearchParams(Object.entries(filtres).filter(([, valeur]) => valeur))
  const requete = params.toString()
  return `/machines${requete ? `?${requete}` : ''}`
}

// Pas de notes en V1 : on recommande les moins chères.
const parPrix = (a, b) => a.prix - b.prix

/** Accueil de l'agriculteur (PRD) : localisation, recherche, catégories, nouveautés, recommandations. */
export default function Accueil() {
  const [zone, setZone] = useState('')
  const [saisie, setSaisie] = useState('')
  const [essai, setEssai] = useState(0)
  const { favoris, basculer: basculerFavori } = useFavoris()
  const fiche = useFicheOuverte()

  const filtres = useDonnees('filtres', getFiltres).donnees ?? FILTRES_VIDES
  // Une seule requête : les plus récentes alimentent le carrousel, les moins chères les recommandations.
  const liste = useDonnees(`accueil|${zone}|${essai}`, (signal) => getMachines({ zone }, signal))
  const machines = liste.donnees ?? []
  const recommandations = useMemo(
    () => [...(liste.donnees ?? [])].sort(parPrix).slice(0, NOMBRE_RECOMMANDATIONS),
    [liste.donnees],
  )

  const rechercher = (recherche) => {
    if (recherche) naviguer(versMachines({ zone, q: recherche }))
  }

  return (
    <div className="page">
      <header className="entete">
        <div className="entete__interieur">
          <Marque />
          <h1 className="visuellement-cache">Accueil</h1>
          <ChoixZone zones={filtres.zones} zone={zone} onChange={setZone} />
          <ChampRecherche valeur={saisie} onChange={setSaisie} onSubmit={rechercher} />
          <Navigation variante="haut" />
        </div>
      </header>

      <main className="contenu">
        {liste.etat !== 'erreur' && (
          <section aria-labelledby="titre-pourtoi">
            {/* Pas de titre visible (retiré à la demande) ; gardé pour les lecteurs d'écran. */}
            <h2 id="titre-pourtoi" className="visuellement-cache">Nouveautés</h2>
            {liste.etat === 'chargement' ? (
              <div className="pourtoi__diapo squelette" aria-hidden="true" />
            ) : machines.length > 0 ? (
              <PourToi machines={machines.slice(0, 4)} onOuvrir={fiche.ouvrir} />
            ) : (
              <p className="vide">Aucune machine disponible dans cette zone pour l’instant.</p>
            )}
          </section>
        )}

        {filtres.types.length > 0 && (
          <section aria-labelledby="titre-categories">
            <h2 id="titre-categories" className="section__titre">Catégories</h2>
            <ul className="types categories">
              {filtres.types.map((t) => (
                <li key={t.valeur}>
                  <Lien vers={versMachines({ zone, type: t.valeur })} className="type categorie">
                    <span aria-hidden="true">{iconeMachine(t.valeur)}</span>
                    {t.libelle}
                  </Lien>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="titre-liste" aria-busy={liste.etat === 'chargement'}>
          <div className="section__entete">
            <h2 id="titre-liste" className="section__titre">Tes Recommandations</h2>
            <Lien vers={versMachines({ zone })} className="lien-voir-tout">Tout voir</Lien>
          </div>

          {liste.etat === 'chargement' && (
            <ul className="grille" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="carte squelette" />
              ))}
            </ul>
          )}

          {liste.etat === 'erreur' && (
            <div className="message" role="alert">
              <p>Impossible de charger les machines. Vérifiez votre connexion.</p>
              <button type="button" className="bouton bouton--plein" onClick={() => setEssai((n) => n + 1)}>
                Réessayer
              </button>
            </div>
          )}

          {liste.etat === 'pret' && recommandations.length > 0 && (
            <>
              <ul className="grille">
                {recommandations.map((machine) => (
                  <li key={machine.id}>
                    <CarteMachine
                      machine={machine}
                      favori={favoris.has(machine.id)}
                      onFavori={basculerFavori}
                      onOuvrir={fiche.ouvrir}
                    />
                  </li>
                ))}
              </ul>
              <Lien vers={versMachines({ zone })} className="bouton bouton--contour bouton--large voir-tout">
                Voir toutes les machines ({machines.length})
              </Lien>
            </>
          )}
        </section>
      </main>

      <Navigation variante="bas" />

      {fiche.id !== null && (
        <FicheMachine
          key={fiche.id}
          id={fiche.id}
          apercu={machines.find((m) => m.id === fiche.id)}
          favori={favoris.has(fiche.id)}
          onFavori={basculerFavori}
          onFermer={fiche.fermer}
        />
      )}
    </div>
  )
}
