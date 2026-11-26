import { useEffect, useMemo, useState } from 'react'
import { getDogmeTree, postAction } from '../api'
import ArbreCiv from './ArbreCiv'

// Arbre des DOGMES façon « dogmes » de Civilization (cf. ArbreCiv) : adoption
// payée en or, effets permanents (stabilité, or, coûts d'expansion…).

const BRANCHES = [
  { id: 'civique', nom: 'Civique', couleur: '#d9ad3c' },
  { id: 'foi', nom: 'Foi', couleur: '#b98ae0' },
  { id: 'expansion', nom: 'Expansion', couleur: '#d0564a' },
]

export default function DogmeTree({ state, onClose, onStateChange }) {
  const [tree, setTree] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)

  const joueurId = state && state.meta && state.meta.joueur_pays
  const joueur = joueurId && state.pays ? state.pays[joueurId] : null
  const or = (joueur && joueur.ressources && joueur.ressources.or) || 0
  const adoptes = useMemo(() => new Set((joueur && joueur.dogmes) || []), [joueur])
  const remise = ((joueur && joueur.merveilles_effet && joueur.merveilles_effet.speciaux) || []).includes('dogmes_moins_chers') ? 0.7 : 1

  useEffect(() => {
    let cancel = false
    getDogmeTree().then((d) => !cancel && setTree(d)).catch((e) => !cancel && setError(e.message || 'Indisponible'))
    return () => { cancel = true }
  }, [])

  const dogmes = (tree && tree.dogmes) || []
  const byId = useMemo(() => Object.fromEntries(dogmes.map((d) => [d.id, d])), [dogmes])
  const prix = (t) => Math.round((t.cout_or || 150) * remise)

  function statut(t) {
    if (adoptes.has(t.id)) return 'acquise'
    if (!(t.prerequis || []).every((p) => adoptes.has(p))) return 'verrou'
    return or >= prix(t) ? 'dispo' : 'cher'
  }

  async function adopter(t) {
    const st = statut(t)
    if (st === 'acquise') return
    if (st === 'verrou') { setMsg({ ok: false, text: `Il faut d'abord : ${(t.prerequis || []).filter((p) => !adoptes.has(p)).map((p) => (byId[p] || {}).nom || p).join(', ')}.` }); return }
    if (st === 'cher') { setMsg({ ok: false, text: `Il vous faut ${prix(t)} or (vous en avez ${Math.round(or)}).` }); return }
    setBusy(t.id); setMsg(null)
    try {
      const r = await postAction({ type: 'adopter_dogme', params: { dogme: t.id } })
      setMsg({ ok: !!(r && r.valide), text: (r && r.raison) || 'Traité.' })
      if (r && r.valide && r.state) onStateChange(r.state)
    } catch (e) { setMsg({ ok: false, text: e.message || 'Échec' }) }
    finally { setBusy(null) }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="fenetre flex h-[86vh] w-full max-w-[1100px] flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-4 border-b border-bronze-dark/60 px-5 py-3">
          <h2 className="font-display text-xl font-bold tracking-[0.12em] text-gold">Dogmes</h2>
          <span className="flex-1 text-sm text-parchment/60">{adoptes.size} adopté{adoptes.size > 1 ? 's' : ''} sur {dogmes.length}{remise < 1 && ' · Panthéon : −30 % sur le prix'}</span>
          <span className="text-sm text-parchment/70">Trésor : <b className="text-gold">{Math.round(or)}</b> or</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Fermer</button>
        </div>
        {msg && <div className={'px-5 py-1.5 text-sm ' + (msg.ok ? 'bg-emerald-950/50 text-emerald-100' : 'bg-red-950/50 text-red-100')}>{msg.text}</div>}
        {error && <div className="p-4 text-red-200">{error}</div>}
        <ArbreCiv elements={dogmes} branches={BRANCHES} theme="culture" statut={statut} busy={busy}
                  progression={() => 0}
                  delai={(t) => (statut(t) === 'acquise' ? '' : `${prix(t)} or`)}
                  cout={(t) => `Prix : ${prix(t)} or`}
                  debloque={() => []}
                  libelleAction={(t) => ({ acquise: 'Adopté', dispo: 'Cliquer pour adopter', cher: 'Or insuffisant', verrou: 'Prérequis manquants' })[statut(t)]}
                  onAction={adopter} />
      </div>
    </div>
  )
}
