// Jeu d'icônes SVG (sans dépendance externe) : unités, bâtiments, emblèmes de
// faction. Couleur héritée via currentColor (s'accorde au thème bronze/parchemin).

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }

function Svg({ children, className, size = 22, style }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={style} aria-hidden="true">
      {children}
    </svg>
  )
}

// ---------- UNITÉS ----------
const UNIT_SVG = {
  // bouclier (légionnaire / hoplite)
  shield: <g {...S}><path d="M12 3l7 2v6c0 5-3 7.5-7 9-4-1.5-7-4-7-9V5z" /></g>,
  // lance (infanterie légère / levée)
  spear: <g {...S}><path d="M6 19L18 7" /><path d="M18 7l-3 .4 2.6-3z" fill="currentColor" /><path d="M5 18l2 2" /></g>,
  // lances croisées (phalange)
  pikes: <g {...S}><path d="M4 20L19 5" /><path d="M9 20L20 9" /><path d="M19 5l-2 .3 1.7-2z" fill="currentColor" /><path d="M20 9l-2 .3 1.7-2z" fill="currentColor" /></g>,
  // cheval (cavalerie)
  horse: <g {...S}><path d="M5 20c0-5 2-8 6-9l1-3 2 2 3 .5-2 2c1 2 1 4 0 7" /><path d="M5 20h12" /></g>,
  // éléphant
  elephant: <g {...S}><path d="M4 12a6 6 0 0 1 12 0v6" /><path d="M16 10c2 0 3 1 3 3s-1 3-2 3" /><path d="M7 18v-2M11 18v-2M16 18v-2" /><path d="M16 12c0 3-1 5-3 6" /></g>,
  // navire (trirème)
  ship: <g {...S}><path d="M3 15h17l-2 4H6z" /><path d="M11 14V4l6 4-6 1" /><path d="M11 14V7" /></g>,
  // épées croisées (par défaut)
  swords: <g {...S}><path d="M5 19l9-9M14 5l5 5-9 9" /><path d="M4 18l2 2M18 4l2 2" /></g>,
}
function unitKey(type) {
  if (type === 'trireme') return 'ship'
  if (type === 'elephant') return 'elephant'
  if (type === 'cavalerie') return 'horse'
  if (type === 'phalange') return 'pikes'
  if (type === 'legionnaire' || type === 'hoplite') return 'shield'
  if (type === 'infanterie_legere' || type === 'levee') return 'spear'
  return 'swords'
}
export function UnitIcon({ type, className, size, style }) {
  return <Svg className={className} size={size} style={style}>{UNIT_SVG[unitKey(type)]}</Svg>
}

// ---------- BÂTIMENTS ----------
const BUILDING_SVG = {
  // Extraction — silhouettes distinctes (sinon toutes identiques au forum).
  ferme: <g {...S}><path d="M12 21V8" /><path d="M12 11c-2.4 0-3.6-1.6-3.6-3.6C10.8 7.4 12 9 12 11zM12 11c2.4 0 3.6-1.6 3.6-3.6C13.2 7.4 12 9 12 11z" /><path d="M12 15c-2.4 0-3.6-1.6-3.6-3.6C10.8 11.4 12 13 12 15zM12 15c2.4 0 3.6-1.6 3.6-3.6C13.2 11.4 12 13 12 15z" /><path d="M5 21h14" /></g>,
  puits: <g {...S}><rect x="7" y="12" width="10" height="8" /><path d="M5.5 12l6.5-3.5L18.5 12" /><path d="M9 8.5V6h6v2.5" /><path d="M12 12v4" /></g>,
  scierie: <g {...S}><circle cx="8.5" cy="10.5" r="4" /><path d="M8.5 6.5v8M4.5 10.5h8" /><path d="M12.5 13l8 2.5-8 1.5z" /></g>,
  carriere: <g {...S}><path d="M3 20h18" /><rect x="4" y="15" width="6" height="5" /><rect x="11" y="11.5" width="6" height="8.5" /><path d="M13 7.5l4.5 4M16.5 6.5l1.5 1.5" /></g>,
  mine: <g {...S}><path d="M4 20l3.5-9h9L20 20z" /><path d="M12 11V5" /><path d="M9 6.5l3-1.5 3 1.5" /><circle cx="12" cy="16" r="1.6" fill="currentColor" /></g>,
  marche: <g {...S}><circle cx="9" cy="10" r="3" /><circle cx="14" cy="13" r="3" /><path d="M4 20h16" /></g>,
  grenier: <g {...S}><path d="M12 3v18" /><path d="M12 7c-3 0-4 2-4 4M12 7c3 0 4 2 4 4M12 12c-3 0-4 2-4 4M12 12c3 0 4 2 4 4" /></g>,
  aqueduc: <g {...S}><path d="M3 19V8M21 19V8M3 8h18" /><path d="M7 19v-4a2 2 0 0 1 4 0v4M13 19v-4a2 2 0 0 1 4 0v4" /></g>,
  murailles: <g {...S}><path d="M3 9h3V6h3v3h3V6h3v3h3v11H3z" /><path d="M9 20v-5h6v5" /></g>,
  forum: <g {...S}><path d="M4 8l8-4 8 4z" /><path d="M6 8v8M10 8v8M14 8v8M18 8v8" /><path d="M4 19h16" /></g>,
  agora: <g {...S}><path d="M4 8l8-4 8 4z" /><path d="M6 8v8M10 8v8M14 8v8M18 8v8" /><path d="M4 19h16" /></g>,
  port: <g {...S}><circle cx="12" cy="5" r="2" /><path d="M12 7v12" /><path d="M7 11h10" /><path d="M5 13c0 4 3 6 7 6s7-2 7-6" /></g>,
  camp_militaire: <g {...S}><path d="M12 4L4 19h16zM12 4v15" /><path d="M9 19l3-5 3 5" /></g>,
}
export function BuildingIcon({ id, className, size, style }) {
  return <Svg className={className} size={size} style={style}>{BUILDING_SVG[id] || BUILDING_SVG.forum}</Svg>
}

// ---------- EMBLÈMES DE FACTION ----------
const EMBLEM_SVG = {
  // Rome : aigle aux ailes déployées (aquila)
  rome: <g {...S}><path d="M12 6c-1.2 0-2 .8-2 2v8M12 6c1.2 0 2 .8 2 2v8" /><path d="M10 9C7 8 4 9 3 11c2 0 3 1 4 2M14 9c3-1 6 0 7 2-2 0-3 1-4 2" /><path d="M9 17h6" /></g>,
  // Égypte : ankh (croix de vie) — règne de Ptolémée.
  carthage: <g {...S}><circle cx="12" cy="7" r="3.2" /><path d="M12 10.2V21" /><path d="M7 14h10" /></g>,
  // Macédoine : soleil de Vergina (étoile à 8 branches) — Alexandre.
  macedoine: <g {...S}><circle cx="12" cy="12" r="2" /><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" /></g>,
  // Sparte : lambda (Λ) sur le bouclier hoplite — Léonidas.
  sparte: <g {...S}><circle cx="12" cy="12" r="9" /><path d="M8 16l4-8 4 8" /></g>,
}
export function FactionEmblem({ faction, className, size, style }) {
  return <Svg className={className} size={size} style={style}>{EMBLEM_SVG[faction] || EMBLEM_SVG.rome}</Svg>
}
