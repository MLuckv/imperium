import { useId } from 'react'

// MÉDAILLONS DES SOUVERAINS — portraits en profil façon monnaie antique : or en
// relief, grènetis, légende latine sur le pourtour, attribut propre à chacun
// (laurier de Néron, cornes d'Ammon d'Alexandre, casque corinthien de Léonidas…).

const LEGENDES = {
  rome: 'NERO · CAESAR · AVGVSTVS',
  carthage: 'PTOLEMAIOS · BASILEVS',
  macedoine: 'ALEXANDROS · BASILEVS',
  sparte: 'LEONIDAS · LAKEDAIMON',
  francs: 'IOHANNA · PVELLA · AVRELIANENSIS',
  bretons: 'ARTVRVS · REX · BRITANNIAE',
}

// Profil commun (tourné vers la droite).
const TETE = 'M38 90 C36 80 33 74 30 66 C24 54 26 38 36 28 C44 20 58 18 66 26 C70 31 70 37 70 41 L77 52 L71 54 C72 56 71 58 69 59 C70 61 70 63 68 64 C68 69 64 72 60 73 C60 79 61 85 63 90 Z'

function Laurier({ c }) {
  const pts = [[30, 56], [29, 48], [31, 40], [35, 33], [41, 27], [48, 23], [55, 22], [61, 24]]
  return (
    <g>
      <path d="M31 60 C26 44 36 24 62 24" fill="none" stroke={c.fonce} strokeWidth="1.2" />
      {pts.map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x - 2.4} cy={y + 1.2} rx="4.2" ry="1.7" transform={`rotate(${-60 + i * 14} ${x - 2.4} ${y + 1.2})`} fill={c.clair} stroke={c.fonce} strokeWidth="0.5" />
          <ellipse cx={x + 1.6} cy={y - 1.6} rx="4.2" ry="1.7" transform={`rotate(${-20 + i * 14} ${x + 1.6} ${y - 1.6})`} fill={c.clair} stroke={c.fonce} strokeWidth="0.5" />
        </g>
      ))}
      <path d="M31 60 q-5 6 -9 14 M31 60 q-1 7 -4 15" stroke={c.fonce} strokeWidth="1.1" fill="none" />
    </g>
  )
}

function Attributs({ faction, c }) {
  switch (faction) {
    case 'rome': // laurier + collier de barbe
      return <g><Laurier c={c} />{[[36, 44], [33, 52], [35, 60]].map(([x, y]) => <path key={y} d={`M${x} ${y} q3 -3 5 0 q-2 3 -5 0`} fill="none" stroke={c.fonce} strokeWidth="0.8" />)}</g>
    case 'carthage': // diadème à rubans, boucles
      return (
        <g>
          <path d="M30 44 C40 36 56 30 68 32" stroke={c.clair} strokeWidth="4" fill="none" />
          <path d="M30 44 C40 36 56 30 68 32" stroke={c.fonce} strokeWidth="0.6" fill="none" />
          <path d="M31 45 q-6 8 -4 18 M31 45 q-2 9 2 17" stroke={c.fonce} strokeWidth="1.6" fill="none" />
          {[[34, 50], [32, 57], [34, 64]].map(([x, y]) => <path key={y} d={`M${x} ${y} q3 -3 5 0 q-2 3 -5 0`} fill="none" stroke={c.fonce} strokeWidth="0.9" />)}
        </g>
      )
    case 'macedoine': // cornes d'Ammon, chevelure en anastolè
      return (
        <g>
          <path d="M46 44 c-8 -2 -12 8 -6 12 c5 3 9 -3 5 -6 c-3 -2 -5 2 -2 3" stroke={c.clair} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M46 44 c-8 -2 -12 8 -6 12 c5 3 9 -3 5 -6" stroke={c.fonce} strokeWidth="0.7" fill="none" />
          <path d="M52 22 c-4 -6 2 -10 6 -6 M58 22 c0 -7 7 -7 8 -2 M45 24 c-6 -4 -4 -10 2 -8" stroke={c.fonce} strokeWidth="1.4" fill="none" />
          <path d="M30 52 c-4 6 -4 14 -2 20 M33 60 c-3 6 -2 12 0 16" stroke={c.fonce} strokeWidth="1.4" fill="none" />
        </g>
      )
    case 'sparte': // casque corinthien à cimier
      return (
        <g>
          <path d="M27 60 C22 40 34 18 56 18 C66 18 72 26 72 36 L72 44 L64 44 L64 56 L56 58 L56 68 L36 70 Z" fill={c.moyen} stroke={c.fonce} strokeWidth="1" />
          <path d="M64 44 L64 56" stroke={c.fonce} strokeWidth="1.4" />
          <path d="M58 37 q6 -2 12 0" stroke={c.fonce} strokeWidth="1.4" fill="none" />
          <path d="M30 22 C38 4 64 2 74 16 C64 10 44 10 32 26 Z" fill={c.clair} stroke={c.fonce} strokeWidth="0.8" />
          {[36, 42, 48, 54, 60, 66].map((x) => <path key={x} d={`M${x} ${14 - (x > 50 ? (x - 50) * 0.1 : (50 - x) * 0.15)} l2 6`} stroke={c.fonce} strokeWidth="0.6" />)}
        </g>
      )
    case 'francs': // cheveux courts « en bol », gorgerin d'armure, fleur de lys
      return (
        <g>
          <path d="M28 54 C24 34 38 20 56 20 C66 20 71 28 71 37 C64 34 56 33 48 36 C40 40 36 48 36 56 Z" fill={c.moyen} stroke={c.fonce} strokeWidth="0.9" />
          {[40, 46, 52, 58, 64].map((x) => <path key={x} d={`M${x} 24 q-2 6 -1 11`} stroke={c.fonce} strokeWidth="0.6" fill="none" />)}
          <path d="M36 76 C44 72 56 74 64 78 L64 90 L36 90 Z" fill={c.moyen} stroke={c.fonce} strokeWidth="0.9" />
          <path d="M38 81 h24 M38 86 h24" stroke={c.fonce} strokeWidth="0.7" />
        </g>
      )
    case 'bretons': // couronne fleuronnée, barbe
      return (
        <g>
          <path d="M33 34 L34 22 L40 30 L46 18 L52 28 L58 17 L63 28 L68 22 L67 34 C56 30 44 30 33 34 Z" fill={c.clair} stroke={c.fonce} strokeWidth="0.9" />
          {[[40, 30], [46, 18], [52, 28], [58, 17], [63, 28]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.3" fill={c.fonce} />)}
          <path d="M46 55 C45 70 53 81 64 79 C68 75 69 69 68 64 C65 66 62 65 58 62 C54 60 50 58 46 55 Z" fill={c.moyen} stroke={c.fonce} strokeWidth="0.8" />
          <path d="M70 57 q-4 1.4 -8 -0.6" stroke={c.fonce} strokeWidth="1.2" fill="none" strokeLinecap="round" />
          {[52, 57, 62].map((x) => <path key={x} d={`M${x} ${66 + (x - 52) * 0.3} q0 5 -1 8`} stroke={c.fonce} strokeWidth="0.5" fill="none" />)}
        </g>
      )
    default:
      return null
  }
}

export default function Medaillon({ faction, taille = 64, className = '', style }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const c = { clair: '#f6dc94', moyen: '#d9ad55', fonce: '#6e4c17' }
  const legende = LEGENDES[faction] || ''
  return (
    <svg viewBox="0 0 100 100" width={taille} height={taille} className={className} style={style} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}or`} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#fbe7a8" /><stop offset="0.55" stopColor="#d4a547" /><stop offset="1" stopColor="#8a6420" />
        </radialGradient>
        <radialGradient id={`${id}relief`} cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffeeb8" /><stop offset="0.6" stopColor="#d9ad55" /><stop offset="1" stopColor="#9a7128" />
        </radialGradient>
        <path id={`${id}arc`} d="M 24.5 75.5 A 36 36 0 1 1 75.5 75.5" />
        <clipPath id={`${id}champ`}><circle cx="50" cy="50" r="33" /></clipPath>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${id}or)`} stroke="#5a3e12" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="44" fill="none" stroke="#6e4c17" strokeWidth="0.6" strokeDasharray="0.1 2.6" strokeLinecap="round" strokeOpacity="0.9" style={{ strokeWidth: 1.6 }} />
      <circle cx="50" cy="50" r="34" fill="#c99a44" stroke="#6e4c17" strokeWidth="0.8" />
      <text fontFamily="Cinzel, Georgia, serif" fontSize="7" fontWeight="700" fill="#5a3e12" letterSpacing="0.5">
        <textPath href={`#${id}arc`} startOffset="50%" textAnchor="middle">{legende}</textPath>
      </text>
      <g clipPath={`url(#${id}champ)`}>
        <g transform="translate(9 9) scale(0.82)">
          <path d={TETE} fill="#000" opacity="0.25" transform="translate(1.6 1.6)" />
          <path d={TETE} fill={`url(#${id}relief)`} stroke={c.fonce} strokeWidth="1" />
          {!['macedoine', 'sparte'].includes(faction) && <ellipse cx="44" cy="50" rx="3.6" ry="5.6" fill="none" stroke={c.fonce} strokeWidth="0.9" />}
          <path d="M60 40 q3 -1.6 5.5 0.4 q-3 1.2 -5.5 -0.4z" fill={c.fonce} />
          <path d="M58 37 q4 -2.4 8 -0.6" stroke={c.fonce} strokeWidth="0.9" fill="none" />
          <Attributs faction={faction} c={c} />
        </g>
      </g>
      <circle cx="50" cy="50" r="48" fill="none" stroke="#fff3c8" strokeOpacity="0.35" strokeWidth="0.8" />
    </svg>
  )
}
