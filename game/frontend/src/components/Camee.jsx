import { useId } from 'react'

// Camée du conseiller : profil d'ivoire sculpté sur une sardoine, dans une
// monture d'or. Une coiffe par civilisation (Merlin, vizir, éphore…).

// Profil tourné vers la droite (repère 100×120).
const PROFIL = 'M36 100 C39 92 41 84 40 74 C34 70 28 62 27 52 C26 36 38 24 52 24 C64 24 70 32 71 42 L71 46 C70 48 70 49 71 51 C73 54 76 56 77 58 C76 60 74 61 72 61.5 C72.5 63 72.5 64 72 64.5 C71 65.5 70.5 66 71.5 67.5 C72 69 71 70 70.5 71 C70.5 74 69 77 65 79 C62 80 60 82 60 86 C60 92 61 96 63 100 Z'
const BUSTE = 'M16 121 C18 106 27 98 37 96 L64 96 C75 98 83 106 86 121 Z'
const OEIL = 'M61.5 48.4 C63 47.4 64.6 47.6 65.6 48.6 C64.4 49.6 62.8 49.7 61.5 48.4 Z'
const VISAGE = ['M60.5 45.4 C62.5 44.2 65 44.4 67 45.6', 'M70 58.4 C71 59.6 72 60 73.2 60', 'M48 64 C52 71 58 76 64 78.6', 'M68.5 66 C69.6 66.2 70.4 66.1 71.2 65.8']
const OREILLE = ['M45 46 C49.5 45 51 50.5 50 55 C49 58 46 58.5 44.5 56.5', 'M46.5 49 C48 49.5 48.5 52 47.5 54']

const COIFFES = {
  // Merlin : capuchon pointu retombant et longue barbe
  bretons: {
    devant: [
      'M68 36 C64 26 56 20 48 18 C44 13 37 10 27 11 C31 16 31 21 28 29 C23 41 21 57 23 72 C25 86 29 94 35 100 L58 100 C54 94 52 86 52 78 C52 70 52 62 54 56 C56 48 60 42 68 38 Z',
      'M56 63 C60 69 66 71.5 71 70.5 C73 76 72.5 83 70.5 91 C68.5 99 64.5 106 60 113 C56 105 54 96 54 87 C54 79 54 71 56 63 Z',
    ],
    traits: ['M30 30 C26 46 26 66 30 84', 'M36 26 C32 42 32 62 36 82', 'M59 76 C60 86 60 96 59 106', 'M64 74 C65 84 64 94 62 104', 'M68 76 C68 84 67 92 65 99'],
    drape: ['M37 98 C44 104 50 108 54 121', 'M68 100 C68 108 70 114 74 121', 'M78 106 C80 112 81 116 82 121'],
  },
  // Vizir d'Égypte : némès rayé
  carthage: {
    devant: ['M69 36.5 C63 29 50 27 40 31 C31 35 27 44 27 54 L22 94 C29 98 40 98 47 94 L47 72 C47 64 48 57 50 52 C53 46 59 42 69 40.5 Z'],
    traits: ['M68 38.5 C60 36 50 36 43 40', 'M30 60 L47 60', 'M29 67 L47 67', 'M28 74 L47 74', 'M27 81 L47 81', 'M26 88 L47 88', 'M34 38 C38 44 40 50 40 56', 'M41 33 C44 40 46 46 46 54'],
    drape: ['M37 98 L84 121', 'M48 97 C46 106 44 114 44 121', 'M30 104 C38 106 46 108 52 110'],
  },
  // Compagnon macédonien : casque à cimier et paragnathides
  macedoine: {
    devant: [
      'M27 54 C25 36 38 22 54 22 C66 22 72 30 72.5 38 L75 40.5 L63 41.5 C57 41.5 53 44 51 50 L51 66 C47 68 43 68 41 66 L39 69 C33 66 28 62 27 54 Z',
      'M51 49 L59 50.5 L59.5 63 L51 68 Z',
      'M30 33 C30 18 46 8 62 10 C72 11 78 16 80 22 C72 17 62 16 54 20 C44 24 36 30 33 40 Z',
    ],
    traits: ['M34 30 C40 18 54 12 66 13', 'M38 34 C44 24 54 18 64 17', 'M30 36 C34 26 42 18 52 14', 'M29 48 L50 46', 'M41 50 L41 64'],
    drape: ['M37 98 C50 102 62 108 70 121', 'M72 101 L60 108', 'M30 104 L40 121'],
  },
  // Éphore de Sparte : longue chevelure et barbe
  sparte: {
    devant: [
      'M28 52 C26 36 38 24 52 24 C62 24 68 28 70 34 C62 32 55 34 51 40 C47 46 47 54 49 62 C49 72 47 84 43 95 C36 95 30 91 28 83 C26 73 28 62 28 52 Z',
      'M50 60 C54 66 60 72 66 74 C68 75.5 70.5 74 71.5 70 C73 76 72 84 66.5 90 C60 92.5 54 88.5 50.5 80.5 C48.5 72 48.5 66 50 60 Z',
    ],
    traits: ['M33 44 C33 58 35 72 39 86', 'M39 38 C38 52 40 66 44 80', 'M45 34 C43 46 44 56 46 64', 'M56 74 C58 80 60 84 64 87', 'M61 77 C63 81 65 84 68 85'],
    drape: ['M37 98 C48 103 58 110 64 121', 'M44 99 C40 106 38 114 38 121'],
  },
  // Frère Ambroise : coule de moine
  francs: {
    devant: ['M70 34 C64 24 50 20 38 26 C26 34 22 52 24 70 C26 84 30 94 36 100 L58 100 C54 94 52 86 52 78 C52 70 52 62 54 56 C56 48 60 42 66 38 Z'],
    traits: ['M32 34 C26 48 26 66 30 84', 'M40 30 C34 44 34 62 38 80', 'M66 39 C59 43 55 50 53.5 58'],
    drape: ['M37 98 C44 106 48 112 50 121', 'M62 98 C64 106 66 114 66 121', 'M48 104 L54 121'],
  },
  // Sénateur romain : cheveux courts et couronne de laurier
  rome: {
    derriere: ['M28 52 C26 36 38 24 52 24 C62 24 68 29 70 36 C64 33 58 34 54 38 C50 42 48 46 47 50 C44 55 40 59 36 62 C32 60 29 57 28 52 Z'],
    traits: ['M58 33 C56 35 56 37 57 39', 'M50 33 C48 35 48 38 49 40', 'M42 37 C40 39 40 42 41 44', 'M35 44 C33 46 33 49 34 51', 'M32 54 C31 56 32 58 33 59'],
    oreille: true,
    laurier: true,
    drape: ['M37 98 C52 102 64 108 74 121', 'M47 98 C53 104 55 112 55 121', 'M62 100 C70 104 76 110 80 121'],
  },
}

export default function Camee({ faction, taille = 150, className = '', style }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const c = COIFFES[faction] || COIFFES.rome
  const ivoire = `url(#${id}i)`
  const ombre = '#b59f84'
  return (
    <svg viewBox="-8 -8 116 136" width={taille} height={taille * 136 / 116} className={className} style={style} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}s`} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#9a4a36" /><stop offset="0.55" stopColor="#6a2c1f" /><stop offset="1" stopColor="#38140d" />
        </radialGradient>
        <linearGradient id={`${id}i`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#fbf3e2" /><stop offset="0.6" stopColor="#eadcc2" /><stop offset="1" stopColor="#cdb896" />
        </linearGradient>
        <linearGradient id={`${id}o`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#fff0bd" /><stop offset="0.3" stopColor="#e7bd5c" /><stop offset="0.7" stopColor="#a87a28" /><stop offset="1" stopColor="#6e4b14" />
        </linearGradient>
        <filter id={`${id}r`} x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="1.2" dy="1.6" stdDeviation="1" floodColor="#1a0603" floodOpacity="0.65" />
        </filter>
        <clipPath id={`${id}c`}><ellipse cx="50" cy="60" rx="44" ry="56" /></clipPath>
      </defs>
      {/* Monture d'or perlée */}
      <ellipse cx="50" cy="60" rx="53" ry="65" fill={`url(#${id}o)`} />
      <ellipse cx="50" cy="60" rx="50.5" ry="62.5" fill="none" stroke="#5a3c0e" strokeWidth="0.8" />
      {Array.from({ length: 44 }, (_, i) => {
        const a = (i / 44) * Math.PI * 2
        return <circle key={i} cx={50 + Math.cos(a) * 49} cy={60 + Math.sin(a) * 61} r="1.5" fill="#fbe6a6" stroke="#7a5418" strokeWidth="0.4" />
      })}
      <ellipse cx="50" cy="60" rx="46" ry="58" fill="#4a300c" />
      {/* Sardoine */}
      <ellipse cx="50" cy="60" rx="44" ry="56" fill={`url(#${id}s)`} />
      <g clipPath={`url(#${id}c)`}>
        <g filter={`url(#${id}r)`}>
          <path d={BUSTE} fill={ivoire} />
          {(c.derriere || []).map((d, i) => <path key={'d' + i} d={d} fill={ivoire} stroke={ombre} strokeWidth="0.6" />)}
          <path d={PROFIL} fill={ivoire} />
          {(c.devant || []).map((d, i) => <path key={'v' + i} d={d} fill={ivoire} stroke={ombre} strokeWidth="0.6" />)}
        </g>
        {/* Gravure : traits du visage, mèches et plis */}
        <g fill="none" stroke={ombre} strokeWidth="0.85" strokeLinecap="round">
          {VISAGE.map((d, i) => <path key={'f' + i} d={d} />)}
          {c.oreille && OREILLE.map((d, i) => <path key={'o' + i} d={d} />)}
          {c.traits.map((d, i) => <path key={'t' + i} d={d} />)}
          {c.drape.map((d, i) => <path key={'p' + i} d={d} />)}
        </g>
        <path d={OEIL} fill={ombre} />
        {c.laurier && Array.from({ length: 9 }, (_, i) => {
          const u = i / 8
          // le long d'une courbe du front (66,31) à la nuque (30,50)
          const x = (1 - u) * (1 - u) * 66 + 2 * u * (1 - u) * 44 + u * u * 29
          const y = (1 - u) * (1 - u) * 31 + 2 * u * (1 - u) * 22 + u * u * 50
          const a = Math.atan2(2 * (1 - u) * (22 - 31) + 2 * u * (50 - 22), 2 * (1 - u) * (44 - 66) + 2 * u * (29 - 44)) * 180 / Math.PI
          return <g key={i}>
            <ellipse cx={x} cy={y - 2.2} rx="3.6" ry="1.5" transform={`rotate(${a + 35} ${x} ${y - 2.2})`} fill={ivoire} stroke={ombre} strokeWidth="0.5" />
            <ellipse cx={x} cy={y + 2.2} rx="3.6" ry="1.5" transform={`rotate(${a - 35} ${x} ${y + 2.2})`} fill={ivoire} stroke={ombre} strokeWidth="0.5" />
          </g>
        })}
      </g>
      {/* Reflet sur la pierre */}
      <ellipse cx="34" cy="26" rx="14" ry="7" transform="rotate(-25 34 26)" fill="#fff" opacity="0.08" />
    </svg>
  )
}
