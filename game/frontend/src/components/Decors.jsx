// DÉCORS ILLUSTRÉS des menus (SVG fait main, aucune image externe) :
// panorama antique au crépuscule, bannières héraldiques, ornements.
import Embleme from './Emblemes'

// ------------------------------------------------------------------ panorama
// Étoiles réparties au hasard (graine fixe : le ciel ne change pas d'un rendu à l'autre).
const POUSSIERE = (() => {
  let s = 777
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  return Array.from({ length: 34 }, () => [700 + r() * 800, 420 + r() * 380, 0.8 + r() * 1.6, r() * 14])
})()
const ETOILES = (() => {
  let s = 12345
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  return Array.from({ length: 70 }, () => [r() * 1600, Math.pow(r(), 1.6) * 330, r() < 0.15 ? 1.5 : 0.8, 0.2 + r() * 0.6])
})()

// Un promontoire et son temple au soleil couchant, la mer, des trirèmes, des
// cyprès. Pleine page (preserveAspectRatio slice) ; quelques éléments s'animent
// doucement (nuages, navires, reflets, oiseaux).
export function PanoramaAntique({ className = '' }) {
  const colonnes = Array.from({ length: 8 }, (_, i) => 236 + i * 30)
  const reflets = Array.from({ length: 22 }, (_, i) => ({ y: 618 + i * 12, w: 150 - i * 5 + (i % 3) * 14, d: (i % 5) * 0.4 }))
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true"
         className={'pointer-events-none absolute inset-0 h-full w-full ' + className}>
      <defs>
        <linearGradient id="pa-ciel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1628" />
          <stop offset="0.32" stopColor="#25304f" />
          <stop offset="0.52" stopColor="#6a4552" />
          <stop offset="0.64" stopColor="#c27548" />
          <stop offset="0.7" stopColor="#efb46a" />
        </linearGradient>
        <radialGradient id="pa-soleil" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff6d8" />
          <stop offset="0.35" stopColor="#ffd98c" />
          <stop offset="1" stopColor="#f2a24e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pa-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffcf86" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffcf86" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pa-mer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7b5a5e" />
          <stop offset="0.25" stopColor="#3d3a52" />
          <stop offset="1" stopColor="#141726" />
        </linearGradient>
        <linearGradient id="pa-falaise" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#120d09" />
          <stop offset="0.85" stopColor="#2a1c14" />
          <stop offset="1" stopColor="#5a3424" />
        </linearGradient>
        <linearGradient id="pa-colonne" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1c140f" />
          <stop offset="0.7" stopColor="#2c2018" />
          <stop offset="1" stopColor="#c98a4e" />
        </linearGradient>
        <linearGradient id="pa-voile" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3a2a22" />
          <stop offset="1" stopColor="#d79a5c" />
        </linearGradient>
        <filter id="pa-flou" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <style>{`
        @keyframes pa-derive { from { transform: translateX(-60px) } to { transform: translateX(60px) } }
        @keyframes pa-houle { 0%,100% { transform: translateY(0) rotate(-0.6deg) } 50% { transform: translateY(3px) rotate(0.6deg) } }
        @keyframes pa-scintille { 0%,100% { opacity: .25 } 50% { opacity: .85 } }
        @keyframes pa-vol { from { transform: translate(0,0) } to { transform: translate(-220px,-30px) } }
        .pa-nuage { animation: pa-derive 38s ease-in-out infinite alternate }
        .pa-navire { animation: pa-houle 6s ease-in-out infinite; transform-box: fill-box; transform-origin: center bottom }
        .pa-reflet { animation: pa-scintille 3.2s ease-in-out infinite }
        .pa-oiseaux { animation: pa-vol 40s linear infinite alternate }
        @keyframes pa-flotte { 0% { transform: translate(0,0); opacity: 0 } 15% { opacity: .8 } 85% { opacity: .6 } 100% { transform: translate(-40px,-120px); opacity: 0 } }
        .pa-poussiere circle { animation: pa-flotte 14s ease-in-out infinite; }
        @keyframes pa-respire { 0%,100% { opacity: .45 } 50% { opacity: .65 } }
        .pa-rais { animation: pa-respire 9s ease-in-out infinite }
      `}</style>

      {/* Ciel, étoiles, soleil */}
      <rect width="1600" height="900" fill="url(#pa-ciel)" />
      {ETOILES.map(([x, y, r, o], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fff8e6" opacity={o} />)}
      <mask id="pa-rais-masque"><rect width="1600" height="900" fill="url(#pa-rais-fondu)" /></mask>
      <radialGradient id="pa-rais-fondu" cx="1080" cy="552" r="720" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#fff" stopOpacity="1" /><stop offset="0.55" stopColor="#fff" stopOpacity="0.45" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <g className="pa-rais" opacity="0.5" mask="url(#pa-rais-masque)">
        {Array.from({ length: 9 }, (_, i) => {
          const a = (-170 + i * 20) * (Math.PI / 180)
          return <path key={i} d={`M1080 552 L${1080 + Math.cos(a - 0.035) * 900} ${552 + Math.sin(a - 0.035) * 900} L${1080 + Math.cos(a + 0.035) * 900} ${552 + Math.sin(a + 0.035) * 900}Z`} fill="#ffdca0" opacity={0.05 + (i % 3) * 0.015} />
        })}
      </g>
      <circle cx="1080" cy="560" r="280" fill="url(#pa-halo)" />
      <circle cx="1080" cy="552" r="62" fill="url(#pa-soleil)" />

      {/* Nuages */}
      <g className="pa-nuage" opacity="0.75">
        <path d="M720 430 q60 -22 140 -8 q70 -18 150 4 q-60 14 -140 10 q-80 8 -150 -6z" fill="#e7a66a" opacity="0.55" />
        <path d="M1150 470 q70 -16 150 -2 q60 -12 120 6 q-70 10 -140 6 q-70 6 -130 -10z" fill="#d98e5c" opacity="0.5" />
        <path d="M300 360 q80 -20 170 -6 q50 -10 110 4 q-80 12 -160 8 q-60 4 -120 -6z" fill="#8f5d63" opacity="0.6" />
      </g>

      {/* Oiseaux */}
      <g className="pa-oiseaux" stroke="#1b1420" strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M1240 330 q8 -7 16 0 q8 -7 16 0" /><path d="M1290 350 q6 -5 12 0 q6 -5 12 0" /><path d="M1210 362 q5 -4 10 0 q5 -4 10 0" />
      </g>

      {/* Montagnes lointaines (brume) */}
      <path d="M560 610 L680 540 L760 572 L860 516 L960 566 L1040 540 L1160 590 L1290 532 L1420 586 L1600 548 L1600 640 L560 640Z" fill="#7a5161" opacity="0.55" />
      <path d="M760 630 L880 578 L980 604 L1100 570 L1230 612 L1360 584 L1600 616 L1600 650 L760 650Z" fill="#4c3446" opacity="0.8" />

      {/* Mer + reflets du soleil */}
      <rect x="0" y="606" width="1600" height="294" fill="url(#pa-mer)" />
      {reflets.map((r, i) => (
        <rect key={i} className="pa-reflet" style={{ animationDelay: `${r.d}s` }}
              x={1080 - r.w / 2 + ((i * 37) % 30) - 15} y={r.y} width={r.w} height="2.4" rx="1.2" fill="#ffd38a" opacity="0.6" />
      ))}
      {Array.from({ length: 26 }, (_, i) => (
        <path key={i} d={`M${(i * 211) % 1500 + 40} ${650 + (i * 47) % 230} q14 -5 28 0`} stroke="#c59a86" strokeOpacity="0.18" strokeWidth="1.6" fill="none" />
      ))}

      {/* Cité côtière sur la colline de droite, et son phare */}
      <path d="M1180 640 Q1260 560 1360 590 Q1440 600 1520 640Z" fill="#3a2c3c" />
      <g fill="#5a4652">
        {[[1250, 600, 26, 22], [1280, 590, 22, 30], [1308, 596, 30, 24], [1342, 600, 24, 20], [1370, 606, 28, 18], [1230, 614, 22, 16]].map(([x, y, w, h], i) => (
          <g key={i}><rect x={x} y={y} width={w} height={h} /><rect x={x + w * 0.6} y={y} width={w * 0.4} height={h} fill="#46364a" /></g>
        ))}
      </g>
      <g fill="#e7a35e" opacity="0.85">{[[1256, 606], [1286, 600], [1316, 604], [1348, 608], [1376, 612]].map(([x, y], i) => <rect key={i} x={x} y={y} width="4" height="5" />)}</g>
      <rect x="1446" y="560" width="14" height="60" fill="#4a3a48" /><rect x="1453" y="560" width="7" height="60" fill="#3a2c3a" />
      <circle cx="1453" cy="554" r="7" fill="#ffd27a" className="pa-reflet" /><circle cx="1453" cy="554" r="22" fill="#ffd27a" opacity="0.18" />

      {/* Île et cité lointaine à droite */}
      <path d="M1330 612 q40 -26 90 -24 q60 2 100 24z" fill="#2b2030" />
      <g fill="#2b2030">
        <rect x="1392" y="572" width="6" height="22" /><rect x="1404" y="566" width="22" height="26" /><path d="M1400 566 l15 -10 l15 10z" />
        <rect x="1440" y="580" width="8" height="14" />
      </g>

      {/* Trirèmes */}
      <g className="pa-navire" style={{ animationDelay: '0s' }}>
        <Trireme x={760} y={712} k={1} />
      </g>
      <g className="pa-navire" style={{ animationDelay: '-2.5s' }}>
        <Trireme x={1290} y={668} k={0.55} />
      </g>

      {/* Promontoire et temple (gauche) */}
      <path d="M0 900 L0 520 L90 500 L200 492 L560 494 L600 520 L640 560 L668 612 L700 680 L720 760 L760 900Z" fill="url(#pa-falaise)" />
      <path d="M560 494 L600 520 L640 560 L668 612 L700 680 L720 760" stroke="#b5703f" strokeOpacity="0.5" strokeWidth="2.5" fill="none" />
      <g>
        <rect x="214" y="478" width="280" height="16" fill="#1d1510" />
        <rect x="222" y="468" width="264" height="12" fill="#241a12" />
        {colonnes.map((x) => <rect key={x} x={x} y="372" width="15" height="98" fill="url(#pa-colonne)" />)}
        <rect x="226" y="358" width="256" height="16" fill="#241a12" />
        <rect x="226" y="358" width="256" height="2.5" fill="#d99659" opacity="0.7" />
        <path d="M220 358 L354 304 L488 358Z" fill="#1d1510" />
        <path d="M354 304 L488 358" stroke="#e3a160" strokeWidth="2.5" strokeOpacity="0.8" />
        <circle cx="354" cy="300" r="3" fill="#e8c267" />
      </g>
      {/* Cyprès */}
      {[[120, 498, 1], [150, 500, 0.8], [548, 500, 0.9], [586, 516, 0.7]].map(([x, y, k], i) => (
        <path key={i} d={`M${x} ${y} q${-10 * k} ${-40 * k} 0 ${-110 * k} q${10 * k} ${70 * k} 0 ${110 * k}z`} fill="#0e1410" />
      ))}

      {/* Poussière d'or qui flotte dans la lumière */}
      <g className="pa-poussiere">
        {POUSSIERE.map(([x, y, r, d], i) => <circle key={i} cx={x} cy={y} r={r} fill="#ffe3a8" style={{ animationDelay: `${d}s` }} />)}
      </g>

      {/* Premier plan */}
      <path d="M760 900 L780 860 L860 842 L960 856 L1060 834 L1180 852 L1320 828 L1460 846 L1600 830 L1600 900Z" fill="#0b0a0d" />
      <g stroke="#0b0a0d" strokeWidth="3" strokeLinecap="round">
        {Array.from({ length: 18 }, (_, i) => <path key={i} d={`M${800 + i * 44} ${852 - (i % 3) * 6} l${(i % 2 ? 6 : -6)} -22`} />)}
      </g>
    </svg>
  )
}

function Trireme({ x, y, k }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <path d="M-120 0 Q-60 26 70 18 L120 -6 Q130 -12 136 -24 L118 -8 Q90 6 60 4 L-110 -6 Z" fill="#120f14" />
      <path d="M-126 -8 q-6 -18 6 -26" stroke="#120f14" strokeWidth="5" fill="none" />
      {Array.from({ length: 11 }, (_, i) => <path key={i} d={`M${-90 + i * 16} 6 l-10 22`} stroke="#120f14" strokeWidth="2.2" />)}
      <path d="M-8 -6 L-8 -118" stroke="#120f14" strokeWidth="4" />
      <path d="M-60 -106 Q-8 -96 44 -106 L40 -36 Q-8 -28 -56 -36 Z" fill="url(#pa-voile)" />
      <path d="M-60 -106 L44 -106" stroke="#120f14" strokeWidth="3" />
      <path d="M-8 -118 l22 -6 l-22 -6" fill="#8e1f16" />
    </g>
  )
}

// ------------------------------------------------------------------ bannière
// Bannière héraldique : hampe dorée, étoffe à queue d'aronde aux couleurs du
// royaume, plis, galon et frange, emblème brodé d'or.
export function Banniere({ faction, couleur, className = '', style }) {
  const id = `ban-${faction}`
  return (
    <svg viewBox="0 0 120 170" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-plis`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.32" />
          <stop offset="0.2" stopColor="#fff" stopOpacity="0.10" />
          <stop offset="0.38" stopColor="#000" stopOpacity="0.18" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0.12" />
          <stop offset="0.8" stopColor="#000" stopOpacity="0.2" />
          <stop offset="1" stopColor="#000" stopOpacity="0.38" />
        </linearGradient>
        <linearGradient id={`${id}-or`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6dc94" />
          <stop offset="0.5" stopColor="#c99a3a" />
          <stop offset="1" stopColor="#8a6420" />
        </linearGradient>
      </defs>
      {/* Hampe et fleurons */}
      <rect x="10" y="12" width="100" height="5" rx="2.5" fill={`url(#${id}-or)`} stroke="#3a2a12" strokeWidth="0.8" />
      <circle cx="9" cy="14.5" r="5" fill={`url(#${id}-or)`} stroke="#3a2a12" strokeWidth="0.8" />
      <circle cx="111" cy="14.5" r="5" fill={`url(#${id}-or)`} stroke="#3a2a12" strokeWidth="0.8" />
      <path d="M55 12 L60 2 L65 12" fill={`url(#${id}-or)`} stroke="#3a2a12" strokeWidth="0.8" />
      {/* Étoffe */}
      <path d="M18 17 H102 V146 L60 126 L18 146 Z" fill={couleur} />
      <path d="M18 17 H102 V146 L60 126 L18 146 Z" fill={`url(#${id}-plis)`} />
      <path d="M24 22 H96 V137 L60 119 L24 137 Z" fill="none" stroke={`url(#${id}-or)`} strokeWidth="1.6" />
      <path d="M18 17 H102 V146 L60 126 L18 146 Z" fill="none" stroke="#1d140a" strokeWidth="1.2" />
      {/* Frange */}
      {Array.from({ length: 11 }, (_, i) => {
        const x = 18 + i * 4.2
        return <path key={'g' + i} d={`M${x} ${146 - (i * 20) / 10.5} l0 7`} stroke="#c99a3a" strokeWidth="1.3" />
      })}
      {Array.from({ length: 11 }, (_, i) => {
        const x = 60 + i * 4.2
        return <path key={'d' + i} d={`M${x} ${126 + (i * 20) / 10.5} l0 7`} stroke="#c99a3a" strokeWidth="1.3" />
      })}
      {/* Emblème brodé */}
      <circle cx="60" cy="70" r="28" fill="#000" opacity="0.16" />
      <circle cx="60" cy="70" r="28" fill="none" stroke={`url(#${id}-or)`} strokeWidth="1.2" />
      <Embleme faction={faction} variante="or" taille={50} x={35} y={45} />
    </svg>
  )
}

// ------------------------------------------------------------------ ornements
// Filet orné : losange central, rinceaux, perles.
export function Filet({ className = '', largeur = 320 }) {
  return (
    <svg viewBox="0 0 320 24" width={largeur} height={(largeur * 24) / 320} className={className} aria-hidden="true">
      <path d="M10 12 H130 M190 12 H310" stroke="#c9a13b" strokeWidth="1" />
      <path d="M130 12 q12 -10 24 0 q-12 10 -24 0z M166 12 q12 -10 24 0 q-12 10 -24 0z" fill="none" stroke="#c9a13b" strokeWidth="1" />
      <path d="M160 3 L169 12 L160 21 L151 12Z" fill="#e8c267" stroke="#7a5d1f" strokeWidth="0.8" />
      {[30, 60, 90, 230, 260, 290].map((x) => <circle key={x} cx={x} cy="12" r="1.6" fill="#e8c267" />)}
    </svg>
  )
}

// Couronne de laurier (sous le titre) : feuilles posées le long de deux rameaux.
export function Laurier({ className = '', largeur = 140 }) {
  const rameau = (P2) => {
    const P0 = [70, 54], P1 = [70 + (P2[0] - 70) * 0.55, 54]
    return Array.from({ length: 9 }, (_, i) => {
      const t = 0.12 + i * 0.1, u = 1 - t
      const x = u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0]
      const y = u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1]
      const dx = 2 * u * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]), dy = 2 * u * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1])
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI
      const cote = i % 2 ? 1 : -1, n = Math.hypot(dx, dy) || 1
      const fx = x + (-dy / n) * 4 * cote, fy = y + (dx / n) * 4 * cote
      return <ellipse key={P2[0] + '-' + i} cx={fx} cy={fy} rx="6.5" ry="2.6" transform={`rotate(${ang + cote * 28} ${fx} ${fy})`}
                      fill="#c9a13b" stroke="#7a5d1f" strokeWidth="0.5" />
    })
  }
  return (
    <svg viewBox="0 0 140 62" width={largeur} height={(largeur * 62) / 140} className={className} aria-hidden="true">
      <path d="M70 54 Q42 54 20 14" stroke="#7a5d1f" strokeWidth="1.2" fill="none" />
      <path d="M70 54 Q98 54 120 14" stroke="#7a5d1f" strokeWidth="1.2" fill="none" />
      {rameau([20, 14])}{rameau([120, 14])}
      <circle cx="70" cy="54" r="3" fill="#e8c267" stroke="#7a5d1f" strokeWidth="0.6" />
    </svg>
  )
}
