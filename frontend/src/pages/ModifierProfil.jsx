import { useEffect, useRef, useState } from 'react'
import { demanderChangementTelephone, ErreurApi, messageErreur } from '../api.js'
import Avatar from '../components/Avatar.jsx'
import EnTetePage from '../components/EnTetePage.jsx'
import { IconeOeil } from '../components/Icones.jsx'
import Lien from '../components/Lien.jsx'
import Navigation from '../components/Navigation.jsx'
import { formaterTelephone } from '../format.js'
import { useSession } from '../session.jsx'

// Même délai que le serveur (comptes.codes.DELAI_RENVOI).
const DELAI_RENVOI_S = 60

/** Petit état « envoi / erreur / réussite » partagé par les blocs de la page. */
function useEnvoi() {
  const [etat, setEtat] = useState({ envoi: false, erreur: null, message: null })
  const executer = async (action, messageReussite) => {
    setEtat({ envoi: true, erreur: null, message: null })
    try {
      await action()
      setEtat({ envoi: false, erreur: null, message: messageReussite })
    } catch (erreur) {
      setEtat({ envoi: false, erreur, message: null })
    }
  }
  const effacer = () => setEtat({ envoi: false, erreur: null, message: null })
  const erreurChamp = (nom) => (etat.erreur instanceof ErreurApi ? etat.erreur.champ(nom) : undefined)
  return { ...etat, executer, effacer, erreurChamp }
}

function ChampTexte({ libelle, erreur, aide, facultatif = false, ...attributs }) {
  return (
    <label className="champ">
      <span className="champ__libelle">
        {libelle} {facultatif && <span className="champ__facultatif">(facultatif)</span>}
      </span>
      <input aria-invalid={Boolean(erreur)} {...attributs} />
      {aide && !erreur && <span className="champ__aide">{aide}</span>}
      {erreur && <span className="erreur">{erreur}</span>}
    </label>
  )
}

function ChampMotDePasse({ libelle, valeur, onChange, erreur, nouveau = false }) {
  const [visible, setVisible] = useState(false)
  return (
    <label className="champ">
      <span className="champ__libelle">{libelle}</span>
      <span className="champ__mdp">
        <input
          type={visible ? 'text' : 'password'}
          autoComplete={nouveau ? 'new-password' : 'current-password'}
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(erreur)}
          required
        />
        <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
          <IconeOeil barre={!visible} />
        </button>
      </span>
      {nouveau && !erreur && <span className="champ__aide">8 caractères minimum, pas seulement des chiffres.</span>}
      {erreur && <span className="erreur">{erreur}</span>}
    </label>
  )
}

/** Message général d'un bloc : réussite, ou erreur qui ne concerne aucun champ précis. */
function Retour({ envoi, champs }) {
  const { erreur, message } = envoi
  if (message) return <p className="succes" role="status">{message}</p>
  if (erreur && !(erreur instanceof ErreurApi && champs.some((c) => erreur.champ(c)))) {
    return <p className="erreur" role="alert">{messageErreur(erreur)}</p>
  }
  return null
}

function BlocPhoto() {
  const { utilisateur, modifierProfil } = useSession()
  const envoi = useEnvoi()
  const fichier = useRef(null)

  const choisir = (e) => {
    const photo = e.target.files[0]
    e.target.value = '' // permet de reprendre la même photo après une erreur
    if (photo) envoi.executer(() => modifierProfil(photo), 'Photo mise à jour.')
  }

  return (
    <section className="carte-formulaire" aria-labelledby="titre-photo">
      <h2 id="titre-photo" className="carte-formulaire__titre">Photo de profil</h2>
      <div className="photo-profil">
        <Avatar nom={utilisateur.first_name} photo={utilisateur.photo} grand />
        <div className="photo-profil__actions">
          <button type="button" className="bouton bouton--plein bouton--petit" onClick={() => fichier.current.click()} disabled={envoi.envoi}>
            {envoi.envoi ? 'Envoi…' : utilisateur.photo ? 'Changer la photo' : 'Ajouter une photo'}
          </button>
          {utilisateur.photo && (
            <button
              type="button"
              className="bouton bouton--contour bouton--petit"
              onClick={() => envoi.executer(() => modifierProfil({ supprimer_photo: true }), 'Photo retirée.')}
              disabled={envoi.envoi}
            >
              Retirer
            </button>
          )}
        </div>
        <input ref={fichier} type="file" accept="image/jpeg,image/png,image/webp" onChange={choisir} hidden />
      </div>
      <p className="champ__aide">JPEG, PNG ou WebP, 5 Mo au maximum.</p>
      {envoi.erreurChamp('photo') && <p className="erreur" role="alert">{envoi.erreurChamp('photo')}</p>}
      <Retour envoi={envoi} champs={['photo']} />
    </section>
  )
}

const CHAMPS_INFOS = ['first_name', 'last_name', 'username', 'email', 'localisation']

function BlocInformations() {
  const { utilisateur, modifierProfil } = useSession()
  const envoi = useEnvoi()
  const [champs, setChamps] = useState(() => ({
    first_name: utilisateur.first_name,
    last_name: utilisateur.last_name,
    username: utilisateur.username,
    email: utilisateur.email ?? '',
    localisation: utilisateur.localisation,
  }))
  const saisie = (nom) => ({
    value: champs[nom],
    onChange: (e) => setChamps((c) => ({ ...c, [nom]: e.target.value })),
    erreur: envoi.erreurChamp(nom),
  })

  const enregistrer = (e) => {
    e.preventDefault()
    envoi.executer(() => modifierProfil(champs), 'Informations enregistrées.')
  }

  return (
    <section className="carte-formulaire" aria-labelledby="titre-infos">
      <h2 id="titre-infos" className="carte-formulaire__titre">Informations</h2>
      <form className="formulaire" onSubmit={enregistrer} noValidate>
        <div className="formulaire__deux">
          <ChampTexte libelle="Prénom" autoComplete="given-name" required {...saisie('first_name')} />
          <ChampTexte libelle="Nom" autoComplete="family-name" required {...saisie('last_name')} />
        </div>
        <ChampTexte
          libelle="Nom d’utilisateur"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          aide="Lettres, chiffres, point ou tiret bas. Il sert aussi à se connecter."
          required
          {...saisie('username')}
        />
        <ChampTexte libelle="E-mail" type="email" autoComplete="email" autoCapitalize="none" facultatif {...saisie('email')} />
        <ChampTexte libelle="Ville ou village" autoComplete="address-level2" facultatif {...saisie('localisation')} />
        <Retour envoi={envoi} champs={CHAMPS_INFOS} />
        <button type="submit" className="bouton bouton--plein bouton--large" disabled={envoi.envoi}>
          {envoi.envoi ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </section>
  )
}

/** Nouveau numéro → code envoyé par SMS à ce numéro → le numéro du compte change une fois le code saisi. */
function BlocTelephone() {
  const { utilisateur, confirmerTelephone } = useSession()
  const envoi = useEnvoi()
  const [etape, setEtape] = useState('saisie')
  const [numero, setNumero] = useState('')
  const [code, setCode] = useState('')
  const [attente, setAttente] = useState(0)

  useEffect(() => {
    if (attente <= 0) return
    const minuteur = setTimeout(() => setAttente((s) => s - 1), 1000)
    return () => clearTimeout(minuteur)
  }, [attente])

  const envoyerCode = () =>
    envoi.executer(async () => {
      await demanderChangementTelephone(`+228${numero}`)
      setEtape('code')
      setCode('')
      setAttente(DELAI_RENVOI_S)
    }, null)

  const demander = (e) => {
    e.preventDefault()
    envoyerCode()
  }

  const confirmer = (e) => {
    e.preventDefault()
    envoi.executer(async () => {
      await confirmerTelephone(code)
      setEtape('saisie')
      setNumero('')
    }, 'Numéro de téléphone mis à jour.')
  }

  const annuler = () => {
    setEtape('saisie')
    setCode('')
    envoi.effacer()
  }

  return (
    <section className="carte-formulaire" aria-labelledby="titre-telephone">
      <h2 id="titre-telephone" className="carte-formulaire__titre">Téléphone</h2>
      <p>
        Numéro actuel : <strong>{formaterTelephone(utilisateur.telephone)}</strong>
      </p>

      {etape === 'saisie' ? (
        <form className="formulaire" onSubmit={demander} noValidate>
          <label className="champ">
            <span className="champ__libelle">Nouveau numéro</span>
            <span className="champ__telephone">
              <span className="champ__indicatif" aria-hidden="true">+228</span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="90 12 34 56"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                aria-invalid={Boolean(envoi.erreurChamp('telephone'))}
                required
              />
            </span>
            {envoi.erreurChamp('telephone') ? (
              <span className="erreur">{envoi.erreurChamp('telephone')}</span>
            ) : (
              <span className="champ__aide">Un code de vérification sera envoyé par SMS à ce nouveau numéro.</span>
            )}
          </label>
          <Retour envoi={envoi} champs={['telephone']} />
          <button type="submit" className="bouton bouton--contour bouton--large" disabled={envoi.envoi || !numero.trim()}>
            {envoi.envoi ? 'Envoi…' : 'Recevoir le code'}
          </button>
        </form>
      ) : (
        <form className="formulaire" onSubmit={confirmer} noValidate>
          <p className="authentification__note" role="status">
            Un code à 6 chiffres vient d’être envoyé par SMS au <strong>+228 {numero.trim()}</strong>. Il est valable
            10 minutes.
          </p>
          <ChampTexte
            libelle="Code reçu par SMS"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            erreur={envoi.erreurChamp('code')}
            required
          />
          <Retour envoi={envoi} champs={['code']} />
          <button type="submit" className="bouton bouton--plein bouton--large" disabled={envoi.envoi || code.length !== 6}>
            {envoi.envoi ? 'Vérification…' : 'Confirmer le nouveau numéro'}
          </button>
          <div className="authentification__options">
            <button type="button" className="lien-texte" onClick={envoyerCode} disabled={envoi.envoi || attente > 0}>
              {attente > 0 ? `Renvoyer le code (${attente} s)` : 'Renvoyer le code'}
            </button>
            <button type="button" className="lien-texte" onClick={annuler}>
              Annuler
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

function BlocMotDePasse() {
  const { changerMotDePasse } = useSession()
  const envoi = useEnvoi()
  const [ancien, setAncien] = useState('')
  const [nouveau, setNouveau] = useState('')

  const changer = (e) => {
    e.preventDefault()
    envoi.executer(async () => {
      await changerMotDePasse(ancien, nouveau)
      setAncien('')
      setNouveau('')
    }, 'Mot de passe changé. Vos autres appareils ont été déconnectés.')
  }

  return (
    <section className="carte-formulaire" aria-labelledby="titre-mdp">
      <h2 id="titre-mdp" className="carte-formulaire__titre">Mot de passe</h2>
      <form className="formulaire" onSubmit={changer} noValidate>
        <ChampMotDePasse libelle="Mot de passe actuel" valeur={ancien} onChange={setAncien} erreur={envoi.erreurChamp('ancien_mot_de_passe')} />
        <ChampMotDePasse libelle="Nouveau mot de passe" valeur={nouveau} onChange={setNouveau} erreur={envoi.erreurChamp('nouveau_mot_de_passe')} nouveau />
        <Retour envoi={envoi} champs={['ancien_mot_de_passe', 'nouveau_mot_de_passe']} />
        <button type="submit" className="bouton bouton--contour bouton--large" disabled={envoi.envoi || !ancien || !nouveau}>
          {envoi.envoi ? 'Patientez…' : 'Changer le mot de passe'}
        </button>
      </form>
    </section>
  )
}

export default function ModifierProfil() {
  return (
    <div className="page">
      <EnTetePage titre="Modifier le profil" />
      <main className="contenu contenu--etroit">
        <Lien vers="/profil" className="lien-retour">← Retour au profil</Lien>
        <BlocPhoto />
        <BlocInformations />
        <BlocTelephone />
        <BlocMotDePasse />
      </main>
      <Navigation variante="bas" />
    </div>
  )
}
