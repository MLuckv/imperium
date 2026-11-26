import Embleme from './Emblemes'
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

// Style « bicolore » : contours à l'encre (currentColor) et aplats translucides de
// la même teinte — lisibles à 20 px, plus riches que de simples traits.
const T = { stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round' }
const P = { fill: 'currentColor', fillOpacity: 0.22 }
const PL = { fill: 'currentColor' }
const N = { fill: 'none' }

// ---------- UNITÉS ----------
const UNIT_SVG = {
  // levée paysanne : fourche et lance croisées
  levee: <g {...T}><path {...N} d="M5 20L17 6" /><path {...N} d="M15.5 4.5l3 3M14 6l1.5-3M17 8.5l3-1.5" /><path {...N} d="M19 20L8 7" /><path {...PL} d="M8 7l-2.6-.6.9 2.4z" /></g>,
  // infanterie légère : pelta (bouclier en croissant) et javelots
  infanterie_legere: <g {...T}><path {...P} d="M5 9c2 2.5 2 7.5 0 10 4 1 9 1 14 0-2-2.5-2-7.5 0-10-5 1-9 1-14 0z" /><path {...N} d="M9 4l8 16M12 3l5 10" /><path {...PL} d="M9 4l-.3-2 1.4 1.4zM12 3l-.1-2 1.3 1.6z" /></g>,
  // légionnaire : scutum à umbo et glaive
  legionnaire: <g {...T}><rect {...P} x="5" y="4" width="10" height="16" rx="2" /><circle {...PL} cx="10" cy="12" r="1.6" /><path {...N} d="M10 4v6M10 14v6M5 12h3M12 12h3" /><path {...N} d="M18 3v12" /><path {...N} d="M16.5 15h3M18 15v4" /></g>,
  // hoplite : aspis au lambda et lance
  hoplite: <g {...T}><circle {...P} cx="10" cy="13" r="7" /><circle {...N} cx="10" cy="13" r="5.4" /><path {...N} d="M7.4 16.5L10 9.5l2.6 7" /><path {...N} d="M19 2v20" /><path {...PL} d="M19 2l-1.2 3h2.4z" /></g>,
  // phalange : forêt de sarisses au-dessus des boucliers
  phalange: <g {...T}><path {...N} d="M6 21L10 2M10 21l3-19M14 21l2-19M18 21l1-19" /><circle {...P} cx="7" cy="16" r="3.4" /><circle {...P} cx="12" cy="17" r="3.4" /><circle {...P} cx="17" cy="16" r="3.4" /></g>,
  // cavalerie : tête de cheval à la crinière
  cavalerie: <g {...T}><path {...P} d="M7 21c0-4 1-7 3-9-2-1-3-3-2.5-5.5L11 8l1.5-4 2 3.5c2.5 1 4.5 3 5 6l-1.5 1.5-3-1c0 3 .5 5 2 7z" /><circle {...PL} cx="14.6" cy="9.3" r=".8" /><path {...N} d="M11 8c-1 2-.6 3.5 1 4.5" /></g>,
  // éléphant de guerre : profil, défense, tour
  elephant: <g {...T}><path {...P} d="M4 18v-5c0-4 3-6 7-6h4c3 0 5 2 5 5v1c0 2-1 3-2 4v3h-2.5v-3h-5v3H8v-3H6.5V18z" /><path {...N} d="M20 13c1.5 1 1.5 4 0 6" /><path {...N} d="M16 14.5c-1 1.5-3 1.6-4 .4" /><rect {...P} x="8" y="3" width="6" height="4" /><path {...N} d="M8 3v-1M11 3v-1M14 3v-1" /></g>,
  // trirème : coque, éperon, voile et rames
  trireme: <g {...T}><path {...P} d="M2 14h18l2-2-1.5 5c-.5 1-1.5 2-3 2H6c-2 0-3.5-2-4-5z" /><path {...N} d="M11 14V3" /><path {...P} d="M6 4.5c3.5-.8 6.5-.8 10 0V12c-3.5-.8-6.5-.8-10 0z" /><path {...N} d="M5 19l-1.5 3M9 19l-1.5 3M13 19l-1.5 3M17 19l-1.5 3" /></g>,
  // mercenaires : bourse d'or et épée
  mercenaire: <g {...T}><path {...P} d="M5 11c-2 3-1 9 5 9s7-6 5-9l-2-2h-6z" /><path {...N} d="M7 9l-1-3 4 1 4-1-1 3" /><path {...N} d="M8 14.5h4M10 12.5v5" /><path {...N} d="M18 2l-4 10M16.5 6l3 1.2" /></g>,
  // chevalier de la Table Ronde : heaume à visière et croix
  chevalier: <g {...T}><path {...P} d="M6 21v-9c0-5 2.5-8 6-8s6 3 6 8v9z" /><path {...N} d="M6 12.5h12M8 15h8" /><path {...N} d="M12 4v-2M10 2h4" /><path {...N} d="M12 17v4M10 19h4" /></g>,
  // épées croisées (par défaut)
  swords: <g {...T}><path {...N} d="M5 19l9-9M14 5l5 5-9 9" /><path {...N} d="M4 18l2 2M18 4l2 2" /></g>,
}
function unitKey(type) {
  return UNIT_SVG[type] ? type : 'swords'
}
export function UnitIcon({ type, className, size, style }) {
  return <Svg className={className} size={size} style={style}>{UNIT_SVG[unitKey(type)]}</Svg>
}

// ---------- BÂTIMENTS ----------
const BUILDING_SVG = {
  // ferme : grange et gerbe de blé
  ferme: <g {...T}><path {...P} d="M3 20v-8l6-5 6 5v8z" /><path {...N} d="M7 20v-4h4v4M3 12l6-5 6 5" /><path {...N} d="M19 21V9" /><path {...P} d="M19 9c-1.6-.6-2-2-2-3.5 1.4.4 2 1.6 2 3.5zM19 9c1.6-.6 2-2 2-3.5-1.4.4-2 1.6-2 3.5zM19 13c-1.6-.6-2-2-2-3.5 1.4.4 2 1.6 2 3.5zM19 13c1.6-.6 2-2 2-3.5-1.4.4-2 1.6-2 3.5z" /><path {...N} d="M2 21h20" /></g>,
  // puits : margelle, toit, seau
  puits: <g {...T}><path {...P} d="M6 13h12v7H6z" /><ellipse {...P} cx="12" cy="13" rx="6" ry="1.6" /><path {...N} d="M7 13V7M17 13V7M5 7l7-4 7 4z" /><path {...N} d="M12 7v3" /><path {...PL} d="M10.8 10h2.4l-.4 2h-1.6z" /><path {...N} d="M6 16.5h12" /></g>,
  // scierie : lame circulaire et rondins
  scierie: <g {...T}><circle {...P} cx="9" cy="9" r="5" /><circle {...PL} cx="9" cy="9" r="1" /><path {...N} d="M9 3V2M9 16v-1M3 9H2M16 9h-1M4.8 4.8l-.7-.7M13.9 13.9l-.7-.7M13.2 4.8l.7-.7M4.1 13.9l.7-.7" /><circle {...P} cx="7" cy="19" r="2" /><circle {...P} cx="12" cy="19" r="2" /><circle {...P} cx="17" cy="19" r="2" /><path {...N} d="M15 13l6 2" /></g>,
  // carrière : blocs taillés en gradins, pic
  carriere: <g {...T}><path {...P} d="M2 21V15h5v-4h5V7h5v14z" /><path {...N} d="M2 15h5M7 11h5M12 7h5" /><path {...N} d="M18 4l4 4M21 3l-5 8" /><path {...N} d="M2 21h20" /></g>,
  // mine : montagne, galerie étayée, wagonnet
  mine: <g {...T}><path {...P} d="M2 20L9 6l4 6 2-3 7 11z" /><path {...PL} d="M9.5 20v-4.5a2.5 2.5 0 0 1 5 0V20z" fillOpacity=".55" /><path {...N} d="M9 15.5h6" /><path {...N} d="M2 20h20" /></g>,
  // marché : étal à auvent rayé et amphore
  marche: <g {...T}><path {...P} d="M3 9l2-4h14l2 4z" /><path {...N} d="M7 5l-1 4M11 5v4M15 5l1 4" /><path {...N} d="M4 9v11M20 9v11M4 14h16" /><path {...P} d="M11 14c-1.2 1-1.2 4.5.5 6h1c1.7-1.5 1.7-5 .5-6z" /><path {...N} d="M2 20h20" /></g>,
  // grenier : silo conique sur pilotis
  grenier: <g {...T}><path {...P} d="M6 9h12v9H6z" /><path {...P} d="M4 9l8-6 8 6z" /><path {...N} d="M8 18v3M16 18v3M12 18v3" /><path {...N} d="M9 12h6M9 15h6" /></g>,
  // aqueduc : deux rangs d'arches
  aqueduc: <g {...T}><path {...P} d="M2 5h20v15h-3v-4a2 2 0 0 0-4 0v4h-2v-4a2 2 0 0 0-4 0v4H7v-4a2 2 0 0 0-4 0v4H2z" /><path {...N} d="M2 9h20M5 12.5a1.5 1.5 0 0 1 3 0M10.5 12.5a1.5 1.5 0 0 1 3 0M16 12.5a1.5 1.5 0 0 1 3 0" /><path {...N} d="M2 5h20" strokeWidth="2" /></g>,
  // murailles : rempart crénelé et porte
  murailles: <g {...T}><path {...P} d="M2 21V9h3v2h3V9h3v2h2V9h3v2h3V9h3v12z" /><path {...PL} d="M9.5 21v-4a2.5 2.5 0 0 1 5 0v4z" fillOpacity=".55" /><path {...N} d="M2 14h20" /></g>,
  // forum : basilique à fronton et colonnes
  forum: <g {...T}><path {...P} d="M3 8l9-5 9 5z" /><path {...N} d="M5 8v10M9 8v10M15 8v10M19 8v10" /><path {...P} d="M3 18h18v3H3z" /><circle {...PL} cx="12" cy="6" r=".9" /></g>,
  // agora : longue stoa et statue
  agora: <g {...T}><path {...P} d="M2 8h14v2H2z" /><path {...N} d="M3.5 10v8M6.5 10v8M9.5 10v8M12.5 10v8M15.5 10v8" /><path {...P} d="M2 18h20v3H2z" /><circle {...P} cx="19.5" cy="8" r="1.4" /><path {...N} d="M19.5 9.5v4.5M18 11.5h3M18.5 18v-2.5h2V18" /></g>,
  // port : jetée, ancre, vagues
  port: <g {...T}><circle {...N} cx="12" cy="4.5" r="1.6" /><path {...N} d="M12 6v12M8.5 9h7" /><path {...P} d="M5.5 13c0 3.5 3 5.5 6.5 5.5s6.5-2 6.5-5.5l-2 1M5.5 13l2 1" /><path {...N} d="M2 21c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0" /></g>,
  // camp militaire : tente et enseigne à l'aigle
  camp_militaire: <g {...T}><path {...P} d="M2 20L10 7l8 13z" /><path {...N} d="M10 7v13M7.5 20L10 15l2.5 5" /><path {...N} d="M20 21V5" /><path {...P} d="M17.5 7h5v3h-5z" /><path {...PL} d="M20 2.5l-1.6 1.6h3.2z" /></g>,
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
  // Francs : fleur de lys — la bannière de Jeanne d'Arc.
  francs: <g {...S}><path d="M12 3c-1.6 2.2-1.6 4.4 0 6.6 1.6-2.2 1.6-4.4 0-6.6z" /><path d="M12 9.6c-2 -1.8 -4.6 -1.4 -5.4 .8 -.7 1.9 .9 3.6 2.9 3.4" /><path d="M12 9.6c2 -1.8 4.6 -1.4 5.4 .8 .7 1.9 -.9 3.6 -2.9 3.4" /><path d="M7.5 13.8h9" /><path d="M12 9.6V21" /></g>,
  // Bretons : couronne sur Excalibur — la Table Ronde d'Arthur.
  bretons: <g {...S}><path d="M12 4v13" /><path d="M8.5 8h7" /><path d="M12 17l-1.6 3h3.2L12 17z" /><path d="M5 5l1.8 2.4L9 4.6" /><path d="M19 5l-1.8 2.4L15 4.6" /></g>,
}
// Tracé brut de l'emblème (à placer dans un <svg> existant, viewBox 24×24).
export function EmblemeTrace({ faction }) {
  return EMBLEM_SVG[faction] || EMBLEM_SVG.rome
}
export function FactionEmblem({ faction, className, size = 22, style }) {
  return <Embleme faction={faction} taille={size} variante="plein" className={className} style={style} />
}

// ---------- ICÔNES D'INTERFACE (barre d'action, panneaux) ----------
// Remplacent les emoji (✉ 🔬 …) qui ne s'affichaient pas sur toutes les machines :
// la police de titre n'a pas ces glyphes et le repli système est imprévisible.
const UI_SVG = {
  // fiole (technologies)
  tech: <g {...S}><path d="M10 3h4" /><path d="M10 3v6l-5 9a1.5 1.5 0 0 0 1.3 2.2h11.4A1.5 1.5 0 0 0 19 18l-5-9V3" /><path d="M8.5 15h7" /></g>,
  // temple à colonnes (dogmes)
  dogmes: <g {...S}><path d="M4 9l8-5 8 5" /><path d="M5 9h14" /><path d="M7 9v8M11 9v8M15 9v8M19 9v8" /><path d="M4 20h16" /></g>,
  // parchemin scellé (diplomatie)
  diplomatie: <g {...S}><path d="M6 4h9l4 4v12H6z" /><path d="M15 4v4h4" /><path d="M9 12h6M9 15h6" /><circle cx="9.5" cy="18.5" r="1.3" fill="currentColor" /></g>,
  // buste (conseiller)
  conseiller: <g {...S}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5" /></g>,
  // livre ouvert (journal)
  journal: <g {...S}><path d="M12 6c-2-1.5-4.5-2-8-2v14c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2V4c-3.5 0-6 .5-8 2z" /><path d="M12 6v14" /></g>,
  // marteau (production)
  production: <g {...S}><path d="M14 5l5 5-2 2-5-5z" /><path d="M13.5 8.5L5 17l2 2 8.5-8.5" /><path d="M16 4l1-1 4 4-1 1" /></g>,
  // épées croisées (armée)
  armee: <g {...S}><path d="M5 19l9-9M14 5l5 5-9 9" /><path d="M4 18l2 2M18 4l2 2" /></g>,
  // trois traits (menu)
  menu: <g {...S}><path d="M4 7h16M4 12h16M4 17h16" /></g>,
  // pièces (impôts)
  impots: <g {...S}><ellipse cx="12" cy="7" rx="7" ry="3" /><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" /><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" /></g>,
  // main tendue / annexer (bannière plantée)
  annexer: <g {...S}><path d="M7 21V4" /><path d="M7 4h10l-3 3.5 3 3.5H7" /></g>,
  // merveille (étoile à quatre branches)
  merveille: <g {...S}><path d="M12 3c.6 4.5 3.5 7.4 8 8-4.5.6-7.4 3.5-8 8-.6-4.5-3.5-7.4-8-8 4.5-.6 7.4-3.5 8-8z" fill="currentColor" stroke="none" /></g>,
  // cadenas (prérequis manquant)
  lock: <g {...S}><rect x="6" y="11" width="12" height="9" rx="1.5" /><path d="M9 11V8a3 3 0 0 1 6 0v3" /></g>,
  // merveille naturelle (montagne + soleil)
  nature: <g {...S}><path d="M3 20l6-10 4 6 2-3 6 7z" /><circle cx="17" cy="6" r="2.2" /></g>,
}
export function UiIcon({ id, className, size = 16, style }) {
  return <Svg className={className} size={size} style={style}>{UI_SVG[id] || UI_SVG.menu}</Svg>
}

// ---------- GISEMENTS DE LUXE ----------
// Glyphes pleins (currentColor) : lisibles à 12 px, cohérents avec le reste.
export const LUXE_COULEURS = {
  vin: '#8e44ad', grain: '#d4a83a', epices: '#d35400', ivoire: '#efe6cf', ambre: '#e69b2c',
  pourpre: '#c0398b', or: '#f1c40f', fer: '#95a5a6', sel: '#ecf0f1', marbre: '#dcd6c8',
}
const LUXE_SVG = {
  // grappe : trois cercles
  vin: <g fill="currentColor"><circle cx="9" cy="10" r="3.6" /><circle cx="15" cy="10" r="3.6" /><circle cx="12" cy="15.5" r="3.6" /><path d="M12 6V3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></g>,
  // épi
  grain: <g {...S}><path d="M12 21V6" /><path d="M12 9c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4zM12 9c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4z" fill="currentColor" /><path d="M12 14c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4zM12 14c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4z" fill="currentColor" /></g>,
  // piment
  epices: <g fill="currentColor"><path d="M7 6c-1 5 1 11 7 13 3 1 6-1 5-4-4 0-7-3-9-9z" /><path d="M9 5c1.5-1 3-1 4 .5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></g>,
  // défense d'ivoire
  ivoire: <g fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"><path d="M6 6c1 8 5 12 12 13" /></g>,
  // hexagone d'ambre
  ambre: <g fill="currentColor"><path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z" /></g>,
  // coquille (pourpre)
  pourpre: <g fill="currentColor"><path d="M12 4c5 0 8 4 8 8s-4 8-8 8-8-3-8-7c0-3 2-5 5-5-1 2 0 4 2 4 3 0 4-4 1-8z" /></g>,
  // lingot
  or: <g fill="currentColor"><path d="M5 17l2-8h10l2 8z" /><path d="M8 7h8l-1-2H9z" /></g>,
  // pioche / losange de fer
  fer: <g fill="currentColor"><path d="M12 3l8 9-8 9-8-9z" /></g>,
  // cube de sel
  sel: <g fill="currentColor"><path d="M6 8l6-3 6 3v9l-6 3-6-3z" /><path d="M6 8l6 3 6-3M12 11v9" stroke="#14110c" strokeWidth="1" fill="none" /></g>,
  // colonne de marbre
  marbre: <g fill="currentColor"><rect x="9" y="6" width="6" height="12" /><rect x="7" y="4" width="10" height="2.5" /><rect x="7" y="17.5" width="10" height="2.5" /></g>,
}
export function LuxeIcon({ id, className, size = 14, style }) {
  return <Svg className={className} size={size} style={{ color: LUXE_COULEURS[id] || '#caa53d', ...style }}>{LUXE_SVG[id] || LUXE_SVG.or}</Svg>
}

// ---------- RESSOURCES (barre du haut) ----------
const RES_SVG = {
  or: <g><circle cx="12" cy="12" r="8" fill="currentColor" /><circle cx="12" cy="12" r="5.6" fill="none" stroke="#3a2a10" strokeOpacity=".45" strokeWidth="1.2" /><path d="M10 9.5h4M12 9.5v5M10 14.5h4" stroke="#3a2a10" strokeOpacity=".6" strokeWidth="1.2" strokeLinecap="round" /></g>,
  nourriture: <g fill="currentColor"><path d="M12 21V7" stroke="currentColor" strokeWidth="1.4" fill="none" /><path d="M12 9c-2.6-.8-3.4-3-3.4-5.4 2.4.6 3.4 2.6 3.4 5.4zM12 9c2.6-.8 3.4-3 3.4-5.4-2.4.6-3.4 2.6-3.4 5.4zM12 14c-2.6-.8-3.4-3-3.4-5.4 2.4.6 3.4 2.6 3.4 5.4zM12 14c2.6-.8 3.4-3 3.4-5.4-2.4.6-3.4 2.6-3.4 5.4zM12 19c-2.6-.8-3.4-3-3.4-5.4 2.4.6 3.4 2.6 3.4 5.4zM12 19c2.6-.8 3.4-3 3.4-5.4-2.4.6-3.4 2.6-3.4 5.4z" /></g>,
  eau: <g><path d="M12 3c3.5 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6 6-11z" fill="currentColor" /><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" stroke="#fff" strokeOpacity=".55" strokeWidth="1.3" fill="none" strokeLinecap="round" /></g>,
  pierre: <g fill="currentColor"><path d="M3 18l3-7 6-2 5 3 4 6-5 3H7z" /><path d="M6 11l5 3 6-2M11 14l-1 7" stroke="#1c1813" strokeOpacity=".45" strokeWidth="1" fill="none" /></g>,
  bois: <g><rect x="3" y="9" width="17" height="7" rx="3.5" fill="currentColor" /><ellipse cx="19.5" cy="12.5" rx="2.5" ry="3.5" fill="#d9b77a" /><ellipse cx="19.5" cy="12.5" rx="1.2" ry="1.8" fill="none" stroke="#7a5a32" strokeWidth=".8" /><path d="M7 11h6M9 14h5" stroke="#1c1813" strokeOpacity=".35" strokeWidth="1" strokeLinecap="round" /></g>,
  fer: <g><path d="M4 16h16l-2 4H6z" fill="currentColor" /><path d="M6 16l1.5-6h9L18 16" fill="currentColor" fillOpacity=".7" /><path d="M9 10V6h6v4" stroke="currentColor" strokeWidth="1.4" fill="none" /></g>,
  population: <g fill="currentColor"><circle cx="9" cy="8" r="3" /><path d="M3.5 20c0-4 2.5-7 5.5-7s5.5 3 5.5 7z" /><circle cx="16.5" cy="9" r="2.4" fillOpacity=".7" /><path d="M14 20c.2-3 .9-5.5 2.5-6.6 2.6.2 4.5 2.8 4.5 6.6z" fillOpacity=".7" /></g>,
}
export function ResIcon({ id, className, size = 16, style }) {
  return <Svg className={className} size={size} style={style}>{RES_SVG[id] || RES_SVG.or}</Svg>
}
