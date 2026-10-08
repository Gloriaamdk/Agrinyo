const nombre = new Intl.NumberFormat('fr-FR')
// Quantités réservées : « 1,5 ha », « 2 jours ».
const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const dateCourte = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const dateJourMois = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

export const formaterPrix = (prix) => `${nombre.format(prix)} FCFA`

/** « 2026-10-12 » → Date locale (sans décalage de fuseau). */
export function lireDate(iso) {
  const [annee, mois, jour] = iso.split('-').map(Number)
  return new Date(annee, mois - 1, jour)
}

/** Date locale → « 2026-10-12 », le format de <input type="date"> et de l'API. */
export function dateIso(date) {
  const deuxChiffres = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())}`
}

export function ajouterJours(iso, jours) {
  const date = lireDate(iso)
  date.setDate(date.getDate() + jours)
  return dateIso(date)
}

export const aujourdhui = () => dateIso(new Date())

export const formaterDate = (iso) => dateCourte.format(lireDate(iso))

export function formaterPeriode(debut, fin) {
  if (!fin || debut === fin) return formaterDate(debut)
  return `du ${formaterDate(debut)} au ${formaterDate(fin)}`
}

export function formaterPeriodeCourte(debut, fin) {
  if (debut === fin) return dateJourMois.format(lireDate(debut))
  return `${dateJourMois.format(lireDate(debut))} – ${dateJourMois.format(lireDate(fin))}`
}

// Saisie de la quantité selon l'unité de prix de la machine.
export const UNITES = {
  JOUR: { libelle: 'Nombre de jours', abrege: 'jour', pluriel: 'jours', pas: 1, min: 1, max: 30 },
  HEURE: { libelle: 'Nombre d’heures', abrege: 'heure', pluriel: 'heures', pas: 1, min: 1, max: 24 },
  HECTARE: { libelle: 'Surface à travailler (hectares)', abrege: 'ha', pluriel: 'ha', pas: 0.5, min: 0.5, max: 200 },
}

export function formaterQuantite(quantite, unite) {
  const valeur = Number(quantite)
  const { abrege, pluriel } = UNITES[unite]
  return `${decimal.format(valeur)} ${valeur > 1 ? pluriel : abrege}`
}

export const STATUTS = {
  EN_ATTENTE: { libelle: 'En attente', classe: 'attente' },
  ACCEPTEE: { libelle: 'Acceptée', classe: 'acceptee' },
  REFUSEE: { libelle: 'Refusée', classe: 'refusee' },
  ANNULEE: { libelle: 'Annulée', classe: 'annulee' },
}

// Emoji de secours quand une photo manque ou ne charge pas.
const ICONES = {
  TRACTEUR: '🚜',
  MOTOCULTEUR: '⚙️',
  MOISSONNEUSE: '🌾',
  BATTEUSE: '🌽',
  DECORTIQUEUSE: '🍚',
  PULVERISATEUR: '💧',
  SEMOIR: '🌱',
  CHARRUE: '🛠️',
  MOTOPOMPE: '🚿',
}

export const iconeMachine = (type) => ICONES[type] ?? '🛠️'

/** « +22890123456 » → « +228 90 12 34 56 ». */
export const formaterTelephone = (tel) => tel?.replace(/^\+228(\d{2})(\d{2})(\d{2})(\d{2})$/, '+228 $1 $2 $3 $4') ?? ''
