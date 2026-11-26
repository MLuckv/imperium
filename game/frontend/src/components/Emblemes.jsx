import { useId } from 'react'

// ARMOIRIES DES CIVILISATIONS — emblèmes pleins et détaillés (viewBox 64×64),
// construits géométriquement pour rester nets à toutes les tailles.
//   variante « or »    : métal doré en relief (bannières, médaillons, en-têtes) ;
//   variante « plein » : une seule teinte (currentColor) avec détails en creux.

const R = (n) => Math.round(n * 100) / 100

// Plume / feuille : fuseau entre deux points, largeur w, cambrure c.
function fuseau(x1, y1, x2, y2, w, c = 0) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1
  const nx = -dy / L, ny = dx / L
  const ax = mx + nx * (w + c), ay = my + ny * (w + c), bx = mx - nx * (w - c), by = my - ny * (w - c)
  return `M${R(x1)} ${R(y1)} Q${R(ax)} ${R(ay)} ${R(x2)} ${R(y2)} Q${R(bx)} ${R(by)} ${R(x1)} ${R(y1)}Z`
}

// ---------------------------------------------------------------- Rome : aigle dans sa couronne
function aigle() {
  const formes = []
  // Couronne de laurier : deux rameaux denses qui montent et se rejoignent en haut.
  const tiges = []
  for (const sens of [-1, 1]) {
    tiges.push(`M${R(32 + Math.cos(Math.PI / 2 + sens * 0.3) * 26.5)} ${R(34 + Math.sin(Math.PI / 2 + sens * 0.3) * 26.5)} A26.5 26.5 0 0 ${sens > 0 ? 0 : 1} ${R(32 + Math.cos(Math.PI / 2 + sens * 2.95) * 26.5)} ${R(34 + Math.sin(Math.PI / 2 + sens * 2.95) * 26.5)}`)
    for (let i = 0; i < 13; i++) {
      const a = Math.PI / 2 + sens * (0.36 + i * 0.2)
      const x = 32 + Math.cos(a) * 26.5, y = 34 + Math.sin(a) * 26.5
      const tx = -Math.sin(a) * sens, ty = Math.cos(a) * sens    // tangente, dans le sens de la pousse
      const nx = Math.cos(a), ny = Math.sin(a)                   // normale, vers l'extérieur
      for (const cote of [-1, 1]) {
        const dx = -tx * 0.82 + nx * cote * 0.57, dy = -ty * 0.82 + ny * cote * 0.57
        formes.push(fuseau(x, y, x + dx * 6.2, y + dy * 6.2, 1.55))
      }
    }
  }
  // Ailes déployées : rémiges en éventail + couvertures pleines.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const t2 = i / 5
      const bx = 32 + s * (5 + t2 * 2.5), by = 25 + t2 * 7
      const ang = (-58 + t2 * 62) * (Math.PI / 180)
      const L = 18 - t2 * 5
      formes.push(fuseau(bx, by, bx + s * Math.cos(ang) * L, by + Math.sin(ang) * L, 2.3 - t2 * 0.5, s * -0.5))
    }
    formes.push(`M${32 + s * 3} 22 C${32 + s * 9} 15 ${32 + s * 16} 13 ${32 + s * 20} 14.5 C${32 + s * 15} 18 ${32 + s * 10} 24 ${32 + s * 6} 31Z`)
    formes.push(`M${32 + s * 2.5} 47 l${s * 3} 3 l${s * 1.5} -1 M${32 + s * 2.5} 47 l${s * 1} 4`)  // serres
  }
  formes.push('M32 20 C37 22.5 38 30 37 36.5 C36 42 34 46 32 48.5 C30 46 28 42 27 36.5 C26 30 27 22.5 32 20Z')
  ;[-2, -1, 0, 1, 2].forEach((k) => formes.push(fuseau(32, 44, 32 + k * 2.8, 55, 1.5)))
  // Tête tournée, bec crochu.
  formes.push('M33 9.5 C36.8 9.5 38.2 12.8 37.4 16 C36.8 18.6 35 20.6 32.6 21.2 C30.8 21.6 29.6 20.4 29.4 18.8 C27.6 19.2 25.6 18.8 24.6 17.2 C26.2 17.4 27.4 16.8 28.2 15.6 C28.2 12 30.2 9.5 33 9.5Z')
  return { formes, details: ['M32 25v17', 'M30.4 29l1.6 2 1.6-2', 'M30.4 34l1.6 2 1.6-2', 'M28.2 15.6 C29.4 16.4 29.6 17.6 29.4 18.8'], oeil: [33.4, 13.8] }
}

// ---------------------------------------------------------------- Égypte : disque ailé et ankh
function disqueAile() {
  const formes = [], details = []
  for (const s of [-1, 1]) {
    // Couvertures arquées, puis trois rangs de rémiges horizontales de plus en plus longues.
    formes.push(`M${32 + s * 6} 16 C${32 + s * 14} 11.5 ${32 + s * 23} 11 ${32 + s * 30} 14 L${32 + s * 30} 17.6 C${32 + s * 22} 15.4 ${32 + s * 14} 16.4 ${32 + s * 7} 20.5Z`)
    for (let r2 = 0; r2 < 3; r2++) {
      const y0 = 18.6 + r2 * 3.3, x0 = 32 + s * 7, x1 = 32 + s * (30.5 - r2 * 2.5)
      formes.push(`M${x0} ${y0} L${x1} ${y0 - 0.6} L${x1 - s * 1.6} ${y0 + 2.8} L${x0} ${y0 + 3}Z`)
      for (let k = 1; k < 8; k++) {
        const x = x0 + (x1 - x0) * (k / 8)
        details.push(`M${R(x)} ${R(y0 + 0.2)} l${s * -0.8} 2.4`)
      }
    }
    // Uræus dressé.
    formes.push(`M${32 + s * 7.2} 21 c${s * 2.4} -0.6 ${s * 2.8} -3.4 ${s * 1} -4.6 c${s * -1.4} -1 ${s * -0.4} -3.2 ${s * 1.2} -3.4 l${s * 0.6} 1 c${s * -1} 0.4 ${s * -1.2} 1.2 ${s * -0.4} 1.8 c${s * 2.4} 1.8 ${s * 1.6} 5.6 ${s * -1.6} 6.4Z`)
  }
  formes.push('M32 9.5 a7.5 7.5 0 1 1 -0.01 0Z')
  details.push('M32 12 a5 5 0 1 1 -0.01 0')
  const ankh = 'M32 33.5 c-3.6 0 -5.6 3.2 -4 6.6 c0.8 1.6 2 2.8 2.6 3.6 L23.5 43.7 L23.5 47 L30.4 47 L30.4 60 L33.6 60 L33.6 47 L40.5 47 L40.5 43.7 L33.4 43.7 c0.6 -0.8 1.8 -2 2.6 -3.6 c1.6 -3.4 -0.4 -6.6 -4 -6.6Z M32 36.4 c1.8 0 2.4 1.6 1.6 3.2 c-0.4 0.8 -1 1.6 -1.6 2.2 c-0.6 -0.6 -1.2 -1.4 -1.6 -2.2 c-0.8 -1.6 -0.2 -3.2 1.6 -3.2Z'
  return { formes: [...formes, ankh], details }
}

// ---------------------------------------------------------------- Macédoine : soleil de Vergina
function vergina() {
  const formes = []
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2
    const L = i % 2 === 0 ? 29 : 21, w = i % 2 === 0 ? 0.17 : 0.14
    const x0 = 32 + Math.cos(a - w) * 8, y0 = 32 + Math.sin(a - w) * 8
    const x1 = 32 + Math.cos(a + w) * 8, y1 = 32 + Math.sin(a + w) * 8
    const xt = 32 + Math.cos(a) * L, yt = 32 + Math.sin(a) * L
    formes.push(`M${R(x0)} ${R(y0)} L${R(xt)} ${R(yt)} L${R(x1)} ${R(y1)}Z`)
  }
  formes.push('M32 23 a9 9 0 1 1 -0.01 0Z')
  const details = ['M32 26 a6 6 0 1 1 -0.01 0']
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    details.push(fuseau(32, 32, 32 + Math.cos(a) * 5.2, 32 + Math.sin(a) * 5.2, 1.3))
  }
  return { formes, details, rosace: true }
}

// ---------------------------------------------------------------- Sparte : aspis au lambda
function aspis() {
  const rivets = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2
    return `M${R(32 + Math.cos(a) * 25.8)} ${R(32 + Math.sin(a) * 25.8)} m-1 0 a1 1 0 1 0 2 0 a1 1 0 1 0 -2 0`
  })
  return {
    formes: ['M32 3 a29 29 0 1 1 -0.01 0Z'],
    details: ['M32 8.5 a23.5 23.5 0 1 1 -0.01 0', ...rivets],
    creux: ['M22 46 L32 17 L42 46 L37 46 L32 30.5 L27 46Z'],
  }
}

// ---------------------------------------------------------------- Francs : fleur de lys
function lys() {
  return {
    formes: [
      'M32 3 C37.5 9 39.5 17 37.8 25 C36.8 29.5 34.6 33 32 36 C29.4 33 27.2 29.5 26.2 25 C24.5 17 26.5 9 32 3Z',
      'M35.5 33.5 C38 25 45 19.5 52 21.5 C58.5 23.5 59.5 32 54.5 35.5 C51 38 46.5 36 47.2 32.2 C49.6 33.6 52.4 32.4 52.2 29.6 C51.8 26.4 47 25.6 43.4 28 C40.2 30.2 38.2 34 37.6 37.6Z',
      'M28.5 33.5 C26 25 19 19.5 12 21.5 C5.5 23.5 4.5 32 9.5 35.5 C13 38 17.5 36 16.8 32.2 C14.4 33.6 11.6 32.4 11.8 29.6 C12.2 26.4 17 25.6 20.6 28 C23.8 30.2 25.8 34 26.4 37.6Z',
      'M19 36.5 h26 a2.4 2.4 0 0 1 0 4.8 h-26 a2.4 2.4 0 0 1 0 -4.8Z',
      'M29.6 41.5 h4.8 L33.6 52 C33.4 55 32.8 57.5 32 59.5 C31.2 57.5 30.6 55 30.4 52Z',
      'M28.6 41.5 C27.5 47 24.5 51 19.5 52.5 C21.5 49 22.6 45.5 22.8 41.5Z',
      'M35.4 41.5 C36.5 47 39.5 51 44.5 52.5 C42.5 49 41.4 45.5 41.2 41.5Z',
    ],
    details: ['M32 9 V30', 'M21 39 h22'],
  }
}

// ---------------------------------------------------------------- Bretons : Excalibur et couronne
function excalibur() {
  return {
    formes: [
      'M32 4.5 a3.2 3.2 0 1 1 -0.01 0Z',                         // pommeau
      'M30.6 10 h2.8 v8 h-2.8Z',                                  // fusée
      'M17 18 C22 17 27 17.5 32 17.5 C37 17.5 42 17 47 18 C48.6 18.3 48.6 20.7 47 21 C42 22 37 21.6 32 21.6 C27 21.6 22 22 17 21 C15.4 20.7 15.4 18.3 17 18Z', // garde
      'M29.6 21.6 h4.8 L34 54 L32 60 L30 54Z',                    // lame
      'M14 41 L16.5 28.5 L22.5 35 L27 25.5 L32 33 L37 25.5 L41.5 35 L47.5 28.5 L50 41Z', // couronne (fleurons)
      'M13.5 41 h37 a1.6 1.6 0 0 1 0 3.2 h0 v3.4 h-37 v-3.4 a1.6 1.6 0 0 1 0 -3.2Z',  // bandeau
      'M16.5 28.5 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 M27 25.5 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 M37 25.5 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 M47.5 28.5 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0',
    ],
    details: ['M32 23 V52', 'M20 44.6 h0.1 M26 44.6 h0.1 M32 44.6 h0.1 M38 44.6 h0.1 M44 44.6 h0.1'],
  }
}

const CONSTRUCTEURS = { rome: aigle, carthage: disqueAile, macedoine: vergina, sparte: aspis, francs: lys, bretons: excalibur }
const CACHE = {}
function geometrie(faction) {
  if (!CACHE[faction]) CACHE[faction] = (CONSTRUCTEURS[faction] || aigle)()
  return CACHE[faction]
}

export default function Embleme({ faction, taille = 32, variante = 'plein', className = '', style, x, y }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const g = geometrie(faction)
  const or = variante === 'or'
  const remplissage = or ? `url(#${id}m)` : 'currentColor'
  const encre = or ? '#4a3210' : 'rgba(0,0,0,0.38)'
  return (
    <svg viewBox="0 0 64 64" x={x} y={y} width={taille} height={taille} className={className} style={style} aria-hidden="true">
      {or && (
        <defs>
          <linearGradient id={`${id}m`} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0" stopColor="#fff1bf" /><stop offset="0.35" stopColor="#f0c968" />
            <stop offset="0.7" stopColor="#c4902f" /><stop offset="1" stopColor="#8a5f1c" />
          </linearGradient>
          <filter id={`${id}o`} x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="0.9" stdDeviation="0.7" floodColor="#1a0f04" floodOpacity="0.75" />
          </filter>
        </defs>
      )}
      <g filter={or ? `url(#${id}o)` : undefined}>
        {g.formes.map((d, i) => <path key={i} d={d} fill={remplissage} stroke={or ? '#6a4814' : 'none'} strokeWidth={or ? 0.45 : 0} fillRule="evenodd" />)}
      </g>
      {(g.creux || []).map((d, i) => <path key={'c' + i} d={d} fill={encre} />)}
      {g.details.map((d, i) => <path key={'d' + i} d={d} fill="none" stroke={encre} strokeWidth={g.rosace ? 0.7 : 1} strokeLinecap="round" />)}
      {g.oeil && <circle cx={g.oeil[0]} cy={g.oeil[1]} r="0.9" fill={encre} />}
    </svg>
  )
}
