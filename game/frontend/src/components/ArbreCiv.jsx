import { useMemo, useState } from 'react'
import IconeSavoir from './IconesSavoir'
import { UnitIcon, UiIcon } from './Icons'

// ARBRE FAÇON CIVILIZATION — commun aux technologies et aux dogmes.
// Couloirs horizontaux par branche, colonnes par « âge » (profondeur des
// prérequis), nœuds ronds (icône + anneau de progression) prolongés d'un
// cartouche (nom, délai, débloquages), liaisons orthogonales dorées une fois
// acquises. Un clic lance la recherche / l'adoption ; le survol détaille.

const NODE_W = 300, NODE_H = 76, GAP_X = 70, GAP_Y = 16, PAD_X = 36, HEADER_H = 54, LANE_GAP = 22
const AGES = ['Fondations', 'Essor', 'Maîtrise', 'Apogée', 'Héritage']
const ROMAINS = ['I', 'II', 'III', 'IV', 'V']

const THEMES = {
  savoir: { fond: 'radial-gradient(ellipse at 30% 0%, #1d3a55 0%, #10202f 55%, #0a141e 100%)', accent: '#6fd0f0', grille: 'rgba(120,190,230,0.06)', bande: 'rgba(120,190,230,0.045)' },
  culture: { fond: 'radial-gradient(ellipse at 30% 0%, #3a2350 0%, #1d1229 55%, #110a18 100%)', accent: '#d39ef2', grille: 'rgba(210,160,240,0.06)', bande: 'rgba(210,160,240,0.05)' },
}

export default function ArbreCiv({ elements, branches, theme = 'savoir', statut, progression, delai, cout, debloque, onAction, busy, libelleAction }) {
  const [survol, setSurvol] = useState(null)
  const T = THEMES[theme] || THEMES.savoir
  const byId = useMemo(() => Object.fromEntries(elements.map((t) => [t.id, t])), [elements])

  const layout = useMemo(() => {
    const memo = {}
    const prof = (id, vus = new Set()) => {
      if (memo[id] != null) return memo[id]
      if (vus.has(id)) return 0
      vus.add(id)
      const pre = (byId[id] && byId[id].prerequis) || []
      const d = pre.length ? 1 + Math.max(...pre.map((p) => prof(p, vus))) : 0
      memo[id] = d; return d
    }
    const ordre = branches.map((b) => b.id)
    const couloirs = []
    let y = HEADER_H
    let ncols = 0
    const pos = {}
    for (const b of ordre) {
      const items = elements.filter((t) => (t.branche || ordre[0]) === b)
      if (!items.length) continue
      const parCol = {}
      for (const t of items) { const d = prof(t.id); (parCol[d] = parCol[d] || []).push(t); ncols = Math.max(ncols, d + 1) }
      const lignes = Math.max(...Object.values(parCol).map((l) => l.length))
      for (const [d, l] of Object.entries(parCol)) {
        l.sort((a, c) => a.nom.localeCompare(c.nom))
        l.forEach((t, r) => { pos[t.id] = { x: PAD_X + Number(d) * (NODE_W + GAP_X), y: y + r * (NODE_H + GAP_Y) } })
      }
      const h = lignes * (NODE_H + GAP_Y) - GAP_Y
      couloirs.push({ id: b, y, h })
      y += h + LANE_GAP
    }
    return { pos, couloirs, ncols, w: PAD_X * 2 + ncols * NODE_W + (ncols - 1) * GAP_X, h: y + 10 }
  }, [elements, branches, byId])

  const coulBranche = (id) => (branches.find((b) => b.id === id) || branches[0]).couleur
  const detail = survol && byId[survol]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="thin-scroll relative min-h-0 flex-1 overflow-auto" style={{ background: T.fond }}>
        <div className="relative" style={{ width: layout.w, height: layout.h }}>
          {/* Grille fine et colonnes d'âge alternées */}
          <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: `linear-gradient(${T.grille} 1px, transparent 1px), linear-gradient(90deg, ${T.grille} 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />
          {Array.from({ length: layout.ncols }, (_, c) => (
            <div key={c} className="pointer-events-none absolute top-0" style={{
              left: PAD_X + c * (NODE_W + GAP_X) - GAP_X / 2, width: NODE_W + GAP_X, height: layout.h,
              background: c % 2 ? T.bande : 'transparent', borderLeft: c ? `1px solid ${T.grille}` : 'none',
            }}>
              <div className="flex flex-col items-center pt-2">
                <span className="font-display text-[11px] tracking-[0.3em]" style={{ color: T.accent }}>ÂGE {ROMAINS[c] || c + 1}</span>
                <span className="font-display text-sm font-semibold tracking-wider text-parchment/80">{AGES[c] || ''}</span>
              </div>
            </div>
          ))}
          {/* Couloirs de branches */}
          {layout.couloirs.map((l) => {
            const b = branches.find((x) => x.id === l.id)
            return (
              <div key={l.id} className="pointer-events-none absolute left-0" style={{ top: l.y - 10, height: l.h + 20, width: layout.w }}>
                <div className="absolute left-0 top-0 h-full w-[3px]" style={{ background: b.couleur, opacity: 0.8 }} />
                <span className="absolute left-2 top-0 font-display text-[10px] uppercase tracking-[0.25em]" style={{ color: b.couleur }}>{b.nom}</span>
              </div>
            )
          })}
          {/* Liaisons */}
          <svg className="pointer-events-none absolute inset-0" width={layout.w} height={layout.h}>
            {elements.map((t) => (t.prerequis || []).map((p) => {
              const a = layout.pos[p], b = layout.pos[t.id]
              if (!a || !b) return null
              const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x + 4, y2 = b.y + NODE_H / 2
              const mx = x1 + (x2 - x1) * 0.5, r = Math.min(10, Math.abs(y2 - y1) / 2)
              const sy = y2 > y1 ? 1 : -1
              const d = Math.abs(y2 - y1) < 1 ? `M${x1} ${y1} H${x2}`
                : `M${x1} ${y1} H${mx - r} Q${mx} ${y1} ${mx} ${y1 + sy * r} V${y2 - sy * r} Q${mx} ${y2} ${mx + r} ${y2} H${x2}`
              const fait = statut(byId[p]) === 'acquise'
              const actif = survol && (survol === t.id || survol === p)
              return (
                <g key={p + '>' + t.id}>
                  <path d={d} fill="none" stroke="#000" strokeOpacity="0.45" strokeWidth={fait ? 6 : 5} />
                  <path d={d} fill="none" stroke={fait ? '#e8c267' : actif ? T.accent : '#5d6a78'} strokeWidth={fait || actif ? 3 : 2.2} strokeLinecap="round" />
                </g>
              )
            }))}
          </svg>
          {/* Nœuds */}
          {elements.map((t) => {
            const p = layout.pos[t.id]; if (!p) return null
            return <Noeud key={t.id} t={t} p={p} st={statut(t)} progr={progression(t)} delai={delai(t)} cout={cout(t)}
                          deb={debloque(t)} couleur={coulBranche(t.branche)} T={T} busy={busy === t.id}
                          onEnter={() => setSurvol(t.id)} onLeave={() => setSurvol((s) => (s === t.id ? null : s))}
                          onClick={() => onAction(t)} />
          })}
        </div>
      </div>
      {/* Fiche détaillée */}
      <div className="flex min-h-[92px] items-center gap-4 border-t border-bronze-dark/60 bg-black/50 px-5 py-3">
        {detail ? (
          <>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2"
                 style={{ borderColor: coulBranche(detail.branche), background: 'radial-gradient(circle at 40% 35%, #2a3c50, #0c141c)', color: '#f1e3c0' }}>
              <IconeSavoir id={detail.id} taille={44} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-lg font-bold text-parchment">{detail.nom}</span>
                <span className="text-xs uppercase tracking-widest" style={{ color: coulBranche(detail.branche) }}>{(branches.find((b) => b.id === detail.branche) || {}).nom}</span>
              </div>
              <div className="text-sm text-emerald-200/90">{detail.effet}</div>
              {detail.description && <div className="mt-0.5 line-clamp-2 text-xs italic text-parchment/60">{detail.description}</div>}
            </div>
            <div className="shrink-0 text-right text-xs text-parchment/70">
              <div>{cout(detail)}</div>
              <div className="mt-1 font-display tracking-wider" style={{ color: T.accent }}>{libelleAction(detail)}</div>
            </div>
          </>
        ) : (
          <span className="text-sm italic text-parchment/50">Survolez une case pour la détailler ; cliquez pour {theme === 'savoir' ? 'lancer la recherche' : 'adopter le dogme'}.</span>
        )}
      </div>
    </div>
  )
}

function Noeud({ t, p, st, progr, delai, deb, couleur, T, busy, onEnter, onLeave, onClick }) {
  const acquise = st === 'acquise', encours = st === 'encours', verrou = st === 'verrou' || st === 'cher'
  const anneau = acquise ? '#e8c267' : encours ? T.accent : verrou ? '#4a5260' : couleur
  const R = 31, circ = 2 * Math.PI * (R - 3)
  return (
    <button onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick} disabled={busy}
            className={'group absolute text-left transition-transform duration-150 ' + (verrou ? '' : 'hover:-translate-y-0.5')}
            style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H, cursor: acquise ? 'default' : 'pointer' }}>
      {/* Cartouche */}
      <div className="absolute flex flex-col justify-center rounded-r-full pl-12 pr-6"
           style={{
             left: 30, right: 0, top: 10, bottom: 10,
             background: acquise ? 'linear-gradient(90deg, rgba(232,194,103,0.30), rgba(120,90,30,0.25))'
               : encours ? `linear-gradient(90deg, ${T.accent}40, rgba(10,20,30,0.85))`
               : 'linear-gradient(90deg, rgba(36,46,58,0.95), rgba(14,20,28,0.95))',
             border: `1.5px solid ${acquise ? '#c9a227' : encours ? T.accent : verrou ? '#2f3743' : couleur + 'aa'}`,
             boxShadow: encours ? `0 0 16px ${T.accent}55` : '0 4px 10px rgba(0,0,0,0.45)',
             opacity: verrou ? 0.62 : 1,
           }}>
        <div className="flex items-center justify-between gap-2">
          <span className={'truncate font-display text-[12.5px] font-bold tracking-wide ' + (acquise ? 'text-gold' : 'text-parchment')}>{t.nom}</span>
          <span className="shrink-0 text-[11px] font-semibold" style={{ color: acquise ? '#e8c267' : T.accent }}>
            {acquise ? '✓' : delai || ''}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          {deb.map((u) => (
            <span key={u.cle} title={u.libelle} className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-gold/50 bg-black/50 text-gold">
              {u.type === 'unite' ? <UnitIcon type={u.id} size={12} /> : <UiIcon id="merveille" size={11} />}
            </span>
          ))}
          <span className="truncate text-[10.5px] text-parchment/60">{t.effet}</span>
        </div>
      </div>
      {/* Médaillon */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2" style={{ width: R * 2, height: R * 2 }}>
        <svg width={R * 2} height={R * 2} className="absolute inset-0">
          <defs>
            <radialGradient id={`n-${t.id}`} cx="0.4" cy="0.35" r="0.75">
              <stop offset="0" stopColor={acquise ? '#5a4520' : '#2c4256'} /><stop offset="1" stopColor={acquise ? '#1e160a' : '#0b131b'} />
            </radialGradient>
          </defs>
          <circle cx={R} cy={R} r={R - 1} fill="#000" opacity="0.5" />
          <circle cx={R} cy={R} r={R - 3} fill={`url(#n-${t.id})`} stroke={anneau} strokeWidth="3" />
          {encours && progr > 0 && (
            <circle cx={R} cy={R} r={R - 3} fill="none" stroke={T.accent} strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${circ * progr} ${circ}`} transform={`rotate(-90 ${R} ${R})`} />
          )}
          <circle cx={R} cy={R} r={R - 7} fill="none" stroke="#fff" strokeOpacity="0.08" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center" style={{ color: verrou ? '#8a8f96' : '#f4e7c6' }}>
          <IconeSavoir id={t.id} taille={36} />
        </div>
        {acquise && <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-black/60 bg-gold text-[11px] font-bold text-ink">✓</span>}
      </div>
    </button>
  )
}
