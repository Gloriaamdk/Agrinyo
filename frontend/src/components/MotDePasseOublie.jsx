import { useEffect, useState } from 'react'
import * as api from '../api.js'
import { ErreurApi, messageErreur } from '../api.js'
import { useSession } from '../session.jsx'
import { BoutonFleche, Champ, ChampMotDePasse } from './ChampsAuthentification.jsx'
import { IconeCadenas, IconeProfil } from './Icones.jsx'

// Même délai que le serveur (comptes.reinitialisation.DELAI_RENVOI).
const DELAI_RENVOI_S = 60

/**
 * « Mot de passe oublié » en deux étapes :
 * 1. l'identifiant → un code part à l'adresse e-mail du compte (ou par SMS, selon le serveur) ;
 * 2. le code + le nouveau mot de passe → la personne est connectée.
 */
export default function MotDePasseOublie({ identifiantInitial, onRetour, onConnecte }) {
  const { reinitialiserMotDePasse } = useSession()
  const [etape, setEtape] = useState('demande')
  const [identifiant, setIdentifiant] = useState(identifiantInitial)
  const [code, setCode] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [attente, setAttente] = useState(0)
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  // « email » ou « sms » : canal choisi par le serveur (réponse de /api/password/forgot/).
  const [canal, setCanal] = useState(null)

  useEffect(() => {
    if (attente <= 0) return
    const minuteur = setTimeout(() => setAttente((s) => s - 1), 1000)
    return () => clearTimeout(minuteur)
  }, [attente])

  const executer = async (action) => {
    setEnvoi(true)
    setErreur(null)
    try {
      await action()
    } catch (err) {
      setErreur(err)
    } finally {
      setEnvoi(false)
    }
  }

  const envoyerCode = () =>
    executer(async () => {
      const reponse = await api.demanderCode(identifiant)
      setCanal(reponse?.canal ?? null)
      setEtape('code')
      setCode('')
      setAttente(DELAI_RENVOI_S)
    })

  const demander = (e) => {
    e.preventDefault()
    envoyerCode()
  }

  const reinitialiser = (e) => {
    e.preventDefault()
    executer(async () => {
      onConnecte(await reinitialiserMotDePasse({ identifiant, code, mot_de_passe: motDePasse }))
    })
  }

  const erreurChamp = (nom) => (erreur instanceof ErreurApi ? erreur.champ(nom) : undefined)
  const erreurGenerale =
    erreur && !(erreur instanceof ErreurApi && ['identifiant', 'code', 'mot_de_passe'].some((c) => erreur.champ(c)))
      ? messageErreur(erreur)
      : null

  return (
    <>
      <div className="authentification__titres">
        <h1>Mot de passe oublié</h1>
        <p>
          {etape === 'demande'
            ? 'Recevez un code de vérification'
            : `Saisissez le code reçu par ${canal === 'sms' ? 'SMS' : 'e-mail'}`}
        </p>
      </div>

      {etape === 'demande' ? (
        <form className="formulaire" onSubmit={demander} noValidate>
          <Champ
            libelle="Nom d'utilisateur, e-mail ou téléphone"
            Icone={IconeProfil}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            aide="Le code sera envoyé à l’adresse e-mail de votre compte."
            erreur={erreurChamp('identifiant')}
            value={identifiant}
            onChange={(e) => setIdentifiant(e.target.value)}
            required
          />
          {erreurGenerale && <p className="erreur" role="alert">{erreurGenerale}</p>}
          <BoutonFleche disabled={envoi || !identifiant.trim()}>{envoi ? 'Envoi…' : 'Recevoir le code'}</BoutonFleche>
        </form>
      ) : (
        <form className="formulaire" onSubmit={reinitialiser} noValidate>
          <p className="authentification__note" role="status">
            {canal === 'sms' ? (
              <>
                Si un compte correspond à « {identifiant.trim()} », un code à 6 chiffres vient d’être envoyé par SMS
                au numéro du compte. Il est valable 10 minutes.
              </>
            ) : (
              <>
                Si un compte avec une adresse e-mail correspond à « {identifiant.trim()} », un code à 6 chiffres vient
                d’être envoyé à cette adresse. Il est valable 10 minutes. Pensez à regarder dans les courriers
                indésirables. Compte sans adresse e-mail : contactez l’équipe AgriLink.
              </>
            )}
          </p>
          <Champ
            libelle="Code à 6 chiffres"
            Icone={IconeCadenas}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            erreur={erreurChamp('code')}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
          />
          <ChampMotDePasse
            libelle="Nouveau mot de passe"
            valeur={motDePasse}
            onChange={setMotDePasse}
            erreur={erreurChamp('mot_de_passe')}
            nouveau
          />
          {erreurGenerale && <p className="erreur" role="alert">{erreurGenerale}</p>}
          <BoutonFleche disabled={envoi || code.length !== 6 || !motDePasse}>
            {envoi ? 'Patientez…' : 'Changer le mot de passe'}
          </BoutonFleche>
          <div className="authentification__options">
            <button type="button" className="lien-texte" onClick={envoyerCode} disabled={envoi || attente > 0}>
              {attente > 0 ? `Renvoyer le code (${attente} s)` : 'Renvoyer le code'}
            </button>
            <button type="button" className="lien-texte" onClick={() => { setEtape('demande'); setErreur(null) }}>
              Changer d’identifiant
            </button>
          </div>
        </form>
      )}

      <p className="authentification__bascule">
        <button type="button" className="lien-texte" onClick={onRetour}>
          Retour à la connexion
        </button>
      </p>
    </>
  )
}
