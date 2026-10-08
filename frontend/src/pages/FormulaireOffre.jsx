import { useEffect, useRef, useState } from 'react'
import { ErreurApi, getFiltres, lancerOffre, messageErreur, useDonnees } from '../api.js'
import EnTetePage from '../components/EnTetePage.jsx'
import Lien from '../components/Lien.jsx'
import Navigation from '../components/Navigation.jsx'
import { aujourdhui, iconeMachine } from '../format.js'
import { naviguer } from '../routeur.js'
import { useSession } from '../session.jsx'

const CHAMPS = ['type_machine', 'description', 'zone', 'localisation', 'date_souhaitee', 'budget', 'unite_budget']
const LONGUEUR_MAX = 1000 // Offre.LONGUEUR_MAX côté serveur

/** Champs obligatoires vérifiés avant l'envoi, avec des messages clairs. */
function verifierChamps(champs) {
  const details = {}
  if (!champs.type_machine) details.type_machine = ['Choisissez le type de machine.']
  if (!champs.description.trim()) details.description = ['Décrivez votre besoin en quelques mots.']
  if (!champs.zone) details.zone = ['Choisissez la région.']
  if (!champs.localisation.trim()) details.localisation = ['Indiquez la ville ou le village.']
  if (champs.budget !== '' && !(Number.isInteger(Number(champs.budget)) && Number(champs.budget) >= 1)) {
    details.budget = ['Indiquez un montant en FCFA, sans virgule, ou laissez vide.']
  }
  return Object.keys(details).length > 0 ? new ErreurApi(400, details) : null
}

function Champ({ libelle, erreur, aide, facultatif = false, children }) {
  return (
    <label className="champ">
      <span className="champ__libelle">
        {libelle} {facultatif && <span className="champ__facultatif">(facultatif)</span>}
      </span>
      {children}
      {aide && !erreur && <span className="champ__aide">{aide}</span>}
      {erreur && <span className="erreur">{erreur}</span>}
    </label>
  )
}

function Formulaire({ choix }) {
  const { utilisateur } = useSession()
  const formulaire = useRef(null)
  // Type et région repris de la page Machines (/offres/nouvelle?type=BATTEUSE&zone=KARA).
  const [champs, setChamps] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const valide = (liste, valeur) => (liste.some((c) => c.valeur === valeur) ? valeur : '')
    return {
      type_machine: valide(choix.tous_les_types, params.get('type')),
      description: '',
      zone: valide(choix.zones, params.get('zone')),
      localisation: utilisateur.localisation ?? '',
      date_souhaitee: '',
      budget: '',
      unite_budget: 'JOUR',
    }
  })
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [corriges, setCorriges] = useState(() => new Set())

  const modifier = (nom, valeur) => {
    setChamps((c) => ({ ...c, [nom]: valeur }))
    setCorriges((actuels) => new Set(actuels).add(nom))
  }
  const erreurChamp = (nom) => (erreur instanceof ErreurApi && !corriges.has(nom) ? erreur.champ(nom) : undefined)
  const saisie = (nom) => ({
    value: champs[nom],
    onChange: (e) => modifier(nom, e.target.value),
    'aria-invalid': Boolean(erreurChamp(nom)),
  })
  const erreurGenerale = erreur && !(erreur instanceof ErreurApi && CHAMPS.some((c) => erreur.champ(c)))

  useEffect(() => {
    if (erreur) formulaire.current.querySelector('[aria-invalid="true"]')?.focus()
  }, [erreur])

  const signaler = (nouvelle) => {
    setErreur(nouvelle)
    setCorriges(new Set())
  }

  const envoyer = async (e) => {
    e.preventDefault()
    const invalide = verifierChamps(champs)
    if (invalide) return signaler(invalide)
    setEnvoi(true)
    setErreur(null)
    try {
      await lancerOffre({
        ...champs,
        description: champs.description.trim(),
        date_souhaitee: champs.date_souhaitee || null,
        budget: champs.budget === '' ? null : Number(champs.budget),
      })
      naviguer('/offres', { remplacer: true })
    } catch (err) {
      signaler(err)
      setEnvoi(false)
    }
  }

  return (
    <form ref={formulaire} className="carte-formulaire formulaire" onSubmit={envoyer} noValidate>
      <Champ libelle="Machine recherchée" erreur={erreurChamp('type_machine')}>
        <select required {...saisie('type_machine')}>
          <option value="" disabled>Choisir un type</option>
          {choix.tous_les_types.map((t) => (
            <option key={t.valeur} value={t.valeur}>{iconeMachine(t.valeur)} {t.libelle}</option>
          ))}
        </select>
      </Champ>

      <Champ
        libelle="Votre besoin"
        erreur={erreurChamp('description')}
        aide="Travail à faire, surface, avec ou sans chauffeur…"
      >
        <textarea
          rows={4}
          maxLength={LONGUEUR_MAX}
          placeholder="Ex. : batteuse à maïs pour 3 hectares, juste après la récolte."
          required
          {...saisie('description')}
        />
      </Champ>

      <div className="formulaire__deux">
        <Champ libelle="Région" erreur={erreurChamp('zone')}>
          <select required {...saisie('zone')}>
            <option value="" disabled>Choisir</option>
            {choix.zones.map((z) => (
              <option key={z.valeur} value={z.valeur}>{z.libelle}</option>
            ))}
          </select>
        </Champ>
        <Champ libelle="Ville ou village" erreur={erreurChamp('localisation')}>
          <input type="text" maxLength={100} autoComplete="address-level2" required {...saisie('localisation')} />
        </Champ>
      </div>

      <Champ libelle="À partir du" erreur={erreurChamp('date_souhaitee')} facultatif>
        <input type="date" min={aujourdhui()} {...saisie('date_souhaitee')} />
      </Champ>

      <div className="champ">
        <span className="champ__libelle" id="libelle-budget">
          Budget <span className="champ__facultatif">(facultatif)</span>
        </span>
        <div className="prix-saisie">
          <span className="prix-saisie__montant">
            <input type="number" inputMode="numeric" min={1} step={1} placeholder="10000" aria-labelledby="libelle-budget" {...saisie('budget')} />
            <span aria-hidden="true">FCFA</span>
          </span>
          <span className="prix-saisie__par" aria-hidden="true">par</span>
          <div className="segments" role="radiogroup" aria-label="Unité du budget">
            {choix.unites.map((u) => (
              <label key={u.valeur} className="segment">
                <input
                  type="radio"
                  name="unite_budget"
                  value={u.valeur}
                  checked={champs.unite_budget === u.valeur}
                  onChange={() => modifier('unite_budget', u.valeur)}
                />
                {u.libelle}
              </label>
            ))}
          </div>
        </div>
        {erreurChamp('budget') && <span className="erreur">{erreurChamp('budget')}</span>}
      </div>

      {erreurGenerale && <p className="erreur" role="alert">{messageErreur(erreur)}</p>}

      <button type="submit" className="bouton bouton--plein bouton--large bouton--grand" disabled={envoi}>
        {envoi ? 'Envoi…' : 'Lancer l’offre'}
      </button>
    </form>
  )
}

/** Agriculteur : décrire une machine absente du catalogue pour que les propriétaires la proposent. */
export default function FormulaireOffre() {
  const [essai, setEssai] = useState(0)
  const choix = useDonnees(`filtres|${essai}`, getFiltres)

  return (
    <div className="page">
      <EnTetePage titre="Lancer une offre" sousTitre="Les propriétaires de votre région verront ce que vous cherchez." />
      <main className="contenu contenu--etroit">
        <Lien vers="/offres" className="lien-retour">← Mes offres</Lien>
        {choix.etat === 'chargement' && <div className="carte-formulaire squelette" style={{ height: 480 }} aria-busy="true" aria-label="Chargement" />}
        {choix.etat === 'erreur' && (
          <div className="message" role="alert">
            <p>{messageErreur(choix.erreur)}</p>
            <button type="button" className="bouton bouton--plein" onClick={() => setEssai((n) => n + 1)}>Réessayer</button>
          </div>
        )}
        {choix.etat === 'pret' && <Formulaire choix={choix.donnees} />}
      </main>
      <Navigation variante="bas" />
    </div>
  )
}
