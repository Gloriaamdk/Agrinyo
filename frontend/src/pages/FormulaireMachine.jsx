import { useEffect, useRef, useState } from 'react'
import {
  creerMachine, ErreurApi, getFiltres, getMachine, getOffre, messageErreur, modifierMachine, proposerMachine,
  supprimerMachine, urlMedia,
  useDonnees,
} from '../api.js'
import EnTetePage from '../components/EnTetePage.jsx'
import { IconePhoto, IconePoubelle } from '../components/Icones.jsx'
import Lien from '../components/Lien.jsx'
import Navigation from '../components/Navigation.jsx'
import { iconeMachine } from '../format.js'
import { naviguer } from '../routeur.js'
import { useSession } from '../session.jsx'
import { InterrupteurDisponible } from './MesMachines.jsx'

const CHAMPS = ['photo', 'type_machine', 'nom', 'description', 'prix', 'unite_prix', 'zone', 'localisation', 'disponible']

const VIDE = {
  type_machine: '',
  nom: '',
  description: '',
  prix: '',
  unite_prix: 'JOUR',
  zone: '',
  localisation: '',
  disponible: true,
}

/** Champs obligatoires vérifiés avant l'envoi, avec des messages plus parlants que ceux du serveur. */
function verifierChamps(champs) {
  const details = {}
  if (!champs.type_machine) details.type_machine = ['Choisissez le type de machine.']
  if (!champs.nom.trim()) details.nom = ['Donnez un nom à la machine.']
  const prix = Number(champs.prix)
  if (champs.prix === '' || !Number.isInteger(prix) || prix < 1) details.prix = ['Indiquez un prix en FCFA, sans virgule.']
  if (!champs.zone) details.zone = ['Choisissez la région.']
  if (!champs.localisation.trim()) details.localisation = ['Indiquez la ville ou le village.']
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

/** Photo : aperçu immédiat du fichier choisi, envoyé avec le reste du formulaire. */
function ChoixPhoto({ photoActuelle, apercu, retiree, type, onChoisir, onRetirer, erreur }) {
  const entree = useRef(null)
  const affichee = apercu ?? (retiree ? null : photoActuelle)
  const choisir = (e) => {
    const photo = e.target.files[0]
    e.target.value = '' // permet de reprendre la même photo après une erreur
    if (photo) onChoisir(photo)
  }

  return (
    <div className="champ">
      <span className="champ__libelle">Photo</span>
      <div className="choix-photo">
        <button
          type="button"
          className="choix-photo__cadre"
          onClick={() => entree.current.click()}
          aria-label={affichee ? 'Changer la photo' : 'Ajouter une photo'}
          aria-invalid={Boolean(erreur)}
        >
          {affichee ? (
            <img src={affichee} alt="" />
          ) : (
            <span className="choix-photo__vide">
              <span aria-hidden="true">{type ? iconeMachine(type) : <IconePhoto width={40} height={40} />}</span>
              Ajouter une photo
            </span>
          )}
        </button>
        <div className="choix-photo__actions">
          <button type="button" className="bouton bouton--contour bouton--petit" onClick={() => entree.current.click()}>
            <IconePhoto width={20} height={20} /> {affichee ? 'Changer' : 'Choisir une photo'}
          </button>
          {affichee && (
            <button type="button" className="bouton bouton--contour bouton--petit" onClick={onRetirer}>
              Retirer
            </button>
          )}
        </div>
      </div>
      <input ref={entree} type="file" accept="image/jpeg,image/png,image/webp" onChange={choisir} hidden />
      {erreur ? <span className="erreur">{erreur}</span> : <span className="champ__aide">Une photo nette de la machine rassure les agriculteurs. JPEG, PNG ou WebP, 5 Mo maximum.</span>}
    </div>
  )
}

/**
 * Suppression avec confirmation. S'il reste des réservations acceptées à venir, le serveur refuse (409)
 * et rend lui-même la machine indisponible : on reprend son état renvoyé dans la réponse.
 */
function ZoneSuppression({ machine, onIndisponible }) {
  const [etape, setEtape] = useState('repos') // repos | confirmation | envoi
  const [refus, setRefus] = useState(null)

  const supprimer = async () => {
    setEtape('envoi')
    setRefus(null)
    try {
      await supprimerMachine(machine.id)
      naviguer('/mes-machines', { remplacer: true })
    } catch (err) {
      // Le message du serveur explique déjà que la machine est désormais indisponible.
      if (err instanceof ErreurApi && err.statut === 409 && err.details.machine?.disponible === false) onIndisponible()
      setRefus({ message: messageErreur(err) })
      setEtape('repos')
    }
  }

  return (
    <section className="carte-formulaire zone-danger" aria-labelledby="titre-suppression">
      <h2 id="titre-suppression" className="carte-formulaire__titre">Supprimer la machine</h2>
      {refus ? (
        <div className="refus" role="alert">
          <p><strong>Suppression impossible.</strong> {refus.message}</p>
        </div>
      ) : etape === 'repos' ? (
        <>
          <p className="champ__aide">La machine disparaîtra de l’application, avec ses demandes et ses avis.</p>
          <button type="button" className="bouton bouton--contour-danger bouton--large" onClick={() => setEtape('confirmation')}>
            <IconePoubelle /> Supprimer cette machine
          </button>
        </>
      ) : (
        <div className="resa__confirmer">
          <p>Supprimer définitivement <strong>{machine.nom}</strong> ? Cette action est irréversible.</p>
          <div className="resa__boutons">
            <button type="button" className="bouton bouton--danger bouton--petit" onClick={supprimer} disabled={etape === 'envoi'}>
              {etape === 'envoi' ? 'Suppression…' : 'Oui, supprimer'}
            </button>
            <button type="button" className="bouton bouton--contour bouton--petit" onClick={() => setEtape('repos')} disabled={etape === 'envoi'}>
              Non, garder
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function Formulaire({ machine, choix, offre }) {
  const formulaire = useRef(null)
  const [champs, setChamps] = useState(() =>
    machine
      ? Object.fromEntries(Object.keys(VIDE).map((nom) => [nom, machine[nom] ?? VIDE[nom]]))
      : offre
        ? { ...VIDE, type_machine: offre.type_machine, zone: offre.zone, localisation: offre.localisation }
        : VIDE,
  )
  const [photo, setPhoto] = useState(null) // { fichier, apercu }
  const [photoRetiree, setPhotoRetiree] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  // Champs retouchés depuis la dernière erreur : leur message disparaît aussitôt.
  const [corriges, setCorriges] = useState(() => new Set())

  const modifier = (nom, valeur) => {
    setChamps((c) => ({ ...c, [nom]: valeur }))
    setCorriges((actuels) => new Set(actuels).add(nom))
  }
  const saisie = (nom) => ({
    value: champs[nom],
    onChange: (e) => modifier(nom, e.target.value),
    'aria-invalid': Boolean(erreurChamp(nom)),
  })
  const erreurChamp = (nom) => (erreur instanceof ErreurApi && !corriges.has(nom) ? erreur.champ(nom) : undefined)
  const erreurGenerale = erreur && !(erreur instanceof ErreurApi && CHAMPS.some((c) => erreur.champ(c)))
  const resteACorriger = !erreurGenerale && CHAMPS.some((c) => erreurChamp(c))

  const signaler = (nouvelle) => {
    setErreur(nouvelle)
    setCorriges(new Set())
  }

  // Après un refus, on amène la personne sur le premier champ à corriger.
  useEffect(() => {
    if (erreur) formulaire.current.querySelector('[aria-invalid="true"]')?.focus()
  }, [erreur])

  const enregistrer = async (e) => {
    e.preventDefault()
    const invalide = verifierChamps(champs)
    if (invalide) return signaler(invalide)
    setEnvoi(true)
    setErreur(null)
    const donnees = { ...champs, description: champs.description.trim() }
    let corps = donnees
    if (photo) {
      // Une photo part en multipart, avec tous les autres champs.
      corps = new FormData()
      for (const [nom, valeur] of Object.entries(donnees)) corps.append(nom, String(valeur))
      corps.append('photo', photo.fichier)
    } else if (photoRetiree) {
      corps = { ...donnees, supprimer_photo: true }
    }
    let creee = null
    try {
      if (machine) await modifierMachine(machine.id, corps)
      else creee = await creerMachine(corps)
    } catch (err) {
      signaler(err)
      setEnvoi(false)
      return
    }
    if (!offre) return naviguer('/mes-machines', { remplacer: true })
    // Ajoutée pour une offre : on la propose aussitôt à l'agriculteur.
    try {
      await proposerMachine(offre.id, { machine: creee.id })
      naviguer('/offres?proposee', { remplacer: true })
    } catch {
      // La machine existe : la page de proposition permet de réessayer.
      naviguer(`/offres/${offre.id}/proposer`, { remplacer: true })
    }
  }

  // Déjà enregistré par le serveur : on aligne l'interrupteur sans marquer le champ comme modifié.
  const machineDevenueIndisponible = () => setChamps((c) => ({ ...c, disponible: false }))

  return (
    <>
      <form ref={formulaire} className="carte-formulaire formulaire" onSubmit={enregistrer} noValidate>
        <ChoixPhoto
          photoActuelle={urlMedia(machine?.photo)}
          apercu={photo?.apercu}
          retiree={photoRetiree}
          type={champs.type_machine}
          onChoisir={(fichier) => {
            // Aperçu en data URL : rien à libérer ensuite.
            const lecteur = new FileReader()
            lecteur.onload = () => setPhoto({ fichier, apercu: lecteur.result })
            lecteur.readAsDataURL(fichier)
            setPhotoRetiree(false)
            setCorriges((actuels) => new Set(actuels).add('photo'))
          }}
          onRetirer={() => {
            setPhoto(null)
            setPhotoRetiree(true)
          }}
          erreur={erreurChamp('photo')}
        />

        <Champ libelle="Type de machine" erreur={erreurChamp('type_machine')}>
          <select required {...saisie('type_machine')}>
            <option value="" disabled>Choisir un type</option>
            {choix.tous_les_types.map((t) => (
              <option key={t.valeur} value={t.valeur}>{iconeMachine(t.valeur)} {t.libelle}</option>
            ))}
          </select>
        </Champ>

        <Champ libelle="Nom" erreur={erreurChamp('nom')} aide="Marque et modèle, par exemple « Tracteur Massey Ferguson 375 ».">
          <input type="text" maxLength={120} required {...saisie('nom')} />
        </Champ>

        <Champ libelle="Description" erreur={erreurChamp('description')} facultatif>
          <textarea rows={4} placeholder="État, puissance, chauffeur fourni, conditions…" {...saisie('description')} />
        </Champ>

        <div className="champ">
          <span className="champ__libelle" id="libelle-prix">Prix</span>
          <div className="prix-saisie">
            <span className="prix-saisie__montant">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                placeholder="25000"
                aria-labelledby="libelle-prix"
                required
                {...saisie('prix')}
              />
              <span aria-hidden="true">FCFA</span>
            </span>
            <span className="prix-saisie__par" aria-hidden="true">par</span>
            <div className="segments" role="radiogroup" aria-label="Unité de prix">
              {choix.unites.map((u) => (
                <label key={u.valeur} className="segment">
                  <input
                    type="radio"
                    name="unite_prix"
                    value={u.valeur}
                    checked={champs.unite_prix === u.valeur}
                    onChange={() => modifier('unite_prix', u.valeur)}
                  />
                  {u.libelle}
                </label>
              ))}
            </div>
          </div>
          {(erreurChamp('prix') || erreurChamp('unite_prix')) && (
            <span className="erreur">{erreurChamp('prix') ?? erreurChamp('unite_prix')}</span>
          )}
        </div>

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

        <div className="champ">
          <span className="champ__libelle">Disponibilité</span>
          <InterrupteurDisponible disponible={champs.disponible} onBasculer={() => modifier('disponible', !champs.disponible)} />
          <span className="champ__aide">
            {champs.disponible
              ? 'Les agriculteurs voient la machine et peuvent la réserver.'
              : 'La machine est cachée : personne ne peut la réserver.'}
          </span>
          {erreurChamp('disponible') && <span className="erreur">{erreurChamp('disponible')}</span>}
        </div>

        {erreurGenerale && <p className="erreur" role="alert">{messageErreur(erreur)}</p>}
        {resteACorriger && <p className="erreur" role="alert">Certains champs sont à corriger.</p>}

        <button type="submit" className="bouton bouton--plein bouton--large bouton--grand" disabled={envoi}>
          {envoi ? 'Enregistrement…' : machine ? 'Enregistrer les modifications' : 'Publier la machine'}
        </button>
      </form>

      {machine && <ZoneSuppression machine={machine} onIndisponible={machineDevenueIndisponible} />}
    </>
  )
}

/** Ajout (/mes-machines/ajouter) ou modification (/mes-machines/12) d'une machine. */
export default function FormulaireMachine({ id = null }) {
  const { utilisateur } = useSession()
  const [essai, setEssai] = useState(0)
  const choix = useDonnees(`filtres|${essai}`, getFiltres)
  const detail = useDonnees(id === null ? null : `machine|${id}|${essai}`, (signal) => getMachine(id, signal))
  // Ajout pour une offre d'agriculteur (/mes-machines/ajouter?offre=4) : champs pré-remplis, proposition envoyée ensuite.
  const [offreId] = useState(() => (id === null ? Number(new URLSearchParams(window.location.search).get('offre')) || null : null))
  const offre = useDonnees(offreId === null ? null : `offre|${offreId}`, (signal) => getOffre(offreId, signal))

  const etat = choix.etat === 'erreur' || detail.etat === 'erreur' ? 'erreur'
    : choix.etat === 'chargement' || detail.etat === 'chargement' || offre.etat === 'chargement' ? 'chargement'
      : 'pret'
  // La fiche publique se charge pour toute machine : on vérifie qu'elle appartient bien à cette personne.
  const introuvable =
    (detail.etat === 'erreur' && detail.erreur instanceof ErreurApi && detail.erreur.statut === 404) ||
    (detail.etat === 'pret' && detail.donnees.proprietaire.id !== utilisateur.id)

  return (
    <div className="page">
      <EnTetePage
        titre={id === null ? 'Ajouter une machine' : 'Modifier la machine'}
        sousTitre={detail.donnees?.nom ?? 'Photo, prix et lieu : les agriculteurs voient tout cela.'}
      />
      <main className="contenu contenu--etroit">
        {offreId === null ? (
          <Lien vers="/mes-machines" className="lien-retour">← Mes machines</Lien>
        ) : (
          <Lien vers={`/offres/${offreId}/proposer`} className="lien-retour">← Retour à l’offre</Lien>
        )}

        {offre.etat === 'pret' && (
          <p className="info-offre" role="status">
            Pour l’offre de <strong>{offre.donnees.agriculteur.prenom}</strong> :{' '}
            {offre.donnees.type_machine_libelle.toLowerCase()} à {offre.donnees.localisation}. La machine lui sera
            proposée dès sa publication.
          </p>
        )}
        {offre.etat === 'erreur' && (
          <p className="info-offre" role="status">Cette offre est fermée : la machine sera simplement ajoutée à vos machines.</p>
        )}

        {introuvable ? (
          <div className="message">
            <p>Cette machine n’existe pas ou ne vous appartient pas.</p>
            <Lien vers="/mes-machines" className="bouton bouton--plein">Voir mes machines</Lien>
          </div>
        ) : etat === 'chargement' ? (
          <div className="carte-formulaire squelette" style={{ height: 520 }} aria-busy="true" aria-label="Chargement" />
        ) : etat === 'erreur' ? (
          <div className="message" role="alert">
            <p>{messageErreur(choix.erreur ?? detail.erreur)}</p>
            <button type="button" className="bouton bouton--plein" onClick={() => setEssai((n) => n + 1)}>Réessayer</button>
          </div>
        ) : (
          <Formulaire machine={detail.donnees} choix={choix.donnees} offre={offre.donnees} />
        )}
      </main>
      <Navigation variante="bas" />
    </div>
  )
}
