import { useCallback, useState } from 'react'
import { ErreurApi, messageErreur } from '../api.js'
import { BoutonFleche, Champ, ChampMotDePasse } from '../components/ChampsAuthentification.jsx'
import EcranDemarrage from '../components/EcranDemarrage.jsx'
import { IconeEnveloppe, IconeFeuille, IconeProfil, IconeRepere, IconeTelephone } from '../components/Icones.jsx'
import MotDePasseOublie from '../components/MotDePasseOublie.jsx'
import { naviguer } from '../routeur.js'
import { useSession } from '../session.jsx'

const ROLES = [
  { valeur: 'AGRICULTEUR', titre: 'Agriculteur' },
  { valeur: 'DETENTEUR', titre: 'Propriétaire de machine' },
]

const CHAMPS_VIDES = {
  identifiant: '', mot_de_passe: '', username: '', email: '', telephone: '',
  first_name: '', last_name: '', type_utilisateur: '', localisation: '',
}

// L'écran de démarrage ne s'affiche qu'une fois par visite (onglet).
const CLE_DEMARRAGE = 'agrilink.demarrage-vu'

function demarrageDejaVu() {
  try {
    return sessionStorage.getItem(CLE_DEMARRAGE) === '1'
  } catch {
    return false
  }
}

function retenirDemarrage() {
  try {
    sessionStorage.setItem(CLE_DEMARRAGE, '1')
  } catch {
    // Stockage indisponible : l'écran reviendra au prochain chargement, sans gravité.
  }
}

/** Page de destination après connexion : seulement une adresse interne (pas de redirection ouverte). */
function lireSuite() {
  const suite = new URLSearchParams(window.location.search).get('suite')
  return suite && suite.startsWith('/') && !suite.startsWith('//') ? suite : null
}

/**
 * Choix venus de la page d'accueil : /connexion?mode=inscription&role=DETENTEUR.
 * Avec un mode explicite, la personne a déjà vu la présentation : pas d'écran de démarrage.
 */
function lireChoixInitiaux() {
  const params = new URLSearchParams(window.location.search)
  const mode = params.get('mode')
  const role = params.get('role')
  return {
    mode: mode === 'inscription' ? 'inscription' : 'connexion',
    explicite: mode === 'inscription' || mode === 'connexion',
    role: ROLES.some((r) => r.valeur === role) ? role : '',
  }
}

export default function Connexion() {
  const { seConnecter, sInscrire } = useSession()
  const suite = lireSuite()
  const [choix] = useState(lireChoixInitiaux)
  const [mode, setMode] = useState(choix.mode)
  const [champs, setChamps] = useState(() => ({ ...CHAMPS_VIDES, type_utilisateur: choix.role }))
  const [demarrage, setDemarrage] = useState(() => !choix.explicite && !demarrageDejaVu())
  const [seSouvenir, setSeSouvenir] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)

  const connexion = mode === 'connexion'
  const modifier = (nom) => (valeur) => setChamps((c) => ({ ...c, [nom]: valeur }))
  const saisie = (nom) => ({ value: champs[nom], onChange: (e) => modifier(nom)(e.target.value) })

  const allerApresConnexion = (profil) => {
    const pageParDefaut = profil.type_utilisateur === 'DETENTEUR' ? '/tableau-de-bord' : '/'
    naviguer(suite ?? pageParDefaut, { remplacer: true })
  }

  const envoyer = async (e) => {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      const profil = connexion
        ? await seConnecter(champs.identifiant, champs.mot_de_passe, { seSouvenir })
        : await sInscrire({
          username: champs.username,
          email: champs.email,
          telephone: `+228${champs.telephone}`,
          mot_de_passe: champs.mot_de_passe,
          first_name: champs.first_name,
          last_name: champs.last_name,
          type_utilisateur: champs.type_utilisateur,
          localisation: champs.localisation,
        })
      allerApresConnexion(profil)
    } catch (err) {
      setErreur(err)
    } finally {
      setEnvoi(false)
    }
  }

  const erreurChamp = (nom) => (erreur instanceof ErreurApi ? erreur.champ(nom) : undefined)
  const erreurGenerale =
    erreur && !(erreur instanceof ErreurApi && Object.keys(CHAMPS_VIDES).some((c) => erreur.champ(c)))
      ? messageErreur(erreur)
      : null

  const changerMode = (nouveau) => {
    setMode(nouveau)
    setErreur(null)
    window.scrollTo(0, 0)
  }

  const finDemarrage = useCallback(() => {
    retenirDemarrage()
    setDemarrage(false)
  }, [])

  if (demarrage) return <EcranDemarrage onTermine={finDemarrage} />

  return (
    <div className="authentification">
      <span className="authentification__cercle" aria-hidden="true" />

      <main className="authentification__contenu">
        <div className="authentification__logo">
          <IconeFeuille width={64} height={64} />
          <span className="authentification__nom">AgriLink</span>
          <span className="authentification__slogan">Machines agricoles près de chez vous</span>
        </div>

        {mode === 'oubli' ? (
          <MotDePasseOublie
            identifiantInitial={champs.identifiant}
            onRetour={() => changerMode('connexion')}
            onConnecte={allerApresConnexion}
          />
        ) : (
          <>
            <div className="authentification__titres">
              <h1>{connexion ? 'Bienvenue' : 'Créer un compte'}</h1>
              <p>
                {suite
                  ? 'Connectez-vous pour envoyer votre demande de réservation'
                  : connexion ? 'Connectez-vous pour continuer' : 'Réservez une machine près de chez vous'}
              </p>
            </div>

            <form className="formulaire" onSubmit={envoyer} noValidate>
              {connexion ? (
                <Champ
                  libelle="Nom d'utilisateur, e-mail ou téléphone"
                  Icone={IconeProfil}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  erreur={erreurChamp('identifiant')}
                  required
                  {...saisie('identifiant')}
                />
              ) : (
                <>
                  <fieldset className="roles">
                    <legend className="champ__libelle">Vous êtes…</legend>
                    {ROLES.map((role) => (
                      <label key={role.valeur} className="role">
                        <input
                          type="radio"
                          name="type_utilisateur"
                          value={role.valeur}
                          checked={champs.type_utilisateur === role.valeur}
                          onChange={(e) => modifier('type_utilisateur')(e.target.value)}
                        />
                        <span className="role__titre">{role.titre}</span>
                      </label>
                    ))}
                    {erreurChamp('type_utilisateur') && <span className="erreur">Choisissez votre profil.</span>}
                  </fieldset>

                  <div className="formulaire__deux">
                    <Champ libelle="Prénom" Icone={IconeProfil} autoComplete="given-name" erreur={erreurChamp('first_name')} required {...saisie('first_name')} />
                    <Champ libelle="Nom" Icone={IconeProfil} autoComplete="family-name" erreur={erreurChamp('last_name')} required {...saisie('last_name')} />
                  </div>
                  <Champ
                    libelle="Nom d'utilisateur"
                    Icone={IconeProfil}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    aide="Lettres, chiffres, point ou tiret bas. Vous pourrez vous connecter avec."
                    erreur={erreurChamp('username')}
                    required
                    {...saisie('username')}
                  />
                  <Champ
                    libelle="E-mail (facultatif)"
                    Icone={IconeEnveloppe}
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    erreur={erreurChamp('email')}
                    {...saisie('email')}
                  />
                  <Champ
                    libelle="Numéro de téléphone"
                    Icone={IconeTelephone}
                    prefixe="+228"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    erreur={erreurChamp('telephone')}
                    required
                    {...saisie('telephone')}
                  />
                </>
              )}

              <ChampMotDePasse
                valeur={champs.mot_de_passe}
                onChange={modifier('mot_de_passe')}
                erreur={erreurChamp('mot_de_passe')}
                nouveau={!connexion}
              />

              {connexion ? (
                <div className="authentification__options">
                  <label className="case">
                    <input type="checkbox" checked={seSouvenir} onChange={(e) => setSeSouvenir(e.target.checked)} />
                    Se souvenir de moi
                  </label>
                  <button type="button" className="lien-texte" onClick={() => changerMode('oubli')}>
                    Mot de passe oublié ?
                  </button>
                </div>
              ) : (
                <Champ
                  libelle="Ville ou village (facultatif)"
                  Icone={IconeRepere}
                  autoComplete="address-level2"
                  {...saisie('localisation')}
                />
              )}

              {erreurGenerale && <p className="erreur" role="alert">{erreurGenerale}</p>}

              <BoutonFleche disabled={envoi}>
                {envoi ? 'Patientez…' : connexion ? 'Se connecter' : 'Créer mon compte'}
              </BoutonFleche>
            </form>

            <p className="authentification__bascule">
              {connexion ? 'Pas encore de compte ?' : 'Déjà un compte ?'}{' '}
              <button type="button" className="lien-texte" onClick={() => changerMode(connexion ? 'inscription' : 'connexion')}>
                {connexion ? 'Créer un compte' : 'Se connecter'}
              </button>
            </p>
          </>
        )}
      </main>
    </div>
  )
}
