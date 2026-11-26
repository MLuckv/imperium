import { useState } from 'react'
import { postAction } from '../api'
import { factionColor, factionLabel, leaderName, reputationTone, num } from '../lib/format'
import MessageThread, { IconeAmorce } from './MessageThread'
import Medaillon from './Medaillon'
import Embleme from './Emblemes'

// Audience avec un souverain, façon Civilization : le dirigeant à gauche (grande
// effigie, relation, traités), l'échange à droite. S'OUVRE SUR LA MESSAGERIE ;
// l'onglet « Diplomatie » regroupe les actions formelles (guerre, paix, route
// commerciale, ambassadeur, dons).

const TITRES = {
  rome: 'Empereur de Rome',
  carthage: "Pharaon d'Égypte",
  macedoine: 'Roi de Macédoine, Hégémon des Grecs',
  sparte: 'Roi de Sparte',
  francs: "La Pucelle d'Orléans",
  bretons: 'Haut-Roi des Bretons',
}
const TRAITE_LABEL = {
  alliance: ['alliance', 'Alliance'], non_agression: ['paix', 'Pacte de non-agression'],
  route_commerciale: ['commerce', 'Route commerciale'], commercial: ['commerce', 'Route commerciale'], traite_commercial: ['commerce', 'Route commerciale'],
}

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
  const s = Math.max(-100, Math.min(100, score || 0))

  const guerres = (state && state.diplomatie && state.diplomatie.guerres_actives) || []
  const enGuerre = guerres.some((g) => g && new Set([g.a, g.b, g.attaquant, g.defenseur]).has(cible)
    && new Set([g.a, g.b, g.attaquant, g.defenseur]).has(joueurId))
  const traites = (state && state.diplomatie && state.diplomatie.traites_actifs) || []
  const parties = (t) => (t.parties && t.parties.length ? t.parties : [t.a, t.b].filter(Boolean))
  const traitesCiv = traites.filter((t) => parties(t).includes(cible) && parties(t).includes(joueurId))
  const allie = traitesCiv.some((t) => t.type === 'alliance')
  const aRoute = traitesCiv.some((t) => /commercial/.test(t.type))
  // Revenu de la route commerciale avec cette puissance (lu dans la ventilation de l'or).
  const routeOr = ((joueur.production_detail || {}).or || []).find((l) => l.source === `Route commerciale (${civ.nom || nomCiv})`)
  const or = (joueur.ressources && joueur.ressources.or) || 0
  const statut = enGuerre ? { t: 'En guerre', c: 'statut-guerre' } : allie ? { t: 'Alliés', c: 'statut-allie' } : { t: 'En paix', c: 'statut-paix' }

  async function action(type, params) {
    setBusy(type); setFlash(null)
    try {
      const r = await postAction({ type, cible, texte: null, params: params || {} })
      setFlash({ ok: !!(r && r.valide), text: (r && r.raison) || 'Traité.', suggestion: r && r.suggestion })
      if (r && r.valide && r.state && typeof onStateChange === 'function') onStateChange(r.state)
    } catch (err) { setFlash({ ok: false, text: err.message || 'Échec' }) }
    finally { setBusy(null) }
  }

  const actions = [
    enGuerre
      ? { type: 'demander_paix', icone: 'paix', titre: 'Demander la paix', texte: 'Proposer de déposer les armes. Le vaincu paie souvent tribut.', ton: 'or' }
      : { type: 'declarer_guerre', icone: 'avertir', titre: 'Déclarer la guerre', texte: 'Rompre tout traité et marcher sur ses provinces. Vos voisins s’en souviendront.', ton: 'guerre' },
    { type: 'traite_commercial', icone: 'commerce', titre: 'Route commerciale', texte: aRoute ? 'Déjà ouverte : vos caravanes circulent.' : '+5 or/mois chacun, davantage avec marchés et ports. Refusée si les relations sont froides.', off: aRoute },
    { type: 'envoyer_ambassadeur', icone: 'intentions', titre: 'Envoyer un ambassadeur', texte: 'Établir une présence à sa cour : relations un peu meilleures, intentions mieux connues.' },
    { type: 'envoyer_ressources', params: { ressources: { or: 50 } }, icone: 'don', titre: 'Offrir 50 or', texte: or < 50 ? `Trésor insuffisant (${num(or)} or).` : 'Un présent ouvre les portes et adoucit les rancunes.', off: or < 50 },
  ]

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div className="fenetre grid h-[84vh] w-full max-w-5xl grid-cols-[270px_1fr] overflow-hidden"
           onClick={(e) => e.stopPropagation()}>
        {/* ---- Le souverain */}
        <aside className="audience-portrait" style={{ '--c': accent }}>
          <div className="audience-filigrane"><Embleme faction={cible} taille={300} /></div>
          <div className="relative flex flex-col items-center px-5 pt-7 text-center">
            <div className="audience-aureole"><Medaillon faction={cible} taille={156} className="drop-shadow-[0_8px_14px_rgba(0,0,0,0.7)]" /></div>
            <div className="mt-4 font-display text-xl font-bold tracking-wide text-parchment">{leader}</div>
            <div className="mt-0.5 font-serif text-[13px] italic text-parchment/65">{TITRES[cible] || nomCiv}</div>
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              <span className={'statut-ruban ' + statut.c}>{statut.t}</span>
            </div>
          </div>
          <div className="relative mt-5 space-y-4 px-5">
            <div>
              <div className="flex justify-between text-[10px] uppercase tracking-[0.14em] text-parchment/50">
                <span>Opinion de vous</span>
                <span className={tone.className + ' normal-case tracking-normal font-semibold'}>{tone.label}{score != null && ` (${score > 0 ? '+' : ''}${num(score)})`}</span>
              </div>
              <span className="jauge-opinion">
                <span className="jauge-opinion-milieu" />
                <span className="jauge-opinion-rempli" style={{ left: s < 0 ? `${50 + s / 2}%` : '50%', width: `${Math.abs(s) / 2}%`, background: tone.bar }} />
                <span className="jauge-opinion-curseur" style={{ left: `${50 + s / 2}%` }} />
              </span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-parchment/50">Traités en vigueur</div>
              {traitesCiv.length === 0
                ? <div className="mt-1 font-serif text-[13px] italic text-parchment/45">Aucun accord ne vous lie.</div>
                : <ul className="mt-1 space-y-1">
                    {traitesCiv.map((t, i) => {
                      const [ic, lib] = TRAITE_LABEL[t.type] || ['paix', t.type]
                      return (
                        <li key={t.type + i} className="flex items-center gap-2 text-[13px] text-parchment/85">
                          <span className="hud-ico !h-6 !w-6"><IconeAmorce id={ic} size={13} /></span>
                          <span className="flex-1">{lib}</span>
                          {/commercial/.test(t.type) && routeOr && <span className="text-[12px] font-semibold text-gold">+{Math.round(routeOr.val)} or</span>}
                        </li>
                      )
                    })}
                  </ul>}
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="pastille-stat">{(civ.territoires || []).length} province{(civ.territoires || []).length > 1 ? 's' : ''}</span>
              <span className="pastille-stat">{(civ.unites || []).length} armée{(civ.unites || []).length > 1 ? 's' : ''}</span>
            </div>
          </div>
        </aside>

        {/* ---- L'échange */}
        <section className="flex min-h-0 flex-col">
          <div className="flex items-end gap-1 border-b border-bronze-dark/50 px-4 pt-3">
            <Tab active={tab === 'messages'} onClick={() => setTab('messages')}>Audience</Tab>
            <Tab active={tab === 'diplomatie'} onClick={() => setTab('diplomatie')}>Actions diplomatiques</Tab>
            <span className="flex-1" />
            <button onClick={onClose} className="btn btn-ghost btn-sm mb-2">Fermer</button>
          </div>

          {tab === 'messages' && (
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-1">
              <MessageThread cible={cible} leaderName={leader} joueurName={joueur.nom || 'Vous'} joueurId={joueurId} />
            </div>
          )}

          {tab === 'diplomatie' && (
            <div className="thin-scroll flex-1 overflow-y-auto p-5">
              {flash && (
                <div className={'mb-4 rounded-md border px-3 py-2 text-sm ' + (flash.ok ? 'border-emerald-700/50 bg-emerald-950/40 text-emerald-100' : 'border-red-800/50 bg-red-950/40 text-red-100')}>
                  {flash.text}{flash.suggestion ? <span className="italic opacity-80"> — {flash.suggestion}</span> : null}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {actions.map((a) => (
                  <button key={a.type} onClick={() => action(a.type, a.params)} disabled={!!busy || a.off}
                          className={'carte-action ' + (a.ton === 'guerre' ? 'carte-action-guerre' : a.ton === 'or' ? 'carte-action-or' : '')}>
                    <span className="medaillon-prod !h-12 !w-12 shrink-0"><IconeAmorce id={a.icone} size={24} /></span>
                    <span className="min-w-0">
                      <span className="block font-display text-[15px] font-bold tracking-wide">{busy === a.type ? '…' : a.titre}</span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-parchment/60">{a.texte}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-5 flex items-start gap-3 rounded-md border border-bronze-dark/40 bg-black/20 p-3">
                <span className="hud-ico shrink-0"><IconeAmorce id="intentions" size={14} /></span>
                <p className="font-serif text-[13px] italic leading-snug text-parchment/60">
                  Tout se négocie aussi de vive voix dans l’Audience : route commerciale, pacte de non-agression,
                  alliance, tribut, paix. Quand les deux parties concluent clairement, l’accord s’applique à la fin du tour.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Tab({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={'onglet-civ ' + (active ? 'onglet-civ-actif' : '')}>
      {children}
    </button>
  )
}
