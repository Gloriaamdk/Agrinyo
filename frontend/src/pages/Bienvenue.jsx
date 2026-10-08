import { getFiltres, getMachines, useDonnees } from '../api.js'
import { Visuel } from '../components/CarteMachine.jsx'
import { Marque } from '../components/EnTetePage.jsx'
import {
  IconeCalendrier, IconeCoche, IconeDemandes, IconeFleche, IconeLoupe, IconePhoto, IconeRepere, IconeTelephone,
} from '../components/Icones.jsx'
import Lien from '../components/Lien.jsx'
import Navigation from '../components/Navigation.jsx'
import photoGrande from '../assets/bienvenue-tracteur-1280.jpg'
import photoPetite from '../assets/bienvenue-tracteur-800.jpg'
import { formaterPrix } from '../format.js'

const ANNEE = new Date().getFullYear()
const INSCRIPTION_AGRICULTEUR = '/connexion?mode=inscription&role=AGRICULTEUR'
const INSCRIPTION_PROPRIETAIRE = '/connexion?mode=inscription&role=DETENTEUR'

const ETAPES = {
  agriculteur: [
    { Icone: IconeLoupe, titre: 'Cherchez près de chez vous', texte: 'Tracteur, batteuse, motopompe… Filtrez par région et par type de machine.' },
    { Icone: IconeCalendrier, titre: 'Choisissez la date', texte: 'Indiquez les jours, les heures ou les hectares : le prix estimé s’affiche avant d’envoyer.' },
    { Icone: IconeCoche, titre: 'Suivez la réponse', texte: 'Le propriétaire accepte ou refuse. Vous voyez le statut dans « Mes réservations ».' },
  ],
  proprietaire: [
    { Icone: IconePhoto, titre: 'Publiez votre machine', texte: 'Une photo, un prix par jour, par heure ou par hectare, et votre ville.' },
    { Icone: IconeDemandes, titre: 'Recevez les demandes', texte: 'Les agriculteurs de votre région vous envoient leurs dates.' },
    { Icone: IconeCoche, titre: 'Acceptez en un appui', texte: 'Les dates acceptées sont bloquées : pas de double réservation.' },
  ],
}

const ATOUTS = [
  { Icone: IconeTelephone, titre: 'Pensé pour le téléphone', texte: 'Gros boutons, peu de texte, lisible même dehors.' },
  { Icone: IconeRepere, titre: 'Dans les 5 régions', texte: 'De Maritime aux Savanes, trouvez une machine proche de votre champ.' },
  { Icone: IconeCalendrier, titre: 'Prix clair, dates sûres', texte: 'Le prix est fixé à la demande et une machine n’est jamais réservée deux fois.' },
]

function Parcours({ id, titre, etapes, lien, libelleLien, variante }) {
  return (
    <article className={`parcours parcours--${variante}`} aria-labelledby={id}>
      <h3 id={id} className="parcours__titre">{titre}</h3>
      <ol className="parcours__etapes">
        {etapes.map(({ Icone, titre: titreEtape, texte }, i) => (
          <li key={titreEtape} className="etape">
            <span className="etape__icone" aria-hidden="true">
              <Icone />
              <span className="etape__numero">{i + 1}</span>
            </span>
            <div>
              <h4 className="etape__titre">{titreEtape}</h4>
              <p className="etape__texte">{texte}</p>
            </div>
          </li>
        ))}
      </ol>
      <Lien vers={lien} className="bouton bouton--plein bouton--large bouton--grand">{libelleLien}</Lien>
    </article>
  )
}

/** Page d'accueil des visiteurs : présente AgriLink aux agriculteurs et aux propriétaires. */
export default function Bienvenue() {
  const machines = useDonnees('bienvenue-machines', (signal) => getMachines({}, signal))
  const filtres = useDonnees('filtres', getFiltres)

  // Chiffres réels, tirés du catalogue : rien d'inventé.
  const liste = machines.donnees ?? []
  const parZone = liste.reduce((compte, m) => ({ ...compte, [m.zone]: (compte[m.zone] ?? 0) + 1 }), {})
  const types = new Set(liste.map((m) => m.type_machine)).size
  const avecPhoto = liste.filter((m) => m.photo)
  const apercu = (avecPhoto.length >= 4 ? avecPhoto : liste).slice(0, 4)
  const zones = filtres.donnees?.zones ?? []

  const defiler = () => document.getElementById('suite')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="page bienvenue">
      <header className="heros">
        {/* Photo CC0 (Wikimedia Commons, Chandapiwa Malema) : voir src/assets/CREDITS.md. */}
        <img
          className="heros__fond"
          src={photoGrande}
          srcSet={`${photoPetite} 800w, ${photoGrande} 1280w`}
          sizes="100vw"
          alt=""
          fetchPriority="high"
        />

        <div className="heros__barre">
          <Marque />
          <Navigation variante="haut" sansCompte />
          <Lien vers="/connexion?mode=connexion" className="heros__connexion">Se connecter</Lien>
        </div>

        <div className="heros__texte">
          <p className="heros__etiquette">
            <span aria-hidden="true">🌱</span>
            {liste.length > 0 ? `${liste.length} machines disponibles au Togo` : 'Location de machines agricoles au Togo'}
          </p>
          <h1 className="heros__titre">La bonne machine, au bon moment.</h1>
          <p className="heros__sous-titre">
            Réservez un tracteur près de chez vous.
            <br />
            Ou louez le vôtre quand il ne sert pas.
          </p>
          <div className="heros__actions">
            <Lien vers="/machines" className="heros__principal">
              Trouver une machine <IconeFleche width={18} height={18} />
            </Lien>
            <Lien vers={INSCRIPTION_PROPRIETAIRE} className="heros__secondaire">Louer ma machine</Lien>
          </div>
        </div>

        <button type="button" className="heros__defiler" onClick={defiler}>
          Découvrir <span aria-hidden="true">↓</span>
        </button>
      </header>

      <main id="suite" className="contenu bienvenue__contenu">
        {machines.etat === 'pret' && liste.length > 0 && (
          <section className="stats" aria-label="AgriLink en chiffres">
            <p className="stat"><strong>{liste.length}</strong> machine{liste.length > 1 ? 's' : ''} disponible{liste.length > 1 ? 's' : ''}</p>
            <p className="stat"><strong>{Object.keys(parZone).length}</strong> région{Object.keys(parZone).length > 1 ? 's' : ''} sur 5</p>
            <p className="stat"><strong>{types}</strong> type{types > 1 ? 's' : ''} de machine{types > 1 ? 's' : ''}</p>
          </section>
        )}

        <section aria-labelledby="titre-fonctionnement">
          <h2 id="titre-fonctionnement" className="bienvenue__titre">Comment ça marche</h2>
          <div className="parcours-liste">
            <Parcours
              id="parcours-agriculteur"
              titre="Vous cherchez une machine"
              etapes={ETAPES.agriculteur}
              lien={INSCRIPTION_AGRICULTEUR}
              libelleLien="Créer un compte agriculteur"
              variante="agriculteur"
            />
            <Parcours
              id="parcours-proprietaire"
              titre="Vous avez une machine"
              etapes={ETAPES.proprietaire}
              lien={INSCRIPTION_PROPRIETAIRE}
              libelleLien="Créer un compte propriétaire"
              variante="proprietaire"
            />
          </div>
        </section>

        {apercu.length > 0 && (
          <section aria-labelledby="titre-apercu">
            <div className="section__entete">
              <h2 id="titre-apercu" className="bienvenue__titre">Déjà disponibles</h2>
              <Lien vers="/machines" className="lien-voir-tout">Tout voir</Lien>
            </div>
            <ul className="apercu">
              {apercu.map((m) => (
                <li key={m.id}>
                  {/* /machines#machine-12 ouvre directement la fiche. */}
                  <Lien vers={`/machines#machine-${m.id}`} className="apercu__carte">
                    <Visuel machine={m} className="apercu__visuel" />
                    <span className="carte__type">{m.type_machine_libelle}</span>
                    <strong className="apercu__nom">{m.nom}</strong>
                    <span className="apercu__lieu">{m.localisation}, {m.zone_libelle}</span>
                    <span className="prix"><strong>{formaterPrix(m.prix)}</strong> / {m.unite_prix_libelle}</span>
                  </Lien>
                </li>
              ))}
            </ul>
          </section>
        )}

        {zones.length > 0 && machines.etat === 'pret' && (
          <section aria-labelledby="titre-regions">
            <h2 id="titre-regions" className="bienvenue__titre">Par région</h2>
            <ul className="regions">
              {zones.map((z) => (
                <li key={z.valeur}>
                  <Lien vers={`/machines?zone=${z.valeur}`} className="region">
                    <IconeRepere className="region__repere" />
                    <span className="region__nom">{z.libelle}</span>
                    <span className="region__compte">
                      {parZone[z.valeur] ? `${parZone[z.valeur]} machine${parZone[z.valeur] > 1 ? 's' : ''}` : 'Bientôt'}
                    </span>
                  </Lien>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="titre-atouts">
          <h2 id="titre-atouts" className="bienvenue__titre">Pourquoi AgriLink</h2>
          <ul className="atouts">
            {ATOUTS.map(({ Icone, titre, texte }) => (
              <li key={titre} className="atout">
                <span className="atout__icone" aria-hidden="true"><Icone /></span>
                <h3 className="atout__titre">{titre}</h3>
                <p className="atout__texte">{texte}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="appel" aria-labelledby="titre-appel">
          <h2 id="titre-appel" className="appel__titre">Prêt pour la prochaine saison ?</h2>
          <p className="appel__texte">Créez votre compte avec votre numéro de téléphone. C’est rapide.</p>
          <div className="appel__actions">
            <Lien vers={INSCRIPTION_AGRICULTEUR} className="bouton bouton--grand bouton--blanc">Je suis agriculteur</Lien>
            <Lien vers={INSCRIPTION_PROPRIETAIRE} className="bouton bouton--grand bouton--contour-blanc">J’ai une machine</Lien>
          </div>
        </section>
      </main>

      <footer className="pied">
        <p>© {ANNEE} AgriLink · Location de machines agricoles au Togo</p>
      </footer>

      <Navigation variante="bas" />
    </div>
  )
}
