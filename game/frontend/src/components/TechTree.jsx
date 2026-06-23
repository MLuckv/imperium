import { useEffect, useMemo, useState } from 'react'
import { getTechTree, postAction } from '../api'

// Arbre technologique : vrai GRAPHE de dépendances. Les colonnes = profondeur de
// prérequis ; des traits relient chaque prérequis à la techno qu'il débloque.

const BRANCH_TINT = {
  militaire: '#c0392b', economie: '#c9a227', culture: '#1e8449',
  construction: '#8a8a82', default: '#a07d2c',
}
const CARD_W = 184, CARD_H = 96, GAP_X = 52, GAP_Y = 16, PAD = 20

export default function TechTree({ state, onClose, onStateChange }) {
  const [tree, setTree] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)

  const joueurId = state && state.meta && state.meta.joueur_pays
  const joueur = joueurId && state.pays ? state.pays[joueurId] : null
  const connues = useMemo(() => new Set((joueur && joueur.technologies) || []), [joueur])
  const enCours = joueur && joueur.recherche_en_cours

  useEffect(() => {
    let cancel = false
    getTechTree().then((d) => !cancel && setTree(d)).catch((e) => !cancel && setError(e.message || 'Indisponible'))
    return () => { cancel = true }
  }, [])

  const techs = (tree && tree.technologies) || []
  const byId = useMemo(() => Object.fromEntries(techs.map((t) => [t.id, t])), [techs])

  // Profondeur = plus longue chaîne de prérequis.
  const layout = useMemo(() => {
    const depthMemo = {}
    const depth = (id, seen = new Set()) => {
      if (depthMemo[id] != null) return depthMemo[id]
      if (seen.has(id)) return 0
      seen.add(id)
      const t = byId[id]
      const pre = (t && t.prerequis) || []
      const d = pre.length ? 1 + Math.max(...pre.map((p) => depth(p, seen))) : 0
      depthMemo[id] = d
      return d
    }
    const cols = {}
    for (const t of techs) {
      const d = depth(t.id)
      ;(cols[d] = cols[d] || []).push(t)
    }
    const pos = {}
    let maxRows = 0
    Object.keys(cols).map(Number).sort((a, b) => a - b).forEach((d) => {
      const list = cols[d].sort((a, b) => (a.branche || '').localeCompare(b.branche || '') || a.nom.localeCompare(b.nom))
      list.forEach((t, r) => { pos[t.id] = { x: PAD + d * (CARD_W + GAP_X), y: PAD + r * (CARD_H + GAP_Y) } })
      maxRows = Math.max(maxRows, list.length)
    })
    const ncols = Object.keys(cols).length
    return { pos, w: PAD * 2 + ncols * CARD_W + (ncols - 1) * GAP_X, h: PAD * 2 + maxRows * (CARD_H + GAP_Y) }
  }, [techs, byId])

  async function research(t) {
    setBusy(t.id); setMsg(null)
    try {
      const r = await postAction({ type: 'rechercher', params: { tech: t.id } })
      setMsg({ ok: !!(r && r.valide), text: (r && r.raison) || 'Traité.' })
      if (r && r.valide && r.state) onStateChange(r.state)
    } catch (e) { setMsg({ ok: false, text: e.message || 'Échec' }) }
    finally { setBusy(null) }
  }

  function statut(t) {
    if (connues.has(t.id)) return 'acquise'
    if (enCours && enCours.tech === t.id) return 'encours'
    if ((t.prerequis || []).every((p) => connues.has(p))) return 'dispo'
    return 'verrou'
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-bronze-dark bg-night shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-bronze-dark/60 px-4 py-3">
          <h2 className="font-display text-lg font-bold tracking-wide text-gold">Arbre technologique</h2>
          <div className="flex items-center gap-3">
            {enCours && enCours.tech && (
              <span className="text-xs text-amber-200">Recherche : {byId[enCours.tech] ? byId[enCours.tech].nom : enCours.tech} ({Math.round(enCours.progres || 0)}/{enCours.cout || '?'})</span>
            )}
            <button onClick={onClose} className="btn btn-ghost btn-sm">Fermer</button>
          </div>
        </div>
        {msg && <div className={'px-4 py-1.5 text-sm ' + (msg.ok ? 'bg-emerald-950/40 text-emerald-100' : 'bg-red-950/40 text-red-100')}>{msg.text}</div>}
        {error && <div className="p-4 text-red-200">{error}</div>}

        <div className="thin-scroll flex-1 overflow-auto p-2">
          <div className="relative" style={{ width: layout.w, height: layout.h }}>
            {/* Traits de dépendance */}
            <svg className="pointer-events-none absolute inset-0" width={layout.w} height={layout.h}>
              {techs.map((t) => (t.prerequis || []).map((p) => {
                const a = layout.pos[p], b = layout.pos[t.id]
                if (!a || !b) return null
                const x1 = a.x + CARD_W, y1 = a.y + CARD_H / 2, x2 = b.x, y2 = b.y + CARD_H / 2
                const mx = (x1 + x2) / 2
                const done = connues.has(p)
                return <path key={p + '>' + t.id} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                             fill="none" stroke={done ? '#c9a227' : '#5b4a26'} strokeWidth={done ? 2 : 1.4} opacity={done ? 0.9 : 0.55} />
              }))}
            </svg>
            {/* Cartes */}
            {techs.map((t) => {
              const p = layout.pos[t.id]; if (!p) return null
              const st = statut(t); const tint = BRANCH_TINT[t.branche] || BRANCH_TINT.default
              const border = st === 'acquise' ? '#2f7d4f' : st === 'encours' ? '#c08a2a' : st === 'dispo' ? tint : '#3a3326'
              return (
                <div key={t.id} className="absolute rounded-md border bg-[#1c1813] p-2 shadow"
                     style={{ left: p.x, top: p.y, width: CARD_W, height: CARD_H, borderColor: border, borderLeftWidth: 4, borderLeftColor: tint, opacity: st === 'verrou' ? 0.6 : 1 }}>
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-sm font-semibold leading-tight text-parchment">{t.nom}</span>
                    <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase"
                          style={{ background: border + '33', color: border === '#3a3326' ? '#b9ae93' : border }}>
                      {st === 'acquise' ? 'Acquise' : st === 'encours' ? 'En cours' : st === 'dispo' ? 'Dispo' : 'Verrou'}
                    </span>
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[10px] text-bronze/90">{t.effet}</div>
                  <div className="absolute inset-x-2 bottom-1.5 flex items-center justify-between text-[10px] text-parchment/50">
                    <span>Coût {t.cout_recherche}</span>
                    {st !== 'acquise' && (
                      <button onClick={() => research(t)} disabled={st === 'verrou' || !!busy}
                              className="rounded bg-bronze px-1.5 py-0.5 text-[10px] font-semibold text-ink hover:bg-bronze-dark hover:text-parchment disabled:opacity-40">
                        {busy === t.id ? '…' : st === 'encours' ? 'Continuer' : 'Rechercher'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
