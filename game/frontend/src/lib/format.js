// Helpers d'affichage uniquement (libellés, couleurs, formats). Aucune donnée de
// jeu n'est hardcodée ici : les couleurs de faction reproduisent simplement le
// contrat ARCHITECTURE.md §1 pour les cas où l'API ne fournirait pas de couleur.

export const FACTION_COLORS = {
  rome: '#b03a2e',
  carthage: '#c9a227',
  macedoine: '#1e8449',
  sparte: '#2e6da4',
  neutre: '#7f8c8d',
}

export const NEUTRAL_COLOR = '#7f8c8d'

// Résout la couleur d'une faction : priorité à la valeur fournie par l'API,
// repli sur la table de contrat, repli final sur le gris neutre.
export function factionColor(factionId, fournie) {
  if (fournie) return fournie
  if (!factionId) return NEUTRAL_COLOR
  return FACTION_COLORS[factionId] || NEUTRAL_COLOR
}

// Libellés "humains" par défaut. Si l'API fournit un `nom`, on le préfère.
const FACTION_LABELS = {
  rome: 'Rome',
  carthage: 'Égypte',
  macedoine: 'Macédoine',
  sparte: 'Sparte',
  neutre: 'Neutre',
}

export function factionLabel(factionId, nom) {
  if (nom) return nom
  if (!factionId) return 'Neutre'
  return FACTION_LABELS[factionId] || factionId
}

// Noms d'affichage des dirigeants (le backend les renvoie aussi dans les messages ;
// ceci sert d'étiquette par défaut pour les en-têtes).
const LEADER_NAMES = {
  rome: 'Néron',
  carthage: 'Ptolémée',
  macedoine: 'Alexandre le Grand',
  sparte: 'Léonidas',
}

export function leaderName(factionId) {
  return LEADER_NAMES[factionId] || factionLabel(factionId)
}

// Libellés et icônes (texte) des ressources de base. Sert uniquement à
// l'affichage ; les valeurs viennent intégralement de l'API.
export const RESOURCE_META = {
  or: { label: 'Or', icon: '⬤', tint: '#c9a227' },
  nourriture: { label: 'Nourriture', icon: '❖', tint: '#c0703a' },
  eau: { label: 'Eau', icon: '≈', tint: '#3a7bc0' },
  pierre: { label: 'Pierre', icon: '◼', tint: '#8a8a82' },
  bois: { label: 'Bois', icon: '❙', tint: '#7a5a32' },
  fer: { label: 'Fer', icon: '⛨', tint: '#6b6f72' },
  population: { label: 'Population', icon: '☖', tint: '#9b6a9b' },
}

export const LUXURY_META = {
  vin: { label: 'Vin' },
  epices: { label: 'Épices' },
  ivoire: { label: 'Ivoire' },
  marbre: { label: 'Marbre' },
  grain_egyptien: { label: 'Grain égyptien' },
}

export function resourceLabel(key) {
  return (RESOURCE_META[key] && RESOURCE_META[key].label) || key
}

// Formate une année négative en "264 av. J.C." (positive en "12 ap. J.C.").
export function formatAnnee(annee) {
  if (annee == null) return ''
  if (annee < 0) return `${Math.abs(annee)} av. J.C.`
  return `${annee} ap. J.C.`
}

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

export function moisLabel(mois) {
  if (!mois || mois < 1 || mois > 12) return ''
  return MOIS[mois - 1]
}

// "Tour 1 — Mars 5 av. J.C." à partir du bloc meta (1 tour = 1 mois).
export function formatTourDate(meta) {
  if (!meta) return ''
  const parts = []
  if (meta.tour != null) parts.push(`Tour ${meta.tour}`)
  const dateParts = []
  const m = moisLabel(meta.mois)
  if (m) dateParts.push(m)
  const a = formatAnnee(meta.annee)
  if (a) dateParts.push(a)
  const datestr = dateParts.join(' ')
  return datestr ? `${parts.join('')} — ${datestr}` : parts.join('')
}

// Couleur d'un score de réputation (-100..100) selon hostile / neutre / amical.
export function reputationTone(score) {
  if (score == null) return { label: 'Inconnu', className: 'text-stone-400', bar: '#7f8c8d' }
  if (score <= -30) return { label: 'Hostile', className: 'text-red-300', bar: '#c0392b' }
  if (score < 30) return { label: 'Neutre', className: 'text-amber-200', bar: '#caa53d' }
  return { label: 'Amical', className: 'text-emerald-300', bar: '#27ae60' }
}

// Formate un nombre avec séparateur de milliers (espace fine).
export function num(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return Math.round(n).toLocaleString('fr-FR')
}

// "(+25)" / "(-3)" / "" pour une production.
export function prodSuffix(p) {
  if (p == null) return ''
  const sign = p > 0 ? '+' : ''
  return `(${sign}${num(p)})`
}
