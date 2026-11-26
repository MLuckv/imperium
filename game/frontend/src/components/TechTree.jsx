import { useEffect, useMemo, useState } from 'react'
import { getTechTree, getCatalog, postAction } from '../api'
import ArbreCiv from './ArbreCiv'

// Arbre technologique façon Civilization (cf. ArbreCiv) : une recherche à la fois,
// un clic sur une case disponible la lance (le progrès acquis n'est pas perdu).

const BRANCHES = [
  { id: 'militaire', nom: 'Militaire', couleur: '#d0564a' },
  { id: 'economie', nom: 'Économie', couleur: '#d9ad3c' },
  { id: 'culture', nom: 'Culture', couleur: '#4fb37a' },
  { id: 'construction', nom: 'Construction', couleur: '#a3a39a' },
]
const NOMS_UNITES = { elephant: 'Éléphant de guerre' }

export default function TechTree({ state, onClose, onStateChange }) {
  const [tree, setTree] = useState(null)
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)

  const joueurId = state && state.meta && state.meta.joueur_pays
  const joueur = joueurId && state.pays ? state.pays[joueurId] : null
  const connues = useMemo(() => new Set((joueur && joueur.technologies) || []), [joueur])
  const enCours = joueur && joueur.recherche_en_cours
  const ptsTour = (joueur && joueur.recherche_points) || 0
  const toursPour = (c, progres = 0) => (ptsTour > 0 ? Math.max(1, Math.ceil((c - progres) / ptsTour)) : null)

  useEffect(() => {
    let cancel = false
    getTechTree().then((d) => !cancel && setTree(d)).catch((e) => !cancel && setError(e.message || 'Indisponible'))
    getCatalog().then((d) => !cancel && setCatalog(d)).catch(() => {})
    return () => { cancel = true }
  }, [])

  const techs = (tree && tree.technologies) || []
  const byId = useMemo(() => Object.fromEntries(techs.map((t) => [t.id, t])), [techs])
  const debloquages = useMemo(() => {
    const m = {}
    for (const u of (catalog && catalog.unites) || []) if (u.tech_requise) (m[u.tech_requise] = m[u.tech_requise] || []).push({ cle: 'u' + u.id, type: 'unite', id: u.id, libelle: `Débloque : ${NOMS_UNITES[u.id] || u.id}` })
    for (const w of (catalog && catalog.merveilles) || []) if (w.tech_requise) (m[w.tech_requise] = m[w.tech_requise] || []).push({ cle: 'm' + w.id, type: 'merveille', id: w.id, libelle: `Merveille : ${w.nom}` })
    return m
  }, [catalog])

  function statut(t) {
    if (connues.has(t.id)) return 'acquise'
    if (enCours && enCours.tech === t.id) return 'encours'
    if ((t.prerequis || []).every((p) => connues.has(p))) return 'dispo'
    return 'verrou'
  }

  async function rechercher(t) {
    const st = statut(t)
    if (st === 'acquise' || st === 'verrou' || st === 'encours') {
      if (st === 'verrou') setMsg({ ok: false, text: `Il faut d'abord : ${(t.prerequis || []).filter((p) => !connues.has(p)).map((p) => (byId[p] || {}).nom || p).join(', ')}.` })
      return
    }
    setBusy(t.id); setMsg(null)
    try {
      const r = await postAction({ type: 'rechercher', params: { tech: t.id } })
      setMsg({ ok: !!(r && r.valide), text: (r && r.raison) || 'Traité.' })
      if (r && r.valide && r.state) onStateChange(r.state)
    } catch (e) { setMsg({ ok: false, text: e.message || 'Échec' }) }
    finally { setBusy(null) }
  }

  const courante = enCours && byId[enCours.tech]
  const frac = courante ? Math.min(1, (enCours.progres || 0) / (enCours.cout || 1)) : 0

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="fenetre flex h-[90vh] w-full max-w-[1400px] flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-4 border-b border-bronze-dark/60 px-5 py-3">
          <h2 className="font-display text-xl font-bold tracking-[0.12em] text-gold">Arbre technologique</h2>
          {courante && (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="truncate text-sm text-parchment/80">Recherche : <b className="text-[#6fd0f0]">{courante.nom}</b></span>
              <div className="h-2 w-48 overflow-hidden rounded-full bg-black/50"><div className="h-full rounded-full bg-[#6fd0f0]" style={{ width: `${frac * 100}%` }} /></div>
              <span className="text-xs text-parchment/60">{Math.round(enCours.progres || 0)}/{enCours.cout} · +{Math.round(ptsTour)}/tour{toursPour(enCours.cout || 0, enCours.progres || 0) ? ` · ${toursPour(enCours.cout || 0, enCours.progres || 0)} t` : ''}</span>
            </div>
          )}
          {!courante && <span className="flex-1 text-sm italic text-parchment/50">Aucune recherche en cours — choisissez une case disponible.</span>}
          <button onClick={onClose} className="btn btn-ghost btn-sm">Fermer</button>
        </div>
        {msg && <div className={'px-5 py-1.5 text-sm ' + (msg.ok ? 'bg-emerald-950/50 text-emerald-100' : 'bg-red-950/50 text-red-100')}>{msg.text}</div>}
        {error && <div className="p-4 text-red-200">{error}</div>}
        <ArbreCiv elements={techs} branches={BRANCHES} theme="savoir" statut={statut} busy={busy}
                  progression={(t) => (enCours && enCours.tech === t.id ? frac : 0)}
                  delai={(t) => { const s = statut(t); if (s === 'encours') return `${toursPour(enCours.cout || 0, enCours.progres || 0) || '?'} t`; if (s === 'dispo') { const n = toursPour(t.cout_recherche); return n ? `${n} t` : '' } return '' }}
                  cout={(t) => `Coût : ${t.cout_recherche} points de recherche`}
                  debloque={(t) => debloquages[t.id] || []}
                  libelleAction={(t) => ({ acquise: 'Acquise', encours: 'En cours', dispo: 'Cliquer pour rechercher', verrou: 'Prérequis manquants' })[statut(t)]}
                  onAction={rechercher} />
      </div>
    </div>
  )
}
