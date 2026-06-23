// Illustrations EXCLUSIVES par merveille — SVG bespoke, style « gravure antique ».
// Palette accordée au thème : marbre/parchemin, bronze, or, terre cuite. Aucune
// dépendance réseau : les visuels sont vectoriels, nets à toute taille, jamais cassés.

const MARBLE = '#ece3cf', MARBLE_SH = '#c9b48a', STONE = '#d8c39a', STONE_SH = '#b79c6a'
const OUTLINE = '#4a3f2a', GOLD = '#e8c267', BRONZE = '#a9803f', BRONZE_LT = '#c79a4e'
const PATINA = '#7fa98c', TERRA = '#b5552f', TERRA_DK = '#8f3f22', SHADOW = '#3a3120'

function Frame({ children, size = 100, className, style }) {
  return (
    <svg viewBox="0 0 100 64" width={size} height={size * 0.64} className={className}
         style={style} aria-hidden="true">{children}</svg>
  )
}

// ---- Parthénon : temple dorique (fronton + colonnes cannelées + stylobate) ----
function Parthenon(props) {
  const cols = [16, 28, 40, 52, 64, 76]
  return (
    <Frame {...props}>
      <rect x="6" y="56" width="88" height="5" fill={MARBLE_SH} stroke={OUTLINE} strokeWidth="1" />
      <rect x="10" y="52" width="80" height="4" fill={MARBLE} stroke={OUTLINE} strokeWidth="1" />
      {cols.map((x) => (
        <g key={x}>
          <rect x={x} y="24" width="8" height="28" fill={MARBLE} stroke={OUTLINE} strokeWidth="1" />
          <line x1={x + 2.7} y1="25" x2={x + 2.7} y2="51" stroke={MARBLE_SH} strokeWidth="0.8" />
          <line x1={x + 5.3} y1="25" x2={x + 5.3} y2="51" stroke={MARBLE_SH} strokeWidth="0.8" />
          <rect x={x - 1} y="22" width="10" height="2.5" fill={MARBLE_SH} stroke={OUTLINE} strokeWidth="0.8" />
        </g>
      ))}
      <rect x="9" y="17" width="82" height="6" fill={MARBLE} stroke={OUTLINE} strokeWidth="1" />
      <polygon points="6,17 94,17 50,2" fill={MARBLE} stroke={OUTLINE} strokeWidth="1.2" />
      <polygon points="14,16 86,16 50,5.5" fill="none" stroke={MARBLE_SH} strokeWidth="0.8" />
      <circle cx="50" cy="12" r="1.6" fill={GOLD} />
      <circle cx="40" cy="13.5" r="1.1" fill={MARBLE_SH} />
      <circle cx="60" cy="13.5" r="1.1" fill={MARBLE_SH} />
    </Frame>
  )
}

// ---- Colosse de Rhodes : géant de bronze couronné de rayons, torche levée ----
function ColosseRhodes(props) {
  return (
    <Frame {...props}>
      <defs>
        <linearGradient id="bronzeG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={BRONZE_LT} /><stop offset="1" stopColor={BRONZE} />
        </linearGradient>
      </defs>
      <rect x="30" y="56" width="40" height="6" fill={STONE} stroke={OUTLINE} strokeWidth="1" />
      <rect x="34" y="52" width="32" height="4" fill={STONE_SH} stroke={OUTLINE} strokeWidth="1" />
      {/* jambes écartées */}
      <path d="M44 52 L41 33 H47 L48 52 Z" fill="url(#bronzeG)" stroke={OUTLINE} strokeWidth="1" />
      <path d="M56 52 L59 33 H53 L52 52 Z" fill="url(#bronzeG)" stroke={OUTLINE} strokeWidth="1" />
      {/* torse */}
      <path d="M41 33 Q50 28 59 33 L57 20 Q50 16 43 20 Z" fill="url(#bronzeG)" stroke={OUTLINE} strokeWidth="1" />
      <line x1="50" y1="20" x2="50" y2="32" stroke={BRONZE} strokeWidth="0.8" />
      {/* bras : un levé tenant la flamme */}
      <path d="M43 21 L33 12" stroke="url(#bronzeG)" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M57 21 L64 30" stroke="url(#bronzeG)" strokeWidth="3.4" strokeLinecap="round" />
      {/* flamme */}
      <path d="M33 12 Q30 6 33 3 Q35 7 37 5 Q38 10 33 12 Z" fill={GOLD} stroke="#c9892a" strokeWidth="0.7" />
      {/* tête couronnée de rayons */}
      <circle cx="50" cy="13" r="4.2" fill="url(#bronzeG)" stroke={OUTLINE} strokeWidth="1" />
      {[-90, -60, -30, 0, 30, 60, 90].map((a) => {
        const r = (a * Math.PI) / 180
        return <line key={a} x1={50 + Math.sin(r) * 5} y1={13 - Math.cos(r) * 5}
                     x2={50 + Math.sin(r) * 8.5} y2={13 - Math.cos(r) * 8.5}
                     stroke={GOLD} strokeWidth="1.3" strokeLinecap="round" />
      })}
      <path d="M44 30 q3 2 6 0" stroke={PATINA} strokeWidth="1" fill="none" opacity="0.7" />
    </Frame>
  )
}

// ---- Palais de Cnossos : terrasses minoennes, colonnes rouges, cornes sacrées ----
function Knossos(props) {
  return (
    <Frame {...props}>
      <rect x="6" y="54" width="88" height="8" fill={TERRA_DK} stroke={OUTLINE} strokeWidth="1" />
      {/* terrasses étagées */}
      <rect x="10" y="40" width="34" height="14" fill={TERRA} stroke={OUTLINE} strokeWidth="1" />
      <rect x="40" y="30" width="34" height="24" fill={TERRA} stroke={OUTLINE} strokeWidth="1" />
      <rect x="66" y="44" width="22" height="10" fill={TERRA} stroke={OUTLINE} strokeWidth="1" />
      <rect x="44" y="24" width="26" height="6" fill="#cf9b4e" stroke={OUTLINE} strokeWidth="1" />
      {/* colonnes minoennes (plus larges en haut) */}
      {[16, 26, 36].map((x) => (
        <path key={x} d={`M${x} 54 L${x + 1} 42 L${x - 1.5} 42 L${x - 0.5} 40 L${x + 4.5} 40 L${x + 5.5} 42 L${x + 3} 42 L${x + 4} 54 Z`}
              fill={TERRA_DK} stroke={OUTLINE} strokeWidth="0.8" />
      ))}
      {/* fenêtres */}
      <g fill={SHADOW}>
        <rect x="48" y="34" width="5" height="6" /><rect x="57" y="34" width="5" height="6" />
        <rect x="71" y="47" width="4" height="5" /><rect x="79" y="47" width="4" height="5" />
      </g>
      {/* cornes de consécration (taureau) */}
      <path d="M48 24 Q50 17 52 21 Q54 17 56 24" fill="none" stroke={SHADOW} strokeWidth="2" strokeLinecap="round" />
    </Frame>
  )
}

// ---- Colisée : amphithéâtre elliptique, arcades sur 3 niveaux, pan ruiné ----
function Colisee(props) {
  return (
    <Frame {...props}>
      <ellipse cx="50" cy="50" rx="44" ry="11" fill={STONE_SH} stroke={OUTLINE} strokeWidth="1" />
      <ellipse cx="50" cy="47" rx="44" ry="11" fill={STONE} stroke={OUTLINE} strokeWidth="1" />
      {/* corps de façade courbe */}
      <path d="M6 47 A44 11 0 0 1 94 47 L94 24 A44 9 0 0 0 6 24 Z" fill={STONE} stroke={OUTLINE} strokeWidth="1.2" />
      {/* deux registres d'arcades */}
      {[0, 1].map((row) => (
        <g key={row}>
          {[10, 22, 34, 46, 58, 70, 82].map((x) => (
            <path key={x} d={`M${x} ${44 - row * 11} v-6 a3 3 0 0 1 6 0 v6 Z`}
                  fill={SHADOW} stroke={OUTLINE} strokeWidth="0.6" opacity={0.92} />
          ))}
        </g>
      ))}
      {/* niveau supérieur partiel (ruine à droite) */}
      <path d="M6 24 L6 15 A44 7 0 0 1 56 13 L56 22" fill={STONE} stroke={OUTLINE} strokeWidth="1.1" />
      {[12, 24, 36, 48].map((x) => (
        <rect key={x} x={x} y="16" width="5" height="6" fill={SHADOW} opacity="0.9" />
      ))}
      <line x1="6" y1="24" x2="94" y2="24" stroke={STONE_SH} strokeWidth="1" />
    </Frame>
  )
}

const ART = { parthenon: Parthenon, colosse_rhodes: ColosseRhodes, knossos: Knossos, colisee: Colisee }

export default function WonderArt({ id, size, className, style }) {
  const C = ART[id]
  if (!C) return null
  return <C size={size} className={className} style={style} />
}
