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

// ---- Stonehenge : trilithes sur la lande, ciel d'aube ----
function Stonehenge(props) {
  return (
    <Frame {...props}>
      <ellipse cx="50" cy="56" rx="46" ry="6" fill="#7f9a5a" stroke={OUTLINE} strokeWidth="0.8" />
      <circle cx="78" cy="14" r="6" fill={GOLD} opacity="0.85" />
      {/* trilithes (deux montants + linteau), profondeur décroissante */}
      {[[8, 30, 1], [26, 24, 1.15], [44, 22, 1.2], [63, 26, 1.1], [80, 32, 0.95]].map(([x, y, k], i) => (
        <g key={i}>
          <rect x={x} y={y} width={5 * k} height={54 - y} fill={STONE_SH} stroke={OUTLINE} strokeWidth="0.9" />
          <rect x={x + 9 * k} y={y + 1} width={5 * k} height={53 - y} fill={STONE} stroke={OUTLINE} strokeWidth="0.9" />
          <rect x={x - 1} y={y - 4} width={16 * k} height="4.5" fill={STONE} stroke={OUTLINE} strokeWidth="0.9" />
        </g>
      ))}
      <rect x="47" y="44" width="6" height="10" fill={STONE_SH} stroke={OUTLINE} strokeWidth="0.8" />
    </Frame>
  )
}

// ---- Pyramides de Gizeh : trois pyramides, sable, soleil ----
function Pyramides(props) {
  return (
    <Frame {...props}>
      <rect x="0" y="50" width="100" height="14" fill="#d9c48f" />
      <circle cx="16" cy="14" r="6" fill={GOLD} opacity="0.9" />
      <polygon points="62,52 96,52 79,20" fill={STONE_SH} stroke={OUTLINE} strokeWidth="1" />
      <polygon points="79,20 96,52 79,52" fill={STONE} stroke={OUTLINE} strokeWidth="0.8" />
      <polygon points="18,54 68,54 43,8" fill={STONE_SH} stroke={OUTLINE} strokeWidth="1.1" />
      <polygon points="43,8 68,54 43,54" fill={STONE} stroke={OUTLINE} strokeWidth="0.8" />
      <polygon points="2,54 26,54 14,34" fill={STONE_SH} stroke={OUTLINE} strokeWidth="0.9" />
      <polygon points="14,34 26,54 14,54" fill={STONE} stroke={OUTLINE} strokeWidth="0.7" />
      <path d="M0 58 q20 -2 40 0 t40 0 t20 0" fill="none" stroke="#c4ad78" strokeWidth="0.8" />
    </Frame>
  )
}

// ---- Volcan (Etna, Vésuve, chaîne des Puys) : cône fumant, pentes vertes ----
function Volcan(props) {
  return (
    <Frame {...props}>
      <rect x="0" y="54" width="100" height="10" fill="#7f9a5a" />
      <polygon points="6,56 94,56 62,16 50,22 38,16" fill="#6b5a45" stroke={OUTLINE} strokeWidth="1.1" />
      <polygon points="38,16 50,22 62,16 58,12 42,12" fill={TERRA_DK} stroke={OUTLINE} strokeWidth="0.9" />
      <path d="M44 14 q6 4 12 0" stroke={GOLD} strokeWidth="1.6" fill="none" />
      <path d="M50 20 q-4 8 -2 16" stroke={TERRA} strokeWidth="1.4" fill="none" opacity="0.9" />
      {/* panache */}
      <path d="M50 11 q-6 -6 0 -9 q4 -2 5 2 q6 -1 5 5 q-2 4 -7 3 q-3 2 -3 -1" fill="#bfb4a0" stroke={OUTLINE} strokeWidth="0.7" opacity="0.9" />
      <path d="M20 56 q10 -8 20 -4" stroke="#4f7a3a" strokeWidth="1.2" fill="none" />
      <path d="M60 52 q12 -8 26 -2" stroke="#4f7a3a" strokeWidth="1.2" fill="none" />
    </Frame>
  )
}

// ---- Forêt (Brocéliande) : chênes, brume, source ----
function Foret(props) {
  return (
    <Frame {...props}>
      <rect x="0" y="52" width="100" height="12" fill="#3f6b3a" />
      <rect x="0" y="44" width="100" height="10" fill="#bfc9c7" opacity="0.55" />
      {[[14, 1], [34, 1.25], [56, 1.1], [80, 1.3]].map(([x, k], i) => (
        <g key={i}>
          <rect x={x - 2} y={30} width="4" height={24} fill="#5a3d24" stroke={OUTLINE} strokeWidth="0.7" />
          <circle cx={x} cy={26} r={11 * k} fill="#4f7a3a" stroke={OUTLINE} strokeWidth="0.9" />
          <circle cx={x - 6 * k} cy={31} r={7 * k} fill="#5d8a45" stroke={OUTLINE} strokeWidth="0.7" />
          <circle cx={x + 6 * k} cy={30} r={7 * k} fill="#466d34" stroke={OUTLINE} strokeWidth="0.7" />
        </g>
      ))}
      <ellipse cx="46" cy="58" rx="12" ry="3" fill="#6f9fb8" stroke={OUTLINE} strokeWidth="0.7" />
    </Frame>
  )
}

// ---- Mur (Mur du Nord, Grande Muraille) : rempart crénelé sur les crêtes ----
function Mur(props) {
  return (
    <Frame {...props}>
      <path d="M0 64 L0 40 Q25 20 50 34 Q75 18 100 36 L100 64 Z" fill="#7f9a5a" stroke={OUTLINE} strokeWidth="0.9" />
      <path d="M0 40 Q25 20 50 34 Q75 18 100 36 L100 44 Q75 26 50 42 Q25 28 0 48 Z" fill={STONE} stroke={OUTLINE} strokeWidth="1" />
      {[4, 16, 28, 40, 52, 64, 76, 88].map((x) => {
        const y = x < 50 ? 40 - (x / 50) * 12 + (x / 50) * (x / 50) * 6 : 34 - ((x - 50) / 50) * 10 + ((x - 50) / 50) * ((x - 50) / 50) * 12
        return <rect key={x} x={x} y={y - 4} width="5" height="4" fill={STONE} stroke={OUTLINE} strokeWidth="0.7" />
      })}
      <rect x="46" y="22" width="9" height="20" fill={STONE_SH} stroke={OUTLINE} strokeWidth="1" />
      <rect x="44" y="19" width="13" height="4" fill={STONE} stroke={OUTLINE} strokeWidth="0.8" />
    </Frame>
  )
}

// ---- Pont du Gard : aqueduc à trois étages d'arches ----
function Aqueduc(props) {
  return (
    <Frame {...props}>
      <rect x="0" y="52" width="100" height="12" fill="#4f7fa0" />
      <rect x="4" y="12" width="92" height="4" fill={STONE} stroke={OUTLINE} strokeWidth="0.9" />
      {[0, 1, 2].map((row) => {
        const y = 16 + row * 12, w = row === 0 ? 8 : 12, h = row === 0 ? 8 : 12
        const xs = []; for (let x = 6; x < 94; x += w + 2) xs.push(x)
        return (
          <g key={row}>
            <rect x="4" y={y} width="92" height={h + 2} fill={row === 0 ? STONE : STONE_SH} stroke={OUTLINE} strokeWidth="0.8" />
            {xs.map((x) => <path key={x} d={`M${x} ${y + h + 1} v-${h / 2} a${w / 2} ${w / 2} 0 0 1 ${w} 0 v${h / 2} Z`} fill={SHADOW} stroke={OUTLINE} strokeWidth="0.5" />)}
          </g>
        )
      })}
    </Frame>
  )
}

// ---- Site de fouille (Vix, Troie) : tertre, tranchée, pelles, urne ----
function Fouille(props) {
  return (
    <Frame {...props}>
      <rect x="0" y="50" width="100" height="14" fill="#c9ad66" />
      <path d="M8 52 Q50 14 92 52 Z" fill="#8f7a4e" stroke={OUTLINE} strokeWidth="1" />
      <path d="M8 52 Q50 24 92 52" fill="none" stroke="#7f9a5a" strokeWidth="3" />
      <rect x="38" y="36" width="24" height="16" fill={SHADOW} stroke={OUTLINE} strokeWidth="0.9" />
      <path d="M40 38 h20 M40 42 h20 M40 46 h20" stroke="#6b5a45" strokeWidth="0.6" />
      <path d="M46 52 q4 -8 8 0" fill={TERRA} stroke={OUTLINE} strokeWidth="0.8" />
      <path d="M20 54 l10 -16 M78 54 l-10 -16" stroke="#5a3d24" strokeWidth="1.6" />
      <path d="M30 38 l3 -5 l4 3 z M68 38 l-3 -5 l-4 3 z" fill={STONE_SH} stroke={OUTLINE} strokeWidth="0.7" />
    </Frame>
  )
}

// ---- Grande Bibliothèque : façade à colonnes, rouleaux empilés ----
function Bibliotheque(props) {
  return (
    <Frame {...props}>
      <rect x="6" y="56" width="88" height="5" fill={MARBLE_SH} stroke={OUTLINE} strokeWidth="1" />
      <rect x="10" y="20" width="80" height="36" fill={MARBLE} stroke={OUTLINE} strokeWidth="1" />
      <polygon points="8,20 92,20 50,6" fill={MARBLE} stroke={OUTLINE} strokeWidth="1.1" />
      {[16, 30, 62, 76].map((x) => <rect key={x} x={x} y="24" width="6" height="32" fill={MARBLE_SH} stroke={OUTLINE} strokeWidth="0.8" />)}
      <rect x="40" y="30" width="20" height="26" fill={SHADOW} stroke={OUTLINE} strokeWidth="0.8" />
      {[0, 1, 2].map((r) => [43, 50, 55].map((x) => <circle key={x + '-' + r} cx={x} cy={36 + r * 6} r="2.2" fill={STONE} stroke={OUTLINE} strokeWidth="0.5" />))}
      <circle cx="50" cy="13" r="1.8" fill={GOLD} />
    </Frame>
  )
}

// ---- Grand Phare : tour à degrés, feu au sommet, mer ----
function Phare(props) {
  return (
    <Frame {...props}>
      <rect x="0" y="50" width="100" height="14" fill="#4f7fa0" />
      <path d="M0 56 q10 -2 20 0 t20 0 t20 0 t20 0 t20 0" stroke="#bfe0ee" strokeWidth="1" fill="none" opacity="0.7" />
      <rect x="34" y="46" width="32" height="8" fill={STONE_SH} stroke={OUTLINE} strokeWidth="1" />
      <rect x="40" y="26" width="20" height="20" fill={STONE} stroke={OUTLINE} strokeWidth="1" />
      <rect x="44" y="14" width="12" height="12" fill={STONE_SH} stroke={OUTLINE} strokeWidth="1" />
      <rect x="46" y="8" width="8" height="6" fill={STONE} stroke={OUTLINE} strokeWidth="0.9" />
      <path d="M50 8 q-4 -4 0 -7 q3 3 3 5 q1 -1 2 0 q0 3 -5 2" fill={GOLD} stroke="#c9892a" strokeWidth="0.6" />
      <path d="M46 6 l-30 -4 M54 6 l30 -4" stroke={GOLD} strokeWidth="0.8" opacity="0.6" />
      <rect x="48" y="34" width="4" height="6" fill={SHADOW} />
    </Frame>
  )
}

// ---- Jardins suspendus : terrasses fleuries, eau qui ruisselle ----
function Jardins(props) {
  return (
    <Frame {...props}>
      <rect x="6" y="54" width="88" height="8" fill={STONE_SH} stroke={OUTLINE} strokeWidth="1" />
      <rect x="14" y="40" width="72" height="14" fill={STONE} stroke={OUTLINE} strokeWidth="1" />
      <rect x="24" y="26" width="52" height="14" fill={STONE} stroke={OUTLINE} strokeWidth="1" />
      <rect x="34" y="14" width="32" height="12" fill={STONE} stroke={OUTLINE} strokeWidth="1" />
      {[[16, 40], [30, 40], [70, 40], [84, 40], [26, 26], [48, 26], [74, 26], [36, 14], [64, 14]].map(([x, y], i) => (
        <g key={i}><circle cx={x} cy={y - 3} r="5" fill="#4f7a3a" stroke={OUTLINE} strokeWidth="0.7" /><circle cx={x + 3} cy={y - 5} r="1.3" fill={TERRA} /></g>
      ))}
      <path d="M50 14 v40" stroke="#6f9fb8" strokeWidth="2" opacity="0.8" />
      <path d="M40 54 h20" stroke="#6f9fb8" strokeWidth="2" opacity="0.8" />
    </Frame>
  )
}

// ---- Panthéon : portique et grande coupole à oculus ----
function Pantheon(props) {
  return (
    <Frame {...props}>
      <rect x="6" y="56" width="88" height="5" fill={MARBLE_SH} stroke={OUTLINE} strokeWidth="1" />
      <path d="M22 40 A28 24 0 0 1 78 40 Z" fill={STONE_SH} stroke={OUTLINE} strokeWidth="1.1" />
      <circle cx="50" cy="20" r="2.5" fill={SHADOW} />
      <rect x="22" y="40" width="56" height="16" fill={MARBLE} stroke={OUTLINE} strokeWidth="1" />
      <polygon points="10,34 60,34 35,22" fill={MARBLE} stroke={OUTLINE} strokeWidth="1" />
      <rect x="12" y="34" width="46" height="4" fill={MARBLE_SH} stroke={OUTLINE} strokeWidth="0.8" />
      {[15, 25, 35, 45].map((x) => <rect key={x} x={x} y="38" width="5" height="18" fill={MARBLE} stroke={OUTLINE} strokeWidth="0.8" />)}
    </Frame>
  )
}

// ---- Grande Cathédrale : nef, deux tours, rosace ----
function Cathedrale(props) {
  return (
    <Frame {...props}>
      <rect x="6" y="56" width="88" height="5" fill={STONE_SH} stroke={OUTLINE} strokeWidth="1" />
      <rect x="30" y="26" width="40" height="30" fill={STONE} stroke={OUTLINE} strokeWidth="1" />
      <polygon points="28,26 72,26 50,12" fill={STONE_SH} stroke={OUTLINE} strokeWidth="1" />
      {[[14, 14], [72, 14]].map(([x, y], i) => (
        <g key={i}><rect x={x} y={y} width="14" height="42" fill={STONE} stroke={OUTLINE} strokeWidth="1" /><polygon points={`${x - 1},${y} ${x + 15},${y} ${x + 7},${y - 12}`} fill={STONE_SH} stroke={OUTLINE} strokeWidth="0.9" />
          <path d={`M${x + 5} 50 v-8 a2 2 0 0 1 4 0 v8 Z`} fill={SHADOW} /></g>
      ))}
      <circle cx="50" cy="34" r="6" fill={SHADOW} stroke={GOLD} strokeWidth="1" />
      <path d="M50 28 v12 M44 34 h12 M46 30 l8 8 M46 38 l8 -8" stroke={GOLD} strokeWidth="0.7" />
      <path d="M46 56 v-10 a4 4 0 0 1 8 0 v10 Z" fill={SHADOW} />
      <path d="M50 12 v-5 M48 9 h4" stroke={GOLD} strokeWidth="1" />
    </Frame>
  )
}

// ---- Table Ronde : la table et ses sièges, sous les voûtes de Camelot ----
function TableRonde(props) {
  return (
    <Frame {...props}>
      <rect x="0" y="0" width="100" height="64" fill="#2b2417" />
      <path d="M8 30 A42 30 0 0 1 92 30" fill="none" stroke={STONE_SH} strokeWidth="2" />
      <ellipse cx="50" cy="44" rx="34" ry="11" fill="#5a3d24" stroke={OUTLINE} strokeWidth="1.2" />
      <ellipse cx="50" cy="42" rx="34" ry="11" fill="#7a5433" stroke={OUTLINE} strokeWidth="1" />
      <ellipse cx="50" cy="42" rx="10" ry="3.5" fill={GOLD} opacity="0.8" />
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => {
        const r = (a * Math.PI) / 180
        return <rect key={a} x={50 + Math.cos(r) * 39 - 2} y={42 + Math.sin(r) * 13 - 3} width="4" height="6" rx="1" fill={STONE_SH} stroke={OUTLINE} strokeWidth="0.6" />
      })}
      <path d="M50 24 v-10 M46 17 h8" stroke={GOLD} strokeWidth="1.4" />
    </Frame>
  )
}

// ---- Mausolée : soubassement, colonnade, pyramide à degrés, quadrige ----
function Mausolee(props) {
  return (
    <Frame {...props}>
      <rect x="6" y="56" width="88" height="5" fill={MARBLE_SH} stroke={OUTLINE} strokeWidth="1" />
      <rect x="18" y="40" width="64" height="16" fill={MARBLE} stroke={OUTLINE} strokeWidth="1" />
      <rect x="22" y="28" width="56" height="12" fill={MARBLE_SH} stroke={OUTLINE} strokeWidth="1" />
      {[25, 34, 43, 52, 61, 70].map((x) => <rect key={x} x={x} y="29" width="4" height="11" fill={MARBLE} stroke={OUTLINE} strokeWidth="0.7" />)}
      {[0, 1, 2, 3].map((i) => <rect key={i} x={26 + i * 6} y={26 - i * 4} width={48 - i * 12} height="4" fill={MARBLE} stroke={OUTLINE} strokeWidth="0.8" />)}
      <rect x="46" y="6" width="8" height="5" fill={GOLD} stroke={OUTLINE} strokeWidth="0.7" />
      <path d="M44 6 l2 -3 M56 6 l-2 -3" stroke={GOLD} strokeWidth="1" />
    </Frame>
  )
}

// ---- Porta Nigra : porte fortifiée à deux tours, arcades superposées ----
function Porte(props) {
  return (
    <Frame {...props}>
      <rect x="6" y="56" width="88" height="5" fill={STONE_SH} stroke={OUTLINE} strokeWidth="1" />
      {[[10, 10], [66, 10]].map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y} width="24" height="46" fill="#5d5347" stroke={OUTLINE} strokeWidth="1" />
          {[0, 1, 2].map((r) => [x + 5, x + 14].map((ax) => <path key={ax + '-' + r} d={`M${ax} ${y + 12 + r * 13} v-6 a2.5 2.5 0 0 1 5 0 v6 Z`} fill={SHADOW} stroke={OUTLINE} strokeWidth="0.5" />))}
        </g>
      ))}
      <rect x="34" y="20" width="32" height="36" fill="#6b6152" stroke={OUTLINE} strokeWidth="1" />
      {[38, 50].map((ax) => <path key={ax} d={`M${ax} 32 v-6 a3.5 3.5 0 0 1 7 0 v6 Z`} fill={SHADOW} stroke={OUTLINE} strokeWidth="0.5" />)}
      <path d="M40 56 v-14 a10 10 0 0 1 20 0 v14 Z" fill={SHADOW} stroke={OUTLINE} strokeWidth="0.8" />
      <rect x="8" y="8" width="84" height="3" fill="#5d5347" stroke={OUTLINE} strokeWidth="0.8" />
    </Frame>
  )
}

// ---- Chersonèse : cité grecque en ruine sur la mer — colonnes brisées ----
function RuineGrecque(props) {
  return (
    <Frame {...props}>
      <rect x="0" y="48" width="100" height="16" fill="#4f7fa0" />
      <path d="M0 52 q10 -2 20 0 t20 0 t20 0 t20 0 t20 0" stroke="#bfe0ee" strokeWidth="1" fill="none" opacity="0.6" />
      <path d="M0 50 L0 40 Q40 34 100 42 L100 50 Z" fill="#c9ad66" stroke={OUTLINE} strokeWidth="0.9" />
      <rect x="18" y="36" width="64" height="4" fill={MARBLE_SH} stroke={OUTLINE} strokeWidth="0.9" />
      {[[22, 18], [32, 10], [42, 24], [58, 8], [68, 26], [76, 16]].map(([x, h], i) => (
        <g key={i}><rect x={x} y={36 - h} width="6" height={h} fill={MARBLE} stroke={OUTLINE} strokeWidth="0.8" />
          <path d={`M${x} ${36 - h} l1.5 -2 l2 1.5 l2.5 -1.5`} stroke={OUTLINE} strokeWidth="0.7" fill="none" /></g>
      ))}
      <rect x="30" y="14" width="10" height="3" fill={MARBLE_SH} stroke={OUTLINE} strokeWidth="0.7" transform="rotate(-12 35 15)" />
      <ellipse cx="88" cy="44" rx="6" ry="2" fill={MARBLE_SH} stroke={OUTLINE} strokeWidth="0.6" />
    </Frame>
  )
}

// ---- Altamira : entrée de grotte, bisons ocre sur la paroi ----
function Grotte(props) {
  return (
    <Frame {...props}>
      <path d="M0 64 L0 26 Q30 4 70 12 Q96 18 100 40 L100 64 Z" fill="#6b5a45" stroke={OUTLINE} strokeWidth="1" />
      <path d="M14 64 Q16 30 50 26 Q84 30 86 64 Z" fill="#2b2417" stroke={OUTLINE} strokeWidth="1" />
      <path d="M30 40 q4 -5 10 -3 q6 -2 8 4 q2 6 -4 7 h-10 q-6 -1 -4 -8 Z" fill={TERRA} stroke={TERRA_DK} strokeWidth="0.8" />
      <path d="M33 48 v5 M41 48 v5" stroke={TERRA_DK} strokeWidth="1.2" />
      <path d="M54 46 q4 -5 10 -3 q6 -2 8 4 q2 6 -4 7 h-10 q-6 -1 -4 -8 Z" fill="#c07a3a" stroke={TERRA_DK} strokeWidth="0.8" />
      <path d="M57 54 v4 M65 54 v4" stroke={TERRA_DK} strokeWidth="1.2" />
      <circle cx="62" cy="34" r="2" fill="#c07a3a" /><path d="M20 36 l3 -2 l3 2" stroke="#c07a3a" strokeWidth="1" fill="none" />
    </Frame>
  )
}

// ---- Kourganes : tumulus de la steppe, herbe rase, stèle de pierre ----
function Tumulus(props) {
  return (
    <Frame {...props}>
      <rect x="0" y="50" width="100" height="14" fill="#8f9a5a" />
      <path d="M0 50 Q25 40 50 50 Z" fill="#7f8a4a" stroke={OUTLINE} strokeWidth="0.8" />
      <path d="M16 52 Q50 8 84 52 Z" fill="#9aa663" stroke={OUTLINE} strokeWidth="1.1" />
      <path d="M22 52 Q50 20 78 52" fill="none" stroke="#7f8a4a" strokeWidth="1.2" />
      <path d="M50 30 v22" stroke="#7f8a4a" strokeWidth="0.8" opacity="0.6" />
      <rect x="47" y="14" width="6" height="16" rx="2" fill={STONE_SH} stroke={OUTLINE} strokeWidth="0.9" />
      <circle cx="50" cy="19" r="1.4" fill={OUTLINE} /><path d="M48 24 h4" stroke={OUTLINE} strokeWidth="0.8" />
      <circle cx="12" cy="10" r="5" fill={GOLD} opacity="0.8" />
      <path d="M60 58 l4 -3 l4 3 M70 60 l4 -3 l4 3" stroke="#5a3d24" strokeWidth="1" fill="none" />
    </Frame>
  )
}

const ART = {
  parthenon: Parthenon, colosse_rhodes: ColosseRhodes, knossos: Knossos, colisee: Colisee,
  stonehenge: Stonehenge, pyramides: Pyramides, vesuve: Volcan, broceliande: Foret,
  compostelle: Cathedrale, porta_nigra: Porte, chersonese: RuineGrecque,
  altamira: Grotte, kourganes: Tumulus, troie: Fouille,
  mur_d_hadrien: Mur, grande_muraille: Mur, pont_du_gard: Aqueduc,
  grande_bibliotheque: Bibliotheque, grand_phare: Phare, jardins_suspendus: Jardins,
  pantheon: Pantheon, cathedrale: Cathedrale, table_ronde: TableRonde, mausolee: Mausolee,
}
// Repli par type pour toute merveille sans dessin dédié.
const ART_TYPE = { antique: Parthenon, naturelle: Foret, ruine: RuineGrecque, fouille: Fouille, construction: Bibliotheque }

export default function WonderArt({ id, type, size, className, style }) {
  const C = ART[id] || ART_TYPE[type]
  if (!C) return null
  return <C size={size} className={className} style={style} />
}
