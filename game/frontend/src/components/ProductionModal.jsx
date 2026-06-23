import { useEffect, useState } from 'react'
import { getCatalog, getMap, postAction } from '../api'
import { num } from '../lib/format'
import { BuildingIcon } from './Icons'
import WonderArt from './WonderArt'

// Modale de PRODUCTION, LIÉE À LA PROVINCE sélectionnée (forcedTerr).
// - Province avec ville : construction (1 à la fois), gouverneur, jeux.
// - Province sans ville : fonder une ville (colonisation).

export default function ProductionModal({ state, forcedTerr, onClose, onStateChange }) {
  const [catalog, setCatalog] = useState(null)
  const [noms, setNoms] = useState({})
  const [caps, setCaps] = useState(() => new Set())
  const [busy, setBusy] = useState(null)
  const [flash, setFlash] = useState(null)

  const joueurId = state && state.meta && state.meta.joueur_pays
  const joueur = (state && state.pays && state.pays[joueurId]) || {}
  const villes = joueur.villes || []
  const ress = joueur.ressources || {}
  const luxe = joueur.ressources_luxe || {}
  const or = ress.or || 0
  const terr = forcedTerr || (joueur.territoires || [])[0]
  const ville = villes.find((v) => v.territoire === terr) || null
  const estCapitale = caps.has(terr)
  const gMax = (joueur.gouverneurs_max != null) ? joueur.gouverneurs_max : 2
  const gAct = joueur.gouverneurs_actuels || 0
  const merveilles = (catalog && catalog.merveilles) || []
  const mervStatus = (state && state.merveilles) || {}
  const mervIci = merveilles.filter((m) => m.province === terr)
  const mervConstruct = merveilles.filter((m) => m.type === 'construction')

  useEffect(() => {
    let cancel = false
    getCatalog().then((d) => !cancel && setCatalog(d)).catch(() => !cancel && setCatalog({ batiments: [] }))
    getMap().then((m) => { if (!cancel) { const n = {}; const c = new Set(); for (const t of m.territoires || []) { n[t.id] = t.nom; if (t.capitale) c.add(t.id) } setNoms(n); setCaps(c) } }).catch(() => {})
    return () => { cancel = true }
  }, [])

  async function act(type, params, key) {
    setBusy(key || type); setFlash(null)
    try {
      const r = await postAction({ type, params })
      setFlash({ ok: !!(r && r.valide), text: (r && r.raison) || 'Traité.' })
      if (r && r.valide && r.state) onStateChange(r.state)
    } catch (e) { setFlash({ ok: false, text: e.message || 'Échec' }) }
    finally { setBusy(null) }
  }

  const batiments = (catalog && catalog.batiments) || []
  const fond = (catalog && catalog.fondation) || { cout_or: 220, colons: 6, penalite_stabilite: 6 }
  const dejaBatis = new Set((ville && ville.batiments) || [])
  const chantier = ville && ville.construction
  const nomProv = noms[terr] || terr

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between border-b border-bronze-dark/60 px-4 py-3">
        <h2 className="font-display text-lg font-bold tracking-wide text-gold">Production — {nomProv}</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-parchment/70">Trésor : <b className="text-gold">{num(or)}</b> or</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Fermer</button>
        </div>
      </div>

      {flash && <div className={'px-4 py-1.5 text-sm ' + (flash.ok ? 'bg-emerald-950/40 text-emerald-100' : 'bg-red-950/40 text-red-100')}>{flash.text}</div>}

      <div className="thin-scroll max-h-[72vh] overflow-y-auto p-4">
        {mervIci.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-widest text-gold/80">✦ Merveille</h3>
            {mervIci.map((m) => {
              const st = mervStatus[m.id] || {}
              const etat = st.etat
              const coutRes = m.cout_res || {}
              const have = (r) => (r === 'marbre' ? (luxe[r] || 0) : (ress[r] || 0))
              const resOk = or >= (m.cout_or || 0) && Object.entries(coutRes).every(([r, v]) => have(r) >= v)
              const coutTxt = `${m.cout_or || 0} or` + Object.entries(coutRes).map(([r, v]) => `, ${v} ${r}`).join('')
              const bonusTxt = Object.entries(m.bonus || {}).map(([k, v]) => fmtBonus(k, v)).join(', ')
              const ruine = m.type === 'ruine' && etat !== 'restauree'
              return (
                <div key={m.id} className="card mb-2 flex gap-3">
                  <div className="shrink-0 self-start overflow-hidden rounded-md border border-bronze-dark/50 bg-gradient-to-b from-[#211b12] to-black/40 p-1"
                       style={ruine ? { filter: 'grayscale(0.7) brightness(0.8)' } : undefined}>
                    <WonderArt id={m.id} size={96} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gold">{m.nom}</span>
                      <span className="chip">{ETAT_LABEL[etat] || etat}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-bronze/90">{m.desc}</div>
                    {bonusTxt && <div className="mt-0.5 text-[11px] text-emerald-300">Bonus : {bonusTxt} · prestige +{m.prestige}</div>}
                    {m.type === 'antique' && <div className="mt-1 text-[11px] text-parchment/55">Bonus actif tant que vous tenez la province.</div>}
                    {m.type === 'ruine' && etat === 'ruine' && (
                      <button disabled={!resOk || !!busy} onClick={() => act('restaurer_merveille', { merveille: m.id }, 'm' + m.id)}
                              className={'btn btn-primary btn-sm mt-1.5 ' + (resOk ? '' : 'opacity-50')}>Restaurer ({coutTxt} · {m.duree}t)</button>
                    )}
                    {m.type === 'fouille' && etat === 'site' && (
                      <button disabled={or < (m.cout_or || 0) || !!busy} onClick={() => act('fouiller_merveille', { merveille: m.id }, 'm' + m.id)}
                              className="btn btn-primary btn-sm mt-1.5">Lancer une fouille ({m.cout_or} or · {m.duree}t)</button>
                    )}
                    {['en_restauration', 'fouille_en_cours'].includes(etat) && st.chantier && (
                      <div className="mt-1 text-[11px] text-parchment/60">En cours : {st.chantier.duree - st.chantier.tours_restants}/{st.chantier.duree} tours</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {!ville ? (
          /* Province SANS ville → colonisation */
          <div className="rounded-md border border-bronze/40 bg-black/25 p-4 text-center">
            <p className="mb-1 text-sm text-parchment/85">Aucune ville dans <b className="text-gold">{nomProv}</b>.</p>
            <p className="mb-3 text-xs text-parchment/55">Fondez-y une ville pour pouvoir y produire (coûteux : la colonie débute instable, en pacification 3 tours).</p>
            <button disabled={or < fond.cout_or || !!busy} onClick={() => act('fonder_ville', { territoire: terr }, 'fonder')} className="btn btn-primary">
              Fonder une ville ({fond.cout_or} or · {fond.colons} colons · stabilité −{fond.penalite_stabilite})
            </button>
          </div>
        ) : (
          <>
            {chantier && (
              <div className="mb-4 rounded-md border border-bronze/40 bg-black/25 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-gold">En construction : {nomBat(batiments, chantier.batiment)}</span>
                  <span className="text-parchment/70">{chantier.duree - chantier.tours_restants}/{chantier.duree} tours</span>
                </div>
                <div className="progress mt-2"><div className="progress-bar" style={{ width: `${Math.round(100 * (chantier.duree - chantier.tours_restants) / chantier.duree)}%` }} /></div>
                <div className="mt-1 text-xs text-parchment/50">Une seule construction à la fois.</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {batiments.map((b) => {
                const built = dejaBatis.has(b.id)
                const coutRes = b.cout_res || {}
                const resOk = Object.entries(coutRes).every(([rr, v]) => (ress[rr] || 0) >= v)
                const affordable = or >= b.cout && resOk
                const blocked = !!chantier
                const dis = built || !affordable || blocked || !!busy
                const coutTxt = `${b.cout} or` + Object.entries(coutRes).map(([rr, v]) => `, ${v} ${rr}`).join('')
                return (
                  <button key={b.id} disabled={dis} title={b.effet}
                          onClick={() => act('construire', { batiment: b.id, ville: ville.id }, 'b' + b.id)}
                          className={'card text-left ' + (built ? 'card-selected' : dis ? 'card-disabled' : '')}>
                    <div className="flex items-center gap-2">
                      <BuildingIcon id={b.id} className="shrink-0 text-bronze" size={22} />
                      <span className="text-sm font-semibold">{b.nom}{built ? ' ✓' : ''}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-bronze/90">{b.effet}</div>
                    <div className={'mt-1 text-[11px] ' + (built ? 'text-parchment/60' : resOk ? 'text-parchment/60' : 'text-red-300')}>
                      {built ? 'Construit' : `${coutTxt} · ${b.duree}t`}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Gouvernance de la province */}
            <div className="mt-5">
              <h3 className="mb-1 text-[11px] font-bold uppercase tracking-widest text-bronze/80">Gouvernance</h3>
              <div className="flex flex-wrap items-center gap-2">
                {ville.gouverneur ? (
                  <span className="chip">Gouverneur en poste ✓ (+12 stabilité locale)</span>
                ) : estCapitale ? (
                  <span className="chip">Capitale — gérée par le dirigeant (pas de gouverneur)</span>
                ) : (
                  <button disabled={or < 100 || gAct >= gMax || !!busy} onClick={() => act('nommer_gouverneur', { ville: ville.id }, 'gouv')} className="btn btn-ghost btn-sm">
                    Nommer un gouverneur (100 or)
                  </button>
                )}
                {!estCapitale && <span className="text-[11px] text-parchment/55">Gouverneurs : {gAct}/{gMax}</span>}
                <button disabled={or < 150 || !!busy} onClick={() => act('organiser_jeux', {}, 'jeux')} className="btn btn-ghost btn-sm">
                  Organiser des jeux (150 or · +stabilité)
                </button>
              </div>
            </div>

            {mervConstruct.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-1 text-[11px] font-bold uppercase tracking-widest text-gold/80">✦ Grandes merveilles</h3>
                {mervConstruct.map((m) => {
                  const st = mervStatus[m.id] || {}
                  const etat = st.etat
                  const coutRes = m.cout_res || {}
                  const have = (r) => (r === 'marbre' ? (luxe[r] || 0) : (ress[r] || 0))
                  const resOk = or >= (m.cout_or || 0) && Object.entries(coutRes).every(([r, v]) => have(r) >= v)
                  const coutTxt = `${m.cout_or || 0} or` + Object.entries(coutRes).map(([r, v]) => `, ${v} ${r}`).join('')
                  const enChantier = etat === 'en_construction'
                  return (
                    <div key={m.id} className="card mb-2 flex gap-3">
                      <div className="shrink-0 self-start overflow-hidden rounded-md border border-bronze-dark/50 bg-gradient-to-b from-[#211b12] to-black/40 p-1"
                           style={(!etat || etat === 'non_construite' || enChantier) ? { filter: 'grayscale(0.55) brightness(0.85)' } : undefined}>
                        <WonderArt id={m.id} size={96} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gold">{m.nom}</span>
                          <span className="chip">{ETAT_LABEL[etat] || 'Disponible'}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-bronze/90">{m.desc}</div>
                        <div className="mt-0.5 text-[11px] text-emerald-300">Bonus : stabilité +{(m.bonus && m.bonus.stabilite) || 0} · prestige +{m.prestige} (unique au monde)</div>
                        {(!etat || etat === 'non_construite') && (
                          <button disabled={!resOk || !!busy} onClick={() => act('construire_merveille', { merveille: m.id, ville: ville.id }, 'm' + m.id)}
                                  className={'btn btn-primary btn-sm mt-1.5 ' + (resOk ? '' : 'opacity-50')}>Bâtir ({coutTxt} · {m.duree}t)</button>
                        )}
                        {enChantier && st.chantier && (
                          <div className="mt-1 text-[11px] text-parchment/60">Chantier : {st.chantier.duree - st.chantier.tours_restants}/{st.chantier.duree} tours{st.proprietaire && st.proprietaire !== joueurId ? ' (rival)' : ''}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Overlay>
  )
}

const BONUS_LABEL = { or: 'Or', nourriture: 'Nourriture', eau: 'Eau', stabilite: 'Stabilité', recherche_pct: 'Recherche' }
function fmtBonus(k, v) {
  if (k === 'recherche_pct') return `${BONUS_LABEL[k]} +${Math.round(v * 100)}%`
  return `${BONUS_LABEL[k] || k} ${v > 0 ? '+' : ''}${v}`
}

const ETAT_LABEL = {
  intacte: 'Intacte', ruine: 'En ruine', site: 'À fouiller',
  en_restauration: 'Restauration…', fouille_en_cours: 'Fouille…', en_construction: 'Chantier…',
  restauree: 'Restaurée ✓', fouillee: 'Fouillée ✓', construite: 'Bâtie ✓', non_construite: 'Disponible',
}

function nomBat(batiments, id) { const b = batiments.find((x) => x.id === id); return b ? b.nom : id }

export function Overlay({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-bronze-dark bg-night shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
