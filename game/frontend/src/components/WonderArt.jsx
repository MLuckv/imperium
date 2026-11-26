import { useId } from 'react'

// ILLUSTRATIONS DES MERVEILLES — style « affiche de voyage » : aucun contour,
// des plans de lumière et d'ombre, un ciel en dégradé, des reliefs étagés dans la
// brume, des reflets, un grain léger et une vignette. viewBox 200 × 128.

// ------------------------------------------------------------------ boîte à outils
function Scene({ ciel, soleil, children, size = 200, className, style, nuit = false }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg viewBox="0 0 200 128" width={size} height={size * 0.64} className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="1">
          {ciel.map((c, i) => <stop key={i} offset={i / (ciel.length - 1)} stopColor={c} />)}
        </linearGradient>
        <radialGradient id={`${id}h`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={soleil ? soleil.c : '#fff'} stopOpacity="0.75" />
          <stop offset="1" stopColor={soleil ? soleil.c : '#fff'} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}v`} cx="0.5" cy="0.48" r="0.7">
          <stop offset="0.6" stopColor="#120a04" stopOpacity="0" /><stop offset="1" stopColor="#120a04" stopOpacity={nuit ? 0.7 : 0.5} />
        </radialGradient>
        <filter id={`${id}g`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" result="b" />
          <feColorMatrix in="b" type="saturate" values="0" />
          <feComponentTransfer><feFuncA type="table" tableValues="0 0.16" /></feComponentTransfer>
        </filter>
        <clipPath id={`${id}k`}><rect width="200" height="128" rx="5" /></clipPath>
      </defs>
      <g clipPath={`url(#${id}k)`}>
        <rect width="200" height="128" fill={`url(#${id}c)`} />
        {soleil && <circle cx={soleil.x} cy={soleil.y} r={soleil.r * 3.2} fill={`url(#${id}h)`} />}
        {soleil && <circle cx={soleil.x} cy={soleil.y} r={soleil.r} fill={soleil.c} />}
        {children}
        <rect width="200" height="128" filter={`url(#${id}g)`} style={{ mixBlendMode: 'multiply' }} />
        <rect width="200" height="128" fill={`url(#${id}v)`} />
      </g>
      <rect x="1" y="1" width="198" height="126" rx="4.5" fill="none" stroke="#e8c267" strokeOpacity="0.55" strokeWidth="1.2" />
    </svg>
  )
}
// Colonnes : fût éclairé à gauche, ombré à droite, chapiteau et base.
function Colonnes({ x, y, n, w = 5, h = 30, ecart = 4, lum, omb, cap }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const cx = x + i * (w + ecart)
        return (
          <g key={i}>
            <rect x={cx} y={y} width={w} height={h} fill={lum} />
            <rect x={cx + w * 0.55} y={y} width={w * 0.45} height={h} fill={omb} />
            <rect x={cx - 0.8} y={y - 1.6} width={w + 1.6} height="1.8" fill={cap || lum} />
          </g>
        )
      })}
    </g>
  )
}
function Gens({ pts, c = '#2a1a10', k = 1 }) {
  return (
    <g fill={c}>
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y - 5.4 * k} r={1.1 * k} />
          <path d={`M${x - 1.2 * k} ${y} L${x - 0.8 * k} ${y - 4.4 * k} L${x + 0.8 * k} ${y - 4.4 * k} L${x + 1.2 * k} ${y}Z`} />
        </g>
      ))}
    </g>
  )
}
function Cypres({ x, y, h = 22, c = '#23301c' }) {
  return <path d={`M${x} ${y} C${x - h * 0.16} ${y - h * 0.4} ${x - h * 0.12} ${y - h * 0.85} ${x} ${y - h} C${x + h * 0.12} ${y - h * 0.85} ${x + h * 0.16} ${y - h * 0.4} ${x} ${y}Z`} fill={c} />
}
function Palmier({ x, y, h = 24, c = '#2a2a18' }) {
  const t = [x + 2, y - h]
  return (
    <g fill={c}>
      <path d={`M${x} ${y} Q${x + 3} ${y - h * 0.5} ${t[0]} ${t[1]}`} stroke={c} strokeWidth="1.4" fill="none" />
      {[-150, -110, -60, -20, 20].map((a) => {
        const r = (a * Math.PI) / 180
        return <path key={a} d={`M${t[0]} ${t[1]} Q${t[0] + Math.cos(r) * 7} ${t[1] + Math.sin(r) * 7 - 3} ${t[0] + Math.cos(r) * 12} ${t[1] + Math.sin(r) * 12 + 3} Q${t[0] + Math.cos(r) * 6} ${t[1] + Math.sin(r) * 6} ${t[0]} ${t[1]}Z`} />
      })}
    </g>
  )
}
function Reflets({ y0, x, largeur, c, n = 7 }) {
  return (
    <g fill={c}>
      {Array.from({ length: n }, (_, i) => <rect key={i} x={x - (largeur * (1 - i / (n + 2))) / 2 + ((i * 7) % 5) - 2} y={y0 + i * 3.4} width={largeur * (1 - i / (n + 2))} height="1.2" rx="0.6" opacity={0.85 - i * 0.08} />)}
    </g>
  )
}
function Oiseaux({ pts, c = '#2a1a22' }) {
  return <g stroke={c} strokeWidth="0.9" fill="none" strokeLinecap="round">{pts.map(([x, y], i) => <path key={i} d={`M${x - 3} ${y} q1.5 -1.6 3 0 q1.5 -1.6 3 0`} />)}</g>
}

// ------------------------------------------------------------------ merveilles
function Parthenon(p) {
  return (
    <Scene {...p} ciel={['#f6c98d', '#f3b07a', '#e38f6a']} soleil={{ x: 158, y: 50, r: 11, c: '#fff1cf' }}>
      <path d="M0 92 Q40 80 80 86 Q130 74 200 84 V128 H0Z" fill="#c98a66" opacity="0.6" />
      <path d="M18 128 L30 98 L60 86 L148 84 L172 96 L186 128Z" fill="#8a5a44" />
      <path d="M30 98 L60 86 L148 84 L156 90 L64 92Z" fill="#a66e50" />
      <rect x="52" y="78" width="98" height="8" fill="#f3dfc0" /><rect x="52" y="83" width="98" height="3" fill="#d8b892" />
      <Colonnes x={56} y={54} n={8} w={7} h={24} ecart={5.3} lum="#f6e6c8" omb="#d4b48c" />
      <rect x="52" y="45" width="98" height="8" fill="#f3dfc0" /><rect x="52" y="50" width="98" height="3" fill="#cfae86" />
      <path d="M50 45 L101 30 L152 45Z" fill="#f6e6c8" /><path d="M101 30 L152 45 L101 45Z" fill="#dcbf98" />
      <rect x="52" y="52.6" width="98" height="2" fill="#7a5038" opacity="0.4" />
      <Cypres x={30} y={100} h={30} c="#3d3a26" /><Cypres x={38} y={98} h={22} c="#4a462e" /><Cypres x={176} y={104} h={26} c="#3d3a26" />
      <Gens pts={[[80, 86], [86, 86], [120, 85]]} c="#5a3626" k={0.9} />
      <Oiseaux pts={[[120, 24], [128, 20], [134, 26]]} c="#7a4a3a" />
    </Scene>
  )
}
function Stonehenge(p) {
  const pierres = [[20, 70, 8, 30], [36, 66, 8, 34], [58, 62, 9, 38], [76, 62, 9, 38], [124, 62, 9, 38], [142, 62, 9, 38], [164, 66, 8, 34], [180, 70, 8, 30]]
  return (
    <Scene {...p} ciel={['#4a3c66', '#a7698a', '#f2a77a', '#f8d6a0']} soleil={{ x: 100, y: 84, r: 13, c: '#fff4d2' }}>
      <rect y="96" width="200" height="32" fill="#4d5a3a" />
      <path d="M0 96 Q60 90 100 94 Q150 98 200 92 V100 H0Z" fill="#6b7a4e" />
      {pierres.map(([x, y, w, h], i) => (
        <g key={i}>
          <path d={`M${x + w / 2} 100 L${100 + (x - 100) * 1.8} 128 L${100 + (x + w - 100) * 1.8} 128 L${x + w} 100Z`} fill="#2a3020" opacity="0.45" />
          <rect x={x} y={y} width={w} height={h} rx="1.4" fill="#4a4652" /><rect x={x} y={y} width={w * 0.3} height={h} rx="1.2" fill="#6e6874" />
        </g>
      ))}
      <rect x="54" y="57" width="34" height="7" rx="1.4" fill="#4a4652" /><rect x="54" y="57" width="34" height="2" fill="#6e6874" />
      <rect x="120" y="57" width="34" height="7" rx="1.4" fill="#4a4652" /><rect x="120" y="57" width="34" height="2" fill="#6e6874" />
      <rect x="16" y="65" width="30" height="6" rx="1.4" fill="#4a4652" /><rect x="160" y="65" width="30" height="6" rx="1.4" fill="#4a4652" />
      <rect y="88" width="200" height="6" fill="#f8d6a0" opacity="0.25" />
      <Gens pts={[[104, 100]]} c="#2a2232" k={1.1} />
    </Scene>
  )
}
function Pyramides(p) {
  return (
    <Scene {...p} ciel={['#f0a35a', '#f5bf74', '#f8dc9a']} soleil={{ x: 150, y: 40, r: 14, c: '#fff6da' }}>
      <path d="M0 98 Q50 90 100 96 Q150 90 200 96 V128 H0Z" fill="#e3b56e" />
      <path d="M96 98 L132 50 L170 98Z" fill="#e7b46a" /><path d="M132 50 L170 98 L144 98Z" fill="#b97c42" />
      <path d="M20 100 L72 30 L126 100Z" fill="#f0c27a" /><path d="M72 30 L126 100 L90 100Z" fill="#c5884a" />
      <path d="M72 30 L76 35 L70 35Z" fill="#fff1d0" opacity="0.8" />
      <path d="M150 100 L170 74 L190 100Z" fill="#e7b46a" /><path d="M170 74 L190 100 L178 100Z" fill="#b97c42" />
      <path d="M0 112 Q40 102 90 110 Q140 118 200 106 V128 H0Z" fill="#d9a35c" />
      <path d="M0 120 Q60 112 120 122 Q160 126 200 118 V128 H0Z" fill="#c48d4c" />
      <g fill="#4a2e1a">
        {[[30, 108], [42, 107], [54, 108]].map(([x, y], i) => <path key={i} d={`M${x} ${y} h8 l1 -4 c0 -2 -2 -3 -3 -2 l-1 -3 l-2 0 l0 3 h-3 l-1 -2 l-1 0 l0 4z M${x + 1} ${y} v3 M${x + 7} ${y} v3`} />)}
      </g>
      <Palmier x={184} y={112} h={26} c="#4a3a1e" /><Palmier x={10} y={114} h={22} c="#4a3a1e" />
    </Scene>
  )
}
function Broceliande(p) {
  return (
    <Scene {...p} ciel={['#2c4a46', '#5f8a74', '#b9d0a0']}>
      {[0, 1, 2].map((k) => <path key={k} d={`M${60 + k * 30} 0 L${30 + k * 34} 128 L${50 + k * 34} 128 L${78 + k * 30} 0Z`} fill="#f4f0c2" opacity={0.09 + k * 0.02} />)}
      <path d="M0 70 Q30 52 60 64 Q90 46 120 60 Q160 44 200 58 V128 H0Z" fill="#3e6650" opacity="0.7" />
      {[[16, 92, 34], [44, 96, 40], [150, 94, 38], [182, 98, 44]].map(([x, y, h], i) => (
        <g key={i}>
          <rect x={x - 2} y={y - h * 0.5} width="4" height={h * 0.5} fill="#2a2a1c" />
          <circle cx={x} cy={y - h * 0.62} r={h * 0.34} fill="#24402e" /><circle cx={x - h * 0.16} cy={y - h * 0.72} r={h * 0.2} fill="#2f5038" />
        </g>
      ))}
      <path d="M0 100 Q60 92 100 98 Q150 104 200 96 V128 H0Z" fill="#203826" />
      <ellipse cx="100" cy="108" rx="40" ry="7" fill="#9fc8bc" /><ellipse cx="100" cy="108" rx="40" ry="7" fill="#e8f2c8" opacity="0.25" />
      <Reflets y0={105} x={100} largeur={30} c="#f4f0c2" n={3} />
      <path d="M86 102 l-2 -10 l3 0 l2 10z" fill="#5a5a48" /><path d="M84 92 l4 -1 l0 -2 l-4 1z" fill="#c9d8c0" />
      {[[70, 60], [128, 52], [110, 74], [60, 84], [146, 80], [92, 46]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1" fill="#f8f2a8" opacity="0.9" />)}
      <rect y="86" width="200" height="10" fill="#d8e8c8" opacity="0.18" />
    </Scene>
  )
}
function Vesuve(p) {
  return (
    <Scene {...p} ciel={['#3a2c4a', '#8a4a52', '#e2875a', '#f3b67a']}>
      <path d="M100 30 C80 22 84 10 98 12 C104 2 122 6 122 16 C134 14 138 26 128 30 C126 38 108 38 100 30Z" fill="#6a5a66" opacity="0.85" />
      <path d="M104 36 C98 30 104 24 110 28 C114 22 122 28 118 34Z" fill="#a4706a" />
      <path d="M30 96 L92 38 L112 38 L176 96Z" fill="#4a3236" /><path d="M102 38 L112 38 L176 96 L126 96Z" fill="#33222a" />
      <path d="M92 38 L112 38 L108 42 L96 42Z" fill="#e8743e" /><path d="M102 42 Q98 60 92 72" stroke="#d05a2e" strokeWidth="1.6" fill="none" opacity="0.8" />
      <path d="M0 96 Q60 90 120 94 Q160 96 200 92 V100 H0Z" fill="#5a4a3a" />
      <g fill="#e8c890">{[[40, 93], [48, 92], [56, 93], [150, 92], [158, 93]].map(([x, y], i) => <rect key={i} x={x} y={y - 3} width="5" height="3" />)}</g>
      <rect y="98" width="200" height="30" fill="#3c3446" /><Reflets y0={100} x={104} largeur={50} c="#e8875a" n={8} />
      <path d="M150 112 l20 0 l-3 4 l-14 0z M160 112 v-10 l8 8z" fill="#1e1822" />
    </Scene>
  )
}
function Compostelle(p) {
  return (
    <Scene {...p} ciel={['#e9b77c', '#f2cf96', '#fae6bd']} soleil={{ x: 38, y: 40, r: 10, c: '#fff4d8' }}>
      <rect y="100" width="200" height="28" fill="#b38a62" />
      <path d="M60 128 L90 100 L110 100 L140 128Z" fill="#cfa77a" />
      <rect x="64" y="46" width="72" height="54" fill="#e6c79a" /><rect x="100" y="46" width="36" height="54" fill="#c9a274" />
      {[[60, 16], [120, 16]].map(([x], i) => (
        <g key={i}>
          <rect x={x} y="24" width="20" height="76" fill={i ? '#c9a274' : '#ecd0a6'} />
          <rect x={x + 3} y="14" width="14" height="10" fill={i ? '#bb946a' : '#e6c79a'} /><path d={`M${x + 3} 14 L${x + 10} 2 L${x + 17} 14Z`} fill={i ? '#a67e56' : '#d9b688'} />
          <path d={`M${x + 6} 40 v-6 a4 4 0 0 1 8 0 v6z M${x + 6} 62 v-6 a4 4 0 0 1 8 0 v6z`} fill="#5a3a26" />
        </g>
      ))}
      <path d="M90 100 v-20 a10 10 0 0 1 20 0 v20z" fill="#4a2e1e" />
      <path d="M100 58 l-6 -7 q6 -4 12 0z" fill="#f6e0b0" /><path d="M86 46 L100 34 L114 46Z" fill="#d9b688" />
      <Gens pts={[[70, 118], [80, 114], [140, 120]]} c="#4a2e1e" k={1.3} />
      <path d="M72 118 v-9 M82 114 v-9" stroke="#4a2e1e" strokeWidth="0.8" />
    </Scene>
  )
}
function PortaNigra(p) {
  return (
    <Scene {...p} ciel={['#28304a', '#59587a', '#c48a7a']} nuit>
      <rect y="100" width="200" height="28" fill="#2a2420" />
      {[[30, 38], [134, 30]].map(([x, h], i) => (
        <g key={i}>
          <rect x={x} y={100 - 62} width="36" height="62" fill="#3a3330" /><rect x={x + 22} y={100 - 62} width="14" height="62" fill="#2a2522" />
          {[0, 1, 2, 3].map((r) => [0, 1].map((c) => <path key={r + '-' + c} d={`M${x + 6 + c * 14} ${92 - r * 14} v-6 a3.5 3.5 0 0 1 7 0 v6z`} fill={r === 0 ? '#f2b45a' : '#1a1614'} opacity={r === 0 ? 0.85 : 1} />))}
        </g>
      ))}
      <rect x="66" y="48" width="68" height="52" fill="#342e2b" />
      {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <path key={r + '-' + c} d={`M${72 + c * 15} ${70 - r * 10} v-5 a3.5 3.5 0 0 1 7 0 v5z`} fill={r === 1 && c === 1 ? '#f2b45a' : '#1a1614'} />))}
      <path d="M78 100 v-18 a10 10 0 0 1 20 0 v18z M102 100 v-18 a10 10 0 0 1 20 0 v18z" fill="#f0a855" opacity="0.9" />
      <rect x="30" y="36" width="140" height="3" fill="#4a423e" />
      <Gens pts={[[88, 100], [112, 100], [60, 104]]} c="#140f0c" k={1.2} />
      <circle cx="170" cy="20" r="5" fill="#f4ecd0" />
    </Scene>
  )
}
function Colosse(p) {
  const bronze = '#b8703e', bronzeO = '#7e4626'
  return (
    <Scene {...p} ciel={['#f19a5c', '#f5b778', '#fbd9a4']} soleil={{ x: 100, y: 70, r: 15, c: '#fff4da' }}>
      <rect y="86" width="200" height="42" fill="#574868" /><Reflets y0={88} x={100} largeur={56} c="#ffd49a" n={9} />
      {/* Môles du port et socles */}
      <path d="M0 86 H62 L66 92 H0Z M200 86 H138 L134 92 H200Z" fill="#5a3e34" />
      <rect x="52" y="72" width="22" height="16" fill="#d8b890" /><rect x="64" y="72" width="10" height="16" fill="#a8885e" />
      <rect x="126" y="72" width="22" height="16" fill="#d8b890" /><rect x="138" y="72" width="10" height="16" fill="#a8885e" />
      <g transform="translate(100 72) scale(0.8) translate(-100 -72)">
      {/* Jambes écartées au-dessus de la passe */}
      <path d="M60 72 L68 72 L94 44 L86 42Z" fill={bronze} /><path d="M132 72 L140 72 L114 42 L106 44Z" fill={bronzeO} />
      {/* Torse, pagne, tête radiée */}
      <path d="M86 44 L114 44 L118 22 L82 22Z" fill={bronze} /><path d="M100 44 L114 44 L118 22 L100 22Z" fill={bronzeO} />
      <path d="M85 44 L115 44 L112 50 L88 50Z" fill="#8a5230" />
      <rect x="96" y="17" width="8" height="6" fill={bronzeO} />
      <circle cx="100" cy="12" r="6.2" fill={bronze} /><path d="M100 5.8 A6.2 6.2 0 0 1 100 18.2Z" fill={bronzeO} />
      {[-70, -40, -10, 20, 50].map((a) => { const r = (a * Math.PI) / 180; return <path key={a} d={`M${100 + Math.sin(r) * 6.4} ${12 - Math.cos(r) * 6.4} l${Math.sin(r) * 4.5} ${-Math.cos(r) * 4.5}`} stroke="#f2b46a" strokeWidth="1.6" strokeLinecap="round" /> })}
      {/* Bras levé et flambeau */}
      <path d="M84 24 L78 6 L82 4 L89 22Z" fill={bronze} /><path d="M76 4 L84 2 L82 -2 L78 -1Z" fill="#8a5230" />
      <path d="M80 -1 q-3 -6 1 -10 q1 4 4 4 q1 5 -5 6z" fill="#ffd27a" /><circle cx="80" cy="-4" r="7" fill="#ffd27a" opacity="0.3" />
      <path d="M116 24 L121 42 L117 43 L112 26Z" fill={bronzeO} />
      </g>
      {/* Navire qui passe entre les jambes */}
      <path d="M86 100 h26 l-4 5 h-18z M98 100 v-14 l9 12z" fill="#2a1e28" />
      <Oiseaux pts={[[150, 30], [158, 26]]} c="#7a4a3a" />
    </Scene>
  )
}
function MurHadrien(p) {
  const crete = 'M0 64 Q30 52 54 62 Q80 72 104 58 Q130 44 156 58 Q178 68 200 56'
  return (
    <Scene {...p} ciel={['#8aa0b0', '#b9c6c8', '#dcdcc8']}>
      <path d="M0 50 Q50 34 100 46 Q150 30 200 42 V80 H0Z" fill="#8a9a8a" opacity="0.6" />
      <path d={crete + ' V128 H0Z'} fill="#6a8050" />
      <path d={crete} stroke="#c8bca0" strokeWidth="5" fill="none" />
      <path d={crete} stroke="#a89c80" strokeWidth="2" fill="none" transform="translate(0 2)" />
      <g fill="#b4a88c">{[[54, 62], [104, 58], [156, 58]].map(([x, y], i) => <g key={i}><rect x={x - 6} y={y - 12} width="12" height="12" /><rect x={x} y={y - 12} width="6" height="12" fill="#968a70" /></g>)}</g>
      <path d="M0 96 Q60 84 120 94 Q160 100 200 90 V128 H0Z" fill="#4e6a3c" />
      <Gens pts={[[60, 50], [110, 46]]} c="#3a3a3a" k={0.8} />
      <path d="M0 110 Q50 102 110 112 Q160 118 200 108 V128 H0Z" fill="#3e5a30" />
    </Scene>
  )
}
function PontDuGard(p) {
  const arches = (y, n, w, h, c1, c2) => (
    <g>
      <rect x="0" y={y} width="200" height={h} fill={c1} />
      {Array.from({ length: n }, (_, i) => <path key={i} d={`M${i * w + w * 0.18} ${y + h} v-${h * 0.55} a${w * 0.32} ${w * 0.32} 0 0 1 ${w * 0.64} 0 v${h * 0.55}z`} fill={c2} />)}
    </g>
  )
  return (
    <Scene {...p} ciel={['#9cc4dc', '#cfe0dc', '#f4e8c4']} soleil={{ x: 40, y: 26, r: 9, c: '#fffbe6' }}>
      <path d="M0 70 Q40 56 90 64 Q150 52 200 62 V128 H0Z" fill="#a4b088" opacity="0.7" />
      {arches(30, 18, 11.2, 9, '#e8cc96', '#7e8c6a')}
      {arches(39, 11, 18.4, 22, '#e2c28c', '#6a7a5a')}
      {arches(61, 6, 34, 32, '#dab680', '#5a6a4a')}
      <rect x="0" y="30" width="200" height="2" fill="#f6e4b4" />
      <rect y="92" width="200" height="36" fill="#4a7a7a" /><Reflets y0={95} x={100} largeur={140} c="#d8c48e" n={7} />
      <path d="M0 92 Q20 86 40 92 V128 H0Z M200 90 Q178 84 160 92 V128 H200Z" fill="#6a7a4a" />
    </Scene>
  )
}
function Chersonese(p) {
  return (
    <Scene {...p} ciel={['#5a5a8a', '#c47a7a', '#f2b07a']} soleil={{ x: 150, y: 78, r: 12, c: '#ffe8c0' }}>
      <rect y="84" width="200" height="44" fill="#4a4a6a" /><Reflets y0={86} x={150} largeur={44} c="#ffc890" n={8} />
      <path d="M0 128 V80 Q30 74 70 78 Q100 80 110 92 L120 128Z" fill="#7a5a4a" />
      <path d="M0 82 Q30 76 70 80 L74 86 L0 90Z" fill="#a07a5a" />
      <rect x="14" y="74" width="60" height="5" fill="#e8d4b4" />
      {[[18, 30], [28, 18], [38, 34], [48, 10], [58, 26], [66, 20]].map(([x, h], i) => (
        <g key={i}><rect x={x} y={74 - h} width="5" height={h} fill="#f0e0c4" /><rect x={x + 2.8} y={74 - h} width="2.2" height={h} fill="#cdb898" /><path d={`M${x - 0.5} ${74 - h} l2 -2 l2 1.6 l2 -1.2 v1.6 h-6z`} fill="#f0e0c4" /></g>
      ))}
      <rect x="16" y="42" width="24" height="4" fill="#f0e0c4" transform="rotate(-4 28 44)" />
      <Gens pts={[[90, 86]]} c="#3a2a2a" k={1} />
    </Scene>
  )
}
function Knossos(p) {
  return (
    <Scene {...p} ciel={['#a8c8e0', '#e0d8c0', '#f4e0b8']} soleil={{ x: 30, y: 30, r: 9, c: '#fffbe8' }}>
      <path d="M0 74 Q40 50 90 64 Q140 46 200 62 V128 H0Z" fill="#a0a888" opacity="0.7" />
      <rect y="98" width="200" height="30" fill="#c8a878" />
      <rect x="40" y="62" width="120" height="36" fill="#e8d2a8" /><rect x="40" y="62" width="120" height="6" fill="#c45a3a" />
      <rect x="70" y="44" width="60" height="18" fill="#f0dcb4" /><rect x="70" y="44" width="60" height="4" fill="#c45a3a" />
      {[50, 66, 82, 118, 134, 150].map((x) => <g key={x}><path d={`M${x} 98 L${x + 1} 72 L${x - 2} 72 L${x - 1} 68 L${x + 7} 68 L${x + 8} 72 L${x + 5} 72 L${x + 6} 98Z`} fill="#b8402c" /><rect x={x - 2} y="68" width="10" height="2" fill="#3a2a2a" /></g>)}
      <rect x="92" y="72" width="16" height="26" fill="#5a3a2a" />
      <path d="M88 44 Q92 32 96 40 M104 40 Q108 32 112 44" stroke="#f6ead0" strokeWidth="3" fill="none" strokeLinecap="round" />
      <Cypres x={20} y={100} h={26} c="#4a5a36" /><Cypres x={182} y={100} h={22} c="#4a5a36" />
    </Scene>
  )
}
function Troie(p) {
  return (
    <Scene {...p} ciel={['#3a3456', '#8a5a62', '#e09868']} soleil={{ x: 160, y: 70, r: 10, c: '#ffe0b0' }}>
      <rect y="94" width="200" height="34" fill="#6a4e3e" />
      <path d="M0 94 V54 h14 v-6 h6 v6 h10 v-6 h6 v6 h14 V94Z M110 94 V48 h14 v-6 h6 v6 h12 v-6 h6 v6 h14 v-6 h6 v6 h14 v-6 h6 v6 h8 V94Z" fill="#4a3638" />
      <path d="M50 94 V62 h60 V94Z" fill="#3e2e30" /><path d="M66 94 v-18 a14 14 0 0 1 28 0 v18z" fill="#1e1618" />
      <g transform="translate(118 50)">
        <rect x="6" y="40" width="44" height="4" fill="#7a5232" /><circle cx="12" cy="46" r="4" fill="#5a3a22" /><circle cx="44" cy="46" r="4" fill="#5a3a22" />
        {[10, 18, 36, 44].map((x) => <rect key={x} x={x} y="26" width="3.4" height="14" fill="#8a5e36" />)}
        <path d="M6 14 h40 v14 h-40z" fill="#a0703e" /><path d="M6 22 h40 v6 h-40z" fill="#7a5232" />
        <path d="M40 16 L50 0 L60 2 L58 10 L50 12 L48 20Z" fill="#a0703e" /><path d="M50 0 L46 6 L52 4z" fill="#5a3a22" />
        <path d="M6 16 q-6 -2 -6 6" stroke="#7a5232" strokeWidth="2" fill="none" />
      </g>
      <Gens pts={[[30, 100], [38, 100]]} c="#2a1e20" k={1.1} />
    </Scene>
  )
}
function Altamira(p) {
  return (
    <Scene {...p} ciel={['#1e140e', '#2e1e14', '#3e2a1a']} nuit>
      <path d="M0 0 H200 V128 H0Z M24 128 Q20 60 70 36 Q110 20 150 40 Q186 64 176 128Z" fill="#140c08" fillRule="evenodd" />
      <ellipse cx="100" cy="74" rx="66" ry="44" fill="#a86a3a" opacity="0.35" />
      <path d="M50 64 q10 -10 26 -6 q14 -4 18 8 q4 12 -8 14 h-26 q-14 -2 -10 -16z" fill="#8e2e1a" />
      <path d="M58 82 v8 M74 82 v8 M84 80 v8" stroke="#6a1e10" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M52 62 q-4 -6 2 -8" stroke="#2a1a10" strokeWidth="1.6" fill="none" />
      <path d="M112 50 q10 -8 22 -4 q12 -2 14 8 q2 10 -8 12 h-20 q-12 -2 -8 -16z" fill="#b8642e" />
      <path d="M120 66 v7 M134 66 v7 M142 64 v7" stroke="#7a3a18" strokeWidth="2" strokeLinecap="round" />
      <g fill="#c8a070" opacity="0.7">{[[96, 40], [104, 44], [100, 96], [150, 86]].map(([x, y], i) => <path key={i} d={`M${x} ${y} l2 -4 l2 4 m-4 -1 h4`} stroke="#c8a070" strokeWidth="0.8" fill="none" />)}</g>
      <path d="M160 128 V96 l4 -2 l-2 -6 q4 -8 6 0 l-2 6 l4 2 V128Z" fill="#2a1a10" /><circle cx="166" cy="86" r="6" fill="#ffb24a" opacity="0.8" /><circle cx="166" cy="86" r="14" fill="#ffb24a" opacity="0.18" />
    </Scene>
  )
}
function Kourganes(p) {
  return (
    <Scene {...p} ciel={['#3a4060', '#9a6a6a', '#e8a870', '#f6d29a']} soleil={{ x: 40, y: 86, r: 10, c: '#fff0c8' }}>
      <rect y="92" width="200" height="36" fill="#7a7a4a" />
      <path d="M60 94 Q100 56 140 94Z" fill="#8a8a54" /><path d="M100 70 Q122 78 140 94 L100 94Z" fill="#6a6a40" />
      <path d="M150 94 Q170 76 192 94Z" fill="#8a8a54" /><path d="M4 96 Q20 84 40 96Z" fill="#8a8a54" />
      <rect x="96" y="54" width="8" height="18" rx="3" fill="#a09a86" /><rect x="100" y="54" width="4" height="18" rx="2" fill="#807a6a" /><circle cx="100" cy="58" r="1" fill="#3a3a3a" />
      <g fill="#3a2a22">{[[150, 108], [166, 112]].map(([x, y], i) => <path key={i} d={`M${x} ${y} l2 -8 c2 -2 8 -2 10 0 l3 -4 l3 1 l-2 5 c0 2 -1 3 -2 4 l1 6 h-2 l-1 -5 h-6 l-1 5 h-2 l-1 -5 l-1 5 h-2z`} />)}</g>
      <path d="M0 112 Q60 104 120 114 Q170 120 200 110 V128 H0Z" fill="#5e5e38" />
      <Oiseaux pts={[[130, 30], [138, 26]]} c="#2a2a3a" />
    </Scene>
  )
}
function Colisee(p) {
  return (
    <Scene {...p} ciel={['#f4c088', '#f6d4a0', '#fae8c4']} soleil={{ x: 34, y: 32, r: 10, c: '#fff6dc' }}>
      <rect y="100" width="200" height="28" fill="#c8a072" />
      <path d="M20 100 L20 42 Q100 26 180 42 L180 100Z" fill="#e6c294" />
      <path d="M100 32 Q150 34 180 42 L180 100 L100 100Z" fill="#c99e70" />
      <path d="M20 42 Q60 34 100 33 L100 26 Q50 28 20 36Z" fill="#e6c294" />
      {[0, 1, 2].map((r) => Array.from({ length: 11 }, (_, i) => {
        const x = 25 + i * 14.4, y = 94 - r * 18
        return <path key={r + '-' + i} d={`M${x} ${y} v-9 a4.4 4.4 0 0 1 8.8 0 v9z`} fill={i > 5 ? '#6a4a32' : '#8a6040'} />
      }))}
      {[42, 60, 78].map((y) => <rect key={y} x="20" y={y} width="160" height="2" fill="#f6dcb0" />)}
      <path d="M20 42 Q100 26 180 42" stroke="#f6dcb0" strokeWidth="1.6" fill="none" />
      <Gens pts={[[50, 112], [58, 114], [130, 112], [138, 116], [150, 112]]} c="#5a3a26" k={1.2} />
    </Scene>
  )
}
function Bibliotheque(p) {
  return (
    <Scene {...p} ciel={['#3a2a1e', '#5a4028', '#7a5632']} nuit>
      <rect y="104" width="200" height="24" fill="#4a3424" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x={8 + i * 40} y="20" width="26" height="84" fill="#3a2818" />
          {[0, 1, 2, 3, 4, 5].map((r) => Array.from({ length: 5 }, (_, k) => <circle key={r + '-' + k} cx={12 + i * 40 + k * 4.6} cy={28 + r * 13} r="2" fill={(r + k + i) % 3 ? '#d8b07a' : '#b8885a'} />))}
        </g>
      ))}
      <Colonnes x={36} y={14} n={4} w={6} h={90} ecart={34} lum="#e6d0a8" omb="#bca07a" />
      {[0, 1, 2].map((k) => <path key={k} d={`M${70 + k * 30} 0 L${40 + k * 40} 104 L${64 + k * 40} 104 L${86 + k * 30} 0Z`} fill="#ffe0a0" opacity="0.1" />)}
      <rect x="80" y="86" width="40" height="4" fill="#8a6a4a" /><path d="M86 86 l2 -6 h24 l2 6z" fill="#f0dcb0" />
      <Gens pts={[[70, 104], [134, 104]]} c="#1e140c" k={1.3} />
    </Scene>
  )
}
function Phare(p) {
  return (
    <Scene {...p} ciel={['#1a2440', '#2e3a5a', '#5a5a7a']} nuit>
      {[-20, 0, 20].map((a) => <path key={a} d={`M100 22 L${-40} ${10 + a * 2} L${-40} ${30 + a * 2}Z M100 22 L240 ${10 - a * 2} L240 ${30 - a * 2}Z`} fill="#ffd27a" opacity="0.08" />)}
      <rect y="100" width="200" height="28" fill="#1e2a40" /><Reflets y0={102} x={100} largeur={30} c="#ffd27a" n={8} />
      <path d="M60 100 L66 90 L134 90 L140 100Z" fill="#4a4652" />
      <rect x="76" y="58" width="48" height="32" fill="#c8bca8" /><rect x="100" y="58" width="24" height="32" fill="#9a8e7c" />
      <rect x="86" y="36" width="28" height="22" fill="#d8ccb8" /><rect x="100" y="36" width="14" height="22" fill="#a89c88" />
      <rect x="92" y="24" width="16" height="12" fill="#e4d8c4" /><rect x="100" y="24" width="8" height="12" fill="#b4a894" />
      <circle cx="100" cy="20" r="6" fill="#ffd27a" /><circle cx="100" cy="20" r="16" fill="#ffd27a" opacity="0.25" />
      <rect x="96" y="66" width="8" height="10" fill="#3a3440" />
      <path d="M150 104 l24 0 l-3 4 l-18 0z M160 104 v-12 l9 10z" fill="#0e1420" />
      {[[30, 12], [60, 30], [160, 16], [180, 40], [140, 8]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.8" fill="#fff8e0" />)}
    </Scene>
  )
}
function Jardins(p) {
  return (
    <Scene {...p} ciel={['#f0b07a', '#f6cc94', '#fae6be']} soleil={{ x: 168, y: 34, r: 10, c: '#fff6dc' }}>
      <rect y="102" width="200" height="26" fill="#c8a06a" />
      {[[30, 88, 140], [44, 74, 112], [58, 60, 84], [72, 46, 56]].map(([x, y, w], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height="14" fill="#e2c08a" /><rect x={x + w * 0.55} y={y} width={w * 0.45} height="14" fill="#c4a06a" />
          {Array.from({ length: Math.floor(w / 12) }, (_, k) => <circle key={k} cx={x + 6 + k * 12} cy={y - 1} r="4.6" fill={k % 2 ? '#4e7a3a' : '#5e8a44'} />)}
          {Array.from({ length: Math.floor(w / 12) }, (_, k) => <path key={'l' + k} d={`M${x + 4 + k * 12} ${y + 2} q1 6 -1 10`} stroke="#4e7a3a" strokeWidth="1.4" fill="none" />)}
        </g>
      ))}
      <path d="M100 46 v56" stroke="#9fd0e0" strokeWidth="3" /><path d="M100 46 v56" stroke="#e8f6fa" strokeWidth="1" />
      <Palmier x={18} y={104} h={34} c="#3e4a24" /><Palmier x={186} y={104} h={30} c="#3e4a24" />
      <Gens pts={[[120, 112], [128, 114]]} c="#5a3a26" k={1.2} />
    </Scene>
  )
}
function Pantheon(p) {
  return (
    <Scene {...p} ciel={['#a8c4dc', '#d8dcd0', '#f2e4c4']} soleil={{ x: 30, y: 30, r: 9, c: '#fffbe8' }}>
      <rect y="100" width="200" height="28" fill="#c4a87e" />
      <path d="M86 54 A44 34 0 0 1 174 54Z" fill="#d6c4a2" /><path d="M130 20 A44 34 0 0 1 174 54 L130 54Z" fill="#b4a080" />
      <rect x="86" y="54" width="88" height="46" fill="#dccaa6" /><rect x="130" y="54" width="44" height="46" fill="#bca888" />
      <path d="M24 46 L68 26 L112 46Z" fill="#efe2c6" /><path d="M68 26 L112 46 L68 46Z" fill="#d4c2a0" />
      <rect x="24" y="46" width="88" height="6" fill="#e8dabc" />
      <Colonnes x={28} y={52} n={8} w={6} h={42} ecart={5.4} lum="#f4e8d0" omb="#d4c2a0" />
      <rect x="22" y="94" width="92" height="6" fill="#e8dabc" />
      <path d="M180 100 V40 l3 -6 l3 6 V100Z" fill="#c4b494" />
      <Gens pts={[[40, 112], [50, 114], [150, 112]]} c="#4a3a2a" k={1.2} />
    </Scene>
  )
}
function Muraille(p) {
  const crete = 'M0 70 L24 52 L44 64 L70 34 L94 50 L120 24 L148 44 L172 28 L200 40'
  return (
    <Scene {...p} ciel={['#d8c8b0', '#e6d8c0', '#f2e8d4']} soleil={{ x: 150, y: 30, r: 8, c: '#fff6e0' }}>
      <path d="M0 56 L30 30 L60 50 L96 14 L130 40 L166 10 L200 30 V128 H0Z" fill="#9aa08a" opacity="0.45" />
      <path d={crete + ' V128 H0Z'} fill="#6e7a52" />
      <path d={crete} stroke="#b8a888" strokeWidth="6" fill="none" strokeLinejoin="round" />
      <path d={crete} stroke="#d8c8a6" strokeWidth="2.4" fill="none" strokeLinejoin="round" transform="translate(0 -1.6)" />
      <g>{[[24, 52], [70, 34], [120, 24], [172, 28]].map(([x, y], i) => <g key={i}><rect x={x - 6} y={y - 12} width="12" height="12" fill="#d8c8a6" /><rect x={x} y={y - 12} width="6" height="12" fill="#b0a080" /><path d={`M${x - 7} ${y - 12} h14 l-2 -4 h-10z`} fill="#8a5a3a" /></g>)}</g>
      <path d="M0 96 Q50 84 100 96 Q150 106 200 92 V128 H0Z" fill="#4e5a38" />
      <rect y="70" width="200" height="10" fill="#f2e8d4" opacity="0.25" />
    </Scene>
  )
}
function Cathedrale(p) {
  return (
    <Scene {...p} ciel={['#1e2440', '#3a3a62', '#6a5a7a']} nuit>
      <rect y="104" width="200" height="24" fill="#2a2630" />
      {[[48, 0], [128, 1]].map(([x, d]) => (
        <g key={x}>
          <rect x={x} y="30" width="24" height="74" fill={d ? '#5a5466' : '#6e687a'} />
          <path d={`M${x} 30 L${x + 12} 0 L${x + 24} 30Z`} fill={d ? '#4a4456' : '#5e586a'} />
          {[44, 64, 84].map((y) => <path key={y} d={`M${x + 8} ${y} v-8 a4 4 0 0 1 8 0 v8z`} fill="#ffcf7a" opacity="0.85" />)}
        </g>
      ))}
      <rect x="72" y="44" width="56" height="60" fill="#645e72" /><path d="M72 44 L100 22 L128 44Z" fill="#544e62" />
      <circle cx="100" cy="58" r="12" fill="#ffc86a" /><circle cx="100" cy="58" r="12" fill="none" stroke="#3a3446" strokeWidth="1.6" />
      {[0, 45, 90, 135].map((a) => { const r = (a * Math.PI) / 180; return <path key={a} d={`M${100 - Math.cos(r) * 12} ${58 - Math.sin(r) * 12} L${100 + Math.cos(r) * 12} ${58 + Math.sin(r) * 12}`} stroke="#3a3446" strokeWidth="1.2" /> })}
      <circle cx="100" cy="58" r="30" fill="#ffc86a" opacity="0.1" />
      <path d="M88 104 v-18 a12 12 0 0 1 24 0 v18z" fill="#ffb24a" opacity="0.9" />
      <Gens pts={[[60, 112], [70, 114], [140, 112]]} c="#120e16" k={1.2} />
      <circle cx="30" cy="20" r="5" fill="#f4ecd0" />
    </Scene>
  )
}
function TableRonde(p) {
  return (
    <Scene {...p} ciel={['#1a120c', '#2a1c12', '#3a2818']} nuit>
      <path d="M0 0 H200 V40 Q100 14 0 40Z" fill="#120a06" />
      {[30, 70, 130, 170].map((x, i) => (
        <g key={x}>
          <rect x={x - 8} y="14" width="16" height="34" fill={['#8e1f16', '#1e4a8e', '#0d6b5a', '#8a6a1a'][i]} />
          <path d={`M${x - 8} 48 l8 -6 l8 6z`} fill="#1a120c" />
          <circle cx={x} cy="28" r="4" fill="#e8c267" opacity="0.8" />
        </g>
      ))}
      <ellipse cx="100" cy="96" rx="78" ry="20" fill="#2a1a0e" />
      <ellipse cx="100" cy="92" rx="76" ry="18" fill="#7a4e2a" /><ellipse cx="100" cy="90" rx="70" ry="15" fill="#9a6838" />
      <ellipse cx="100" cy="90" rx="16" ry="4" fill="#e8c267" opacity="0.5" />
      <path d="M70 88 L130 88" stroke="#d8dce0" strokeWidth="2" /><path d="M126 85 v6" stroke="#e8c267" strokeWidth="2" />
      {Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; const x = 100 + Math.cos(a) * 82, y = 96 + Math.sin(a) * 22; return <rect key={i} x={x - 4} y={y - 12} width="8" height="12" rx="2" fill="#3a2414" /> })}
      {[[50, 60], [150, 60]].map(([x, y], i) => <g key={i}><rect x={x - 1} y={y} width="2" height="10" fill="#e8dcc0" /><circle cx={x} cy={y - 2} r="2.4" fill="#ffcf6a" /><circle cx={x} cy={y - 2} r="12" fill="#ffcf6a" opacity="0.15" /></g>)}
    </Scene>
  )
}
function Mausolee(p) {
  return (
    <Scene {...p} ciel={['#f2a870', '#f6c890', '#fae2b6']} soleil={{ x: 170, y: 70, r: 11, c: '#fff2d4' }}>
      <rect y="92" width="200" height="36" fill="#4a5a7a" /><Reflets y0={94} x={170} largeur={36} c="#ffd49a" n={7} />
      <path d="M0 100 Q60 92 140 98 L140 128 H0Z" fill="#a08060" />
      <rect x="44" y="70" width="80" height="28" fill="#ead6b2" /><rect x="84" y="70" width="40" height="28" fill="#cbb48e" />
      <rect x="48" y="66" width="72" height="4" fill="#f2e0c0" />
      <Colonnes x={52} y={46} n={7} w={5} h={20} ecart={5} lum="#f4e4c6" omb="#d0ba94" />
      <rect x="48" y="42" width="72" height="4" fill="#f2e0c0" />
      {[0, 1, 2, 3, 4].map((i) => <g key={i}><rect x={52 + i * 7} y={38 - i * 4} width={64 - i * 14} height="4" fill="#ead6b2" /><rect x={84} y={38 - i * 4} width={Math.max(0, 32 - i * 7)} height="4" fill="#cbb48e" /></g>)}
      <path d="M78 18 h12 v-3 l-3 -4 l-2 2 l-2 -2 l-2 2 l-3 -2z" fill="#c9a24a" />
      <Cypres x={30} y={100} h={28} c="#3e3a26" /><Cypres x={138} y={98} h={24} c="#3e3a26" />
    </Scene>
  )
}

const ART = {
  parthenon: Parthenon, stonehenge: Stonehenge, pyramides: Pyramides, broceliande: Broceliande, vesuve: Vesuve,
  compostelle: Compostelle, porta_nigra: PortaNigra, colosse_rhodes: Colosse, mur_d_hadrien: MurHadrien,
  pont_du_gard: PontDuGard, chersonese: Chersonese, knossos: Knossos, troie: Troie, altamira: Altamira,
  kourganes: Kourganes, colisee: Colisee, grande_bibliotheque: Bibliotheque, grand_phare: Phare,
  jardins_suspendus: Jardins, pantheon: Pantheon, grande_muraille: Muraille, cathedrale: Cathedrale,
  table_ronde: TableRonde, mausolee: Mausolee,
}
const ART_TYPE = { antique: Parthenon, naturelle: Broceliande, ruine: Chersonese, fouille: Troie, construction: Colisee }

export default function WonderArt({ id, type, size = 200, className, style }) {
  const C = ART[id] || ART_TYPE[type]
  if (!C) return null
  return <C size={size} className={className} style={style} />
}
