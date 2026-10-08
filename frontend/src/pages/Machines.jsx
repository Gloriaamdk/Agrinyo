import { useEffect, useMemo, useState } from 'react'
import { getFiltres, getMachines, useDonnees } from '../api.js'
import CarteMachine from '../components/CarteMachine.jsx'
import { Marque } from '../components/EnTetePage.jsx'
import FicheMachine from '../components/FicheMachine.jsx'
import { ChampRecherche, ChoixZone } from '../components/Filtres.jsx'
import { IconeCoeur } from '../components/Icones.jsx'
import Lien from '../components/Lien.jsx'
import Navigation from '../components/Navigation.jsx'
import { useFavoris, useFicheOuverte } from '../hooks.js'
import { useSession } from '../session.jsx'

const FILTRES_VIDES = { zones: [], types: [] }

const TRIS = {
  recommandes: { libelle: 'Plus récentes', comparer: null },
  prix: { libelle: 'Prix le plus bas', comparer: (a, b) => a.prix - b.prix },
}

// Filtres repris de l'adresse (/machines?zone=KARA&type=TRACTEUR&q=…) : l'accueil y envoie.
const parametre = (nom) => new URLSearchParams(window.location.search).get(nom) ?? ''

export default function Machines() {
  const [zone, setZone] = useState(() => parametre('zone'))
  const [type, setType] = useState(() => parametre('type'))
  const [saisie, setSaisie] = useState(() => parametre('q'))
  const [recherche, setRecherche] = useState(() => parametre('q'))
  const [tri, setTri] = useState('recommandes')
  const [seulementFavoris, setSeulementFavoris] = useState(false)
  const [essai, setEssai] = useState(0)
  const { favoris, basculer: basculerFavori } = useFavoris()
  const fiche = useFicheOuverte()

  // On attend une courte pause dans la frappe avant d'interroger le serveur.
  useEffect(() => {
    const minuteur = setTimeout(() => setRecherche(saisie.trim()), 350)
    return () => clearTimeout(minuteur)
  }, [saisie])

  // L'adresse suit les filtres : le retour depuis une fiche ou un rechargement les garde.
  useEffect(() => {
    const params = new URLSearchParams()
    if (zone) params.set('zone', zone)
    if (type) params.set('type', type)
    if (recherche) params.set('q', recherche)
    const requete = params.toString()
    const adresse = `${window.location.pathname}${requete ? `?${requete}` : ''}${window.location.hash}`
    window.history.replaceState(window.history.state, '', adresse)
  }, [zone, type, recherche])

  const filtres = useDonnees('filtres', getFiltres).donnees ?? FILTRES_VIDES
  const liste = useDonnees(`machines|${zone}|${type}|${recherche}|${essai}`, (signal) =>
    getMachines({ zone, type, recherche }, signal),
  )

  // Tri et favoris se font dans le navigateur : réponse instantanée, sans réseau.
  const machines = useMemo(() => {
    let resultat = liste.donnees ?? []
    if (seulementFavoris) resultat = resultat.filter((m) => favoris.has(m.id))
    const { comparer } = TRIS[tri]
    return comparer ? [...resultat].sort(comparer) : resultat
  }, [liste.donnees, seulementFavoris, favoris, tri])

  const filtreActif = zone || type || recherche || seulementFavoris
  const { estDetenteur } = useSession()
  // Machine introuvable : l'agriculteur lance une offre avec le type et la région déjà choisis.
  const paramsOffre = new URLSearchParams(Object.entries({ type, zone }).filter(([, valeur]) => valeur)).toString()
  const lienOffre = `/offres/nouvelle${paramsOffre ? `?${paramsOffre}` : ''}`

  const reinitialiser = () => {
    setZone('')
    setType('')
    setSaisie('')
    setRecherche('')
    setSeulementFavoris(false)
  }

  return (
    <div className="page">
      <header className="entete">
        <div className="entete__interieur">
          <Marque />
          <h1 className="visuellement-cache">Machines disponibles</h1>
          <ChoixZone zones={filtres.zones} zone={zone} onChange={setZone} />
          <ChampRecherche valeur={saisie} onChange={setSaisie} onSubmit={setRecherche} />
          <Navigation variante="haut" />
        </div>
      </header>

      <main className="contenu">
        <section aria-labelledby="titre-liste" aria-busy={liste.etat === 'chargement'}>
          <div className="section__entete">
            <h2 id="titre-liste" className="section__titre">
              {recherche ? 'Résultats' : 'Machines disponibles'}
            </h2>
            {liste.etat === 'pret' && (
              <span className="compteur" aria-live="polite">
                {machines.length} machine{machines.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="types" role="group" aria-label="Filtrer par type de machine">
            <button type="button" className="type" aria-pressed={type === ''} onClick={() => setType('')}>
              Tout
            </button>
            {filtres.types.map((t) => (
              <button key={t.valeur} type="button" className="type" aria-pressed={type === t.valeur} onClick={() => setType(t.valeur)}>
                {t.libelle}
              </button>
            ))}
          </div>

          <div className="outils">
            <label className="tri">
              <span>Trier :</span>
              <select value={tri} onChange={(e) => setTri(e.target.value)}>
                {Object.entries(TRIS).map(([valeur, { libelle }]) => (
                  <option key={valeur} value={valeur}>{libelle}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="filtre-favoris"
              aria-pressed={seulementFavoris}
              onClick={() => setSeulementFavoris((v) => !v)}
            >
              <IconeCoeur plein={seulementFavoris} width={18} height={18} />
              Favoris{favoris.size > 0 && ` (${favoris.size})`}
            </button>
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

          {liste.etat === 'pret' && machines.length === 0 && (
            <div className="message">
              <p>
                {seulementFavoris
                  ? 'Aucun favori ici. Touchez le cœur d’une machine pour la retrouver plus tard.'
                  : 'Aucune machine disponible pour ces critères.'}
              </p>
              {filtreActif && (
                <button type="button" className="bouton bouton--plein" onClick={reinitialiser}>
                  Voir toutes les machines
                </button>
              )}
            </div>
          )}

          {liste.etat === 'pret' && machines.length > 0 && (
            <ul className="grille">
              {machines.map((machine) => (
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
          )}
        </section>

        {!estDetenteur && liste.etat === 'pret' && (
          <section className="appel-offre" aria-labelledby="titre-appel-offre">
            <h2 id="titre-appel-offre" className="appel-offre__titre">Vous ne trouvez pas la machine qu’il vous faut ?</h2>
            <p>Lancez une offre : les propriétaires de votre région pourront l’ajouter et vous la proposer.</p>
            <Lien vers={lienOffre} className="bouton bouton--plein">Lancer une offre</Lien>
          </section>
        )}
      </main>

      <Navigation variante="bas" />

      {fiche.id !== null && (
        <FicheMachine
          key={fiche.id}
          id={fiche.id}
          apercu={liste.donnees?.find((m) => m.id === fiche.id)}
          favori={favoris.has(fiche.id)}
          onFavori={basculerFavori}
          onFermer={fiche.fermer}
        />
      )}
    </div>
  )
}
