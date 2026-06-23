import { useState } from 'react'
import { postAction } from '../api'
import { factionColor, factionLabel, leaderName, reputationTone, num } from '../lib/format'
import MessageThread from './MessageThread'
import { FactionEmblem } from './Icons'

// Panneau d'une civilisation, ouvert au clic sur celle-ci.
// S'OUVRE SUR LA MESSAGERIE par défaut ; un bouton en haut bascule vers le menu
// DIPLOMATIE (relation + actions : guerre, paix, traité, ambassadeur, dons).

export default function DiplomacyModal({ cible, state, onClose, onStateChange }) {
  const [tab, setTab] = useState('messages') // 'messages' | 'diplomatie'
  const [busy, setBusy] = useState(null)
  const [flash, setFlash] = useState(null)

  const pays = (state && state.pays) || {}
  const joueurId = state && state.meta && state.meta.joueur_pays
  const joueur = pays[joueurId] || {}
  const civ = pays[cible] || {}
  const nomCiv = factionLabel(cible, civ.nom)
  const leader = leaderName(cible)
  const accent = civ.couleur || factionColor(cible)
  const score = (joueur.reputation || {})[cible]
  const tone = reputationTone(score)

  const guerres = (state && state.diplomatie && state.diplomatie.guerres_actives) || []
  const enGuerre = guerres.some((g) => g && new Set([g.a, g.b, g.attaquant, g.defenseur]).has(cible)
    && new Set([g.a, g.b, g.attaquant, g.defenseur]).has(joueurId))
  const traites = (state && state.diplomatie && state.diplomatie.traites_actifs) || []
  const traitesCiv = traites.filter((t) => (t.parties || []).includes(cible))
  const or = (joueur.ressources && joueur.ressources.or) || 0

  async function action(type, params) {
    setBusy(type); setFlash(null)
    try {
      const r = await postAction({ type, cible, texte: null, params: params || {} })
      setFlash({ ok: !!(r && r.valide), text: (r && r.raison) || 'Traité.', suggestion: r && r.suggestion })
      if (r && r.valide && r.state && typeof onStateChange === 'function') onStateChange(r.state)
    } catch (err) { setFlash({ ok: false, text: err.message || 'Échec' }) }
    finally { setBusy(null) }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="flex h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-bronze-dark bg-night shadow-2xl"
           onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div className="flex items-center gap-3 border-b border-bronze-dark/60 px-4 py-3"
             style={{ background: `linear-gradient(90deg, ${accent}33, transparent)` }}>
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-black/50" style={{ backgroundColor: accent + '33' }}>
            <FactionEmblem faction={cible} size={24} style={{ color: accent }} />
          </span>
          <div className="flex-1">
            <div className="font-display text-lg font-bold text-parchment">{leader}</div>
            <div className="text-xs text-parchment/60">
              {nomCiv}
              {enGuerre && <span className="chip chip-war ml-2">Guerre</span>}
            </div>
          </div>
          <div className="text-right">
            <div className={'text-sm font-semibold ' + tone.className}>{tone.label}</div>
            {score != null && <div className="text-xs text-parchment/50">{score > 0 ? '+' : ''}{num(score)}</div>}
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm ml-2">Fermer</button>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 border-b border-bronze-dark/40 px-3 pt-2">
          <Tab active={tab === 'messages'} onClick={() => setTab('messages')}>Messages</Tab>
          <Tab active={tab === 'diplomatie'} onClick={() => setTab('diplomatie')}>Diplomatie</Tab>
        </div>

        {tab === 'messages' && (
          <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2">
            <MessageThread cible={cible} leaderName={leader} joueurName={joueur.nom || 'Vous'} />
          </div>
        )}

        {tab === 'diplomatie' && (
          <div className="thin-scroll flex-1 overflow-y-auto p-4">
            {flash && (
              <div className={'mb-3 rounded px-3 py-1.5 text-sm ' + (flash.ok ? 'bg-emerald-950/40 text-emerald-100' : 'bg-red-950/40 text-red-100')}>
                {flash.text}{flash.suggestion ? <span className="italic opacity-80"> — {flash.suggestion}</span> : null}
              </div>
            )}
            <div className="mb-4 rounded-md border border-bronze-dark/40 bg-black/20 p-3 text-sm">
              <div>Relation avec <b style={{ color: accent }}>{nomCiv}</b> : <span className={tone.className}>{tone.label}{score != null && ` (${score > 0 ? '+' : ''}${num(score)})`}</span></div>
              {traitesCiv.length > 0 && <div className="mt-1 text-xs text-emerald-200/80">Traités actifs : {traitesCiv.map((t) => t.type).join(', ')}</div>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {enGuerre
                ? <button onClick={() => action('demander_paix')} disabled={busy === 'demander_paix'} className="btn btn-primary">Demander la paix</button>
                : <button onClick={() => action('declarer_guerre')} disabled={busy === 'declarer_guerre'} className="btn btn-danger">Déclarer la guerre</button>}
              <button onClick={() => action('traite_commercial')} disabled={busy === 'traite_commercial'} className="btn btn-ghost">Traité commercial</button>
              <button onClick={() => action('envoyer_ambassadeur')} disabled={busy === 'envoyer_ambassadeur'} className="btn btn-ghost">Envoyer un ambassadeur</button>
              <button onClick={() => action('envoyer_ressources', { ressources: { or: 50 } })} disabled={busy === 'envoyer_ressources' || or < 50} className="btn btn-ghost">Offrir 50 or</button>
            </div>
            <p className="mt-3 text-xs text-parchment/40">Astuce : la messagerie (onglet « Messages ») permet de négocier ; les accords conclus sont appliqués en fin de tour.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Tab({ active, onClick, children }) {
  return (
    <button onClick={onClick}
            className={'rounded-t-md px-4 py-1.5 text-sm font-semibold transition ' +
              (active ? 'bg-night text-gold border-b-2 border-bronze' : 'text-parchment/60 hover:text-parchment')}>
      {children}
    </button>
  )
}
