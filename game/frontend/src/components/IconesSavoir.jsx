// ICÔNES DES TECHNOLOGIES ET DES DOGMES (viewBox 48×48) — pictogrammes pleins,
// une teinte claire (currentColor), modelé par aplats sombres et traits d'encre,
// pensés pour les médaillons ronds de l'arbre façon Civilization.

const C = 'currentColor'
const O = 'rgba(0,0,0,0.28)'      // ombre portée interne
const E = 'rgba(20,12,4,0.7)'      // encre des détails
const ICONES = {
  // ---------------------------------------------------------------- technologies
  legion_tactique: (
    <g>
      <path d="M9 39 L37 11 l3 3 L12 42z" fill={C} /><path d="M36 9 l4 -1 -1 4z" fill={C} /><path d="M10 35 l3 3 -3 3 -3 -3z" fill={C} />
      <rect x="15" y="10" width="18" height="28" rx="3" fill={C} /><rect x="15" y="10" width="18" height="28" rx="3" fill="none" stroke={E} strokeWidth="1.2" />
      <path d="M24 10v28M15 24h18" stroke={E} strokeWidth="1" /><circle cx="24" cy="24" r="3.6" fill={O} /><circle cx="24" cy="24" r="2.4" fill={C} />
      <path d="M33 13 v22 a3 3 0 0 1 -3 3 h-2 v-28 h2 a3 3 0 0 1 3 3z" fill={O} />
    </g>
  ),
  siege: (
    <g>
      <rect x="6" y="32" width="32" height="5" rx="1" fill={C} /><circle cx="12" cy="39" r="4.5" fill={C} /><circle cx="32" cy="39" r="4.5" fill={C} />
      <circle cx="12" cy="39" r="1.6" fill={E} /><circle cx="32" cy="39" r="1.6" fill={E} />
      <path d="M22 32 L18 20 h3 L25 32z" fill={C} /><path d="M18 22 L38 8 l2 3 L20 25z" fill={C} />
      <path d="M36 4 a5 5 0 0 1 8 6 l-5 1z" fill={C} /><circle cx="41" cy="5.5" r="3" fill={O} />
      <path d="M8 32 L22 22" stroke={E} strokeWidth="1.4" />
    </g>
  ),
  marine_guerre: (
    <g>
      <path d="M4 26 H40 L46 24 L42 32 C40 35 37 36 33 36 H11 C7 36 5 32 4 26z" fill={C} />
      <path d="M40 26 L47 25 L44 29z" fill={O} /><path d="M4 26 H40" stroke={E} strokeWidth="1" />
      <path d="M22 26 V6" stroke={C} strokeWidth="2.4" /><path d="M10 9 Q22 7 34 9 V22 Q22 20 10 22z" fill={C} /><path d="M10 15 Q22 13 34 15" stroke={E} strokeWidth="1" fill="none" />
      {[10, 16, 22, 28, 34].map((x) => <path key={x} d={`M${x} 36 l-3 6`} stroke={C} strokeWidth="1.6" />)}
      <path d="M2 44 q5 -3 10 0 t10 0 t10 0 t10 0 t10 0" stroke={C} strokeWidth="1.4" fill="none" opacity="0.7" />
    </g>
  ),
  tactique_elephants: (
    <g>
      <path d="M8 14 C4 22 6 32 14 33 C14 26 16 20 20 17z M40 14 C44 22 42 32 34 33 C34 26 32 20 28 17z" fill={O} />
      <path d="M8 14 C3 22 5 31 13 32 C13 25 15 19 19 16z M40 14 C45 22 43 31 35 32 C35 25 33 19 29 16z" fill={C} />
      <path d="M24 8 C32 8 36 14 35 22 C34 28 30 31 28 34 C27 38 28 43 25 45 C23 46 21 44 22 42 C23 39 22 36 20 33 C17 29 13 26 13 20 C13 13 17 8 24 8z" fill={C} />
      <path d="M19 30 C15 33 12 34 10 33 M29 30 C33 33 36 34 38 33" stroke={C} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="19.5" cy="19" r="1.4" fill={E} /><circle cx="28.5" cy="19" r="1.4" fill={E} />
      <path d="M17 12 q7 -3 14 0" stroke={O} strokeWidth="2" fill="none" />
    </g>
  ),
  routes_commerciales: (
    <g>
      <path d="M2 42 h44" stroke={C} strokeWidth="1.6" strokeDasharray="3 2.5" />
      <path d="M8 40 V28 C8 24 10 22 13 22 C14 18 17 14 21 14 C25 14 27 18 28 22 C30 19 33 17 35 19 L38 14 L41 15 L39 21 C39 25 37 28 34 29 V40 h-3 V31 H14 V40z" fill={C} />
      <path d="M14 31 v9 M31 31 v9" stroke={E} strokeWidth="1" /><circle cx="39.5" cy="16.2" r="0.8" fill={E} />
      <rect x="15" y="16" width="10" height="7" rx="2" fill={O} /><path d="M16 19 h8" stroke={E} strokeWidth="0.8" />
    </g>
  ),
  ingenierie_hydraulique: (
    <g>
      <rect x="3" y="10" width="42" height="5" fill={C} /><path d="M3 12.5 h42" stroke="#7fb4c8" strokeWidth="1.6" />
      <path d="M3 15 h42 v26 h-6 v-12 a6 6 0 0 0 -12 0 v12 h-6 v-12 a6 6 0 0 0 -12 0 v12 H3z" fill={C} />
      <path d="M3 22 h42" stroke={E} strokeWidth="1" />
      {[9, 24, 39].map((x) => <path key={x} d={`M${x - 3.5} 19 a3.5 3.5 0 0 1 7 0`} fill={O} />)}
      <path d="M44 15 q2 6 0 12 q-2 4 0 8" stroke="#7fb4c8" strokeWidth="1.8" fill="none" />
    </g>
  ),
  monnaie_frappee: (
    <g>
      {[0, 1, 2, 3].map((i) => <ellipse key={i} cx="15" cy={38 - i * 4} rx="10" ry="3.4" fill={i % 2 ? O : C} stroke={E} strokeWidth="0.8" />)}
      <circle cx="30" cy="22" r="13" fill={C} /><circle cx="30" cy="22" r="13" fill="none" stroke={E} strokeWidth="1.2" />
      <circle cx="30" cy="22" r="10.4" fill="none" stroke={E} strokeWidth="0.8" strokeDasharray="1 1.6" />
      <path d="M27 15 c4 -1 7 2 6.4 5.6 l2 2.6 -2.2 0.4 c0 2.4 -1.4 4 -3.6 4 l-0.4 3 h-5 l0.6 -4 c-2 -1.4 -2.6 -4.2 -1.6 -7 c0.8 -2.4 2.2 -4.2 3.8 -4.6z" fill={O} />
    </g>
  ),
  agriculture_intensive: (
    <g>
      <path d="M24 44 V14" stroke={C} strokeWidth="2" />
      {[14, 20, 26, 32].map((y) => (
        <g key={y}>
          <path d={`M24 ${y} c-5 -1 -7 -4 -7 -8 c4 1 7 4 7 8z`} fill={C} />
          <path d={`M24 ${y} c5 -1 7 -4 7 -8 c-4 1 -7 4 -7 8z`} fill={C} />
        </g>
      ))}
      <path d="M24 8 c-1.4 -2 -1.4 -4 0 -6 c1.4 2 1.4 4 0 6z" fill={C} />
      <path d="M4 44 L16 38 h6 v3 h-5 L7 46z" fill={C} /><path d="M30 44 h14" stroke={C} strokeWidth="1.6" strokeDasharray="2 2" />
    </g>
  ),
  droit_romain: (
    <g>
      <rect x="17" y="10" width="14" height="34" rx="2" fill={C} />
      {[20, 24, 28].map((x) => <path key={x} d={`M${x} 10 v34`} stroke={E} strokeWidth="0.8" />)}
      <path d="M17 18 h14 M17 36 h14" stroke={E} strokeWidth="1.6" />
      <path d="M24 10 V4 M24 6 C30 2 38 4 40 10 C36 9 32 10 30 13 C28 10 26 9 24 10z" fill={C} stroke={C} strokeWidth="1.4" />
      <path d="M30 13 C32 10 36 9 40 10" stroke={E} strokeWidth="0.8" fill="none" />
    </g>
  ),
  philosophie_grecque: (
    <g>
      <path d="M12 42 C9 30 11 14 24 10 C37 14 39 30 36 42z" fill={C} />
      <path d="M14 16 L10 8 L18 13z M34 16 L38 8 L30 13z" fill={C} />
      <circle cx="18" cy="21" r="5.2" fill={O} /><circle cx="30" cy="21" r="5.2" fill={O} />
      <circle cx="18" cy="21" r="3.6" fill={C} /><circle cx="30" cy="21" r="3.6" fill={C} />
      <circle cx="18" cy="21" r="1.6" fill={E} /><circle cx="30" cy="21" r="1.6" fill={E} />
      <path d="M22 26 l2 4 2 -4z" fill={E} />
      <path d="M17 33 q7 4 14 0 M18 37 q6 3 12 0" stroke={O} strokeWidth="1.6" fill="none" />
      <path d="M6 44 h36" stroke={C} strokeWidth="2.4" strokeLinecap="round" />
    </g>
  ),
  jeux_publics: (
    <g>
      <path d="M5 8 C11 6 19 6 24 8 C25 16 23 25 15 29 C8 26 4 17 5 8z" fill={C} />
      <path d="M9 14 q2.5 -2 5 0 M16 14 q2.5 -2 5 0" stroke={E} strokeWidth="1.4" fill="none" /><path d="M10 20 q5 5 10 0" stroke={E} strokeWidth="1.6" fill="none" />
      <path d="M24 18 C29 16 37 16 43 18 C44 27 40 36 33 39 C26 36 22 27 24 18z" fill={C} />
      <path d="M28 25 q2.5 2 5 0 M35 25 q2.5 2 5 0" stroke={E} strokeWidth="1.4" fill="none" /><path d="M29 33 q4.5 -4 9 0" stroke={E} strokeWidth="1.6" fill="none" />
      <path d="M24 18 C23 27 26 36 33 39" stroke={O} strokeWidth="2" fill="none" />
    </g>
  ),
  reseau_espionnage: (
    <g>
      <path d="M3 24 C10 12 38 12 45 24 C38 36 10 36 3 24z" fill={C} />
      <circle cx="24" cy="24" r="8.4" fill={O} /><circle cx="24" cy="24" r="6" fill={C} /><circle cx="24" cy="24" r="3" fill={E} />
      <circle cx="22" cy="22" r="1.1" fill={C} />
      <path d="M3 24 C10 12 38 12 45 24" stroke={E} strokeWidth="1.2" fill="none" />
      <path d="M32 40 L44 46 M34 44 l2 -4" stroke={C} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  architecture_pierre: (
    <g>
      <rect x="8" y="7" width="32" height="5" rx="1" fill={C} />
      <path d="M8 12 C4 12 3 17 7 18 C10 18.5 11 15 9 14 M40 12 C44 12 45 17 41 18 C38 18.5 37 15 39 14" stroke={C} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M10 12 h28 q-2 6 -14 6 q-12 0 -14 -6z" fill={C} />
      <rect x="15" y="18" width="18" height="22" fill={C} />
      {[18.5, 22, 25.5, 29].map((x) => <path key={x} d={`M${x} 19 v20`} stroke={O} strokeWidth="1.4" />)}
      <rect x="11" y="40" width="26" height="5" rx="1" fill={C} />
    </g>
  ),
  ponts_routes: (
    <g>
      <path d="M2 18 H46 V24 H2z" fill={C} />
      <path d="M2 24 H46 V44 H38 C38 34 32 28 24 28 C16 28 10 34 10 44 H2z" fill={C} />
      <path d="M2 21 h44" stroke={E} strokeWidth="0.8" strokeDasharray="4 2" />
      <path d="M10 44 C10 34 16 28 24 28 C32 28 38 34 38 44" stroke={O} strokeWidth="2.4" fill="none" />
      <path d="M12 42 q4 -2 8 0 t8 0 t8 0" stroke="#7fb4c8" strokeWidth="1.4" fill="none" />
      {[6, 14, 22, 30, 38].map((x) => <path key={x} d={`M${x} 14 v4`} stroke={C} strokeWidth="1.6" />)}
    </g>
  ),
  genie_militaire: (
    <g>
      <path d="M12 44 V14 h4 v-4 h4 v4 h8 v-4 h4 v4 h4 v30z" fill={C} />
      <path d="M12 22 h24" stroke={E} strokeWidth="0.9" />
      <path d="M20 44 v-8 a4 4 0 0 1 8 0 v8z" fill={O} /><rect x="22" y="25" width="4" height="5" rx="1" fill={O} />
      <path d="M38 44 V8 L46 8" stroke={C} strokeWidth="2" /><path d="M44 8 v12" stroke={C} strokeWidth="1" /><rect x="42" y="19" width="4" height="3" fill={C} />
      <path d="M38 14 L44 8" stroke={C} strokeWidth="1" />
    </g>
  ),
  navigation_maritime: (
    <g>
      <circle cx="24" cy="24" r="17" fill="none" stroke={C} strokeWidth="2.6" />
      <circle cx="24" cy="24" r="12" fill="none" stroke={C} strokeWidth="1" strokeDasharray="1.4 1.8" />
      <path d="M24 4 L28 24 L24 44 L20 24z" fill={C} /><path d="M24 4 L28 24 L24 24z M24 44 L20 24 L24 24z" fill={O} />
      <path d="M4 24 L24 20.5 L44 24 L24 27.5z" fill={C} opacity="0.85" />
      <circle cx="24" cy="24" r="2.6" fill={E} />
      <path d="M36 6 l1 2.6 2.8 0.2 -2.2 1.8 0.8 2.7 -2.4 -1.5 -2.4 1.5 0.8 -2.7 -2.2 -1.8 2.8 -0.2z" fill={C} />
    </g>
  ),
  // ---------------------------------------------------------------- dogmes
  magistratures: (
    <g>
      <path d="M8 16 h32 v5 H8z" fill={C} />
      <path d="M12 21 C14 30 22 34 34 42 M36 21 C34 30 26 34 14 42" stroke={C} strokeWidth="3.4" strokeLinecap="round" fill="none" />
      <path d="M10 42 h8 M30 42 h8" stroke={C} strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="32" r="2.2" fill={E} /><path d="M8 18.5 h32" stroke={E} strokeWidth="0.8" />
    </g>
  ),
  code_lois: (
    <g>
      <path d="M6 10 C6 6 10 5 13 6 V40 C10 39 6 40 6 44z" fill={O} />
      <path d="M10 6 H38 C41 6 42 9 42 12 V40 C42 43 40 44 37 44 H13 C10 44 9 42 9 40z" fill={C} />
      {[14, 19, 24, 29].map((y) => <path key={y} d={`M15 ${y} h${y === 29 ? 12 : 20}`} stroke={E} strokeWidth="1.2" />)}
      <circle cx="34" cy="36" r="5" fill="#b03a2e" /><path d="M31 41 l-1 5 3 -2 2 2 -0.5 -5" fill="#b03a2e" />
    </g>
  ),
  senat: (
    <g>
      <path d="M24 4 L44 16 H4z" fill={C} /><path d="M10 15 L24 7 L38 15" stroke={E} strokeWidth="0.8" fill="none" />
      <rect x="5" y="16" width="38" height="3" fill={C} />
      {[8, 15, 22, 29, 36].map((x) => <rect key={x} x={x} y="20" width="4" height="18" fill={C} />)}
      <rect x="3" y="38" width="42" height="3" fill={C} /><rect x="1" y="42" width="46" height="3" fill={C} />
      <text x="24" y="15" textAnchor="middle" fontFamily="Cinzel, serif" fontSize="5.5" fontWeight="700" fill={E}>SPQR</text>
    </g>
  ),
  culte_etat: (
    <g>
      <path d="M24 4 C30 10 31 16 27 21 C29 16 26 13 24 11 C23 15 19 17 20 22 C16 18 17 10 24 4z" fill="#e8a046" />
      <rect x="10" y="22" width="28" height="4" rx="1" fill={C} />
      <path d="M13 26 h22 v14 H13z" fill={C} /><path d="M13 30 h22 M13 36 h22" stroke={O} strokeWidth="1.4" />
      <rect x="8" y="40" width="32" height="5" rx="1" fill={C} />
      <path d="M20 33 h8" stroke={E} strokeWidth="1.2" />
    </g>
  ),
  grands_temples: (
    <g>
      <path d="M24 5 L45 15 H3z" fill={C} /><circle cx="24" cy="12" r="2" fill={E} />
      <rect x="4" y="15" width="40" height="3" fill={C} />
      {[6, 12, 18, 26, 32, 38].map((x) => <rect key={x} x={x} y="19" width="4" height="19" fill={C} />)}
      <rect x="21" y="23" width="6" height="15" fill={O} />
      <rect x="2" y="38" width="44" height="3" fill={C} /><rect x="0" y="42" width="48" height="3" fill={C} />
    </g>
  ),
  pretrise: (
    <g>
      <path d="M24 44 V16 C24 9 30 5 35 8 C40 11 38 18 33 18 C30 18 29 15 31 13" stroke={C} strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d="M8 30 C8 24 14 22 16 26 C18 22 20 22 20 26" stroke={C} strokeWidth="2" fill="none" />
      <path d="M10 34 h10 l-2 8 h-6z" fill={C} /><path d="M14 28 c-1 -3 1 -5 2 -7 c1 3 0 5 -2 7z" fill="#e8a046" />
    </g>
  ),
  colonisation: (
    <g>
      <path d="M4 40 C12 30 20 28 28 32 C34 35 40 34 44 30 V44 H4z" fill={C} />
      <path d="M10 42 C16 36 24 36 30 40 M22 44 C26 40 32 40 38 42" stroke={O} strokeWidth="1.4" fill="none" />
      <path d="M26 32 V6" stroke={C} strokeWidth="2.2" />
      <path d="M26 6 L42 10 L36 14 L42 18 L26 20z" fill={C} /><path d="M26 6 L42 10 L36 14 L42 18 L26 20" stroke={E} strokeWidth="0.8" fill="none" />
    </g>
  ),
  limes: (
    <g>
      {[3, 9, 15, 21, 27].map((x) => <path key={x} d={`M${x} 44 V24 l3 -4 3 4 V44z`} fill={C} />)}
      <path d="M3 30 h30 M3 38 h30" stroke={E} strokeWidth="1.2" />
      <path d="M33 44 V16 h12 V44z" fill={C} /><path d="M31 16 h16 l-3 -6 h-10z" fill={C} />
      <rect x="37" y="20" width="4" height="5" fill={O} /><path d="M33 30 h12" stroke={E} strokeWidth="1" />
    </g>
  ),
  voies_imperiales: (
    <g>
      <path d="M18 44 L22 14 h4 L30 44z" fill={C} /><path d="M24 18 v4 M24 27 v5 M24 37 v6" stroke={E} strokeWidth="1.4" />
      <path d="M2 44 L20 14 M46 44 L28 14" stroke={C} strokeWidth="1.2" opacity="0.6" />
      <path d="M36 44 V28 C36 25 38 24 40 24 C42 24 44 25 44 28 V44z" fill={C} />
      <path d="M37.5 31 h5 M37.5 35 h5" stroke={E} strokeWidth="1" />
      <circle cx="10" cy="10" r="5" fill="none" stroke={C} strokeWidth="1.6" />
    </g>
  ),
}

export default function IconeSavoir({ id, taille = 32, className = '', style }) {
  return (
    <svg viewBox="0 0 48 48" width={taille} height={taille} className={className} style={style} aria-hidden="true">
      {ICONES[id] || <circle cx="24" cy="24" r="10" fill={C} />}
    </svg>
  )
}
