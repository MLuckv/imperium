import { useEffect, useState } from 'react'
import { getCatalog, getMap, postAction } from '../api'
import { num } from '../lib/format'
import { BuildingIcon, UiIcon, ResIcon } from './Icons'
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
  const [onglet, setOnglet] = useState('batiments')

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
  const techs = new Set(joueur.technologies || [])
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

  // Bâtiments regroupés par catégorie, dans l'ordre du catalogue.
  const categories = []
  for (const b of batiments) {
    const c = b.categorie || 'Divers'
    let g = categories.find((x) => x.nom === c)
    if (!g) { g = { nom: c, items: [] }; categories.push(g) }
    g.items.push(b)
  }
  const dispo = batiments.filter((b) => !dejaBatis.has(b.id)).length

  return (
    <Overlay onClose={onClose} large>
      <div className="flex items-center gap-3 border-b border-bronze-dark/60 px-5 py-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-gold/70 bg-[radial-gradient(circle_at_40%_35%,#5a4520,#1e160a)] text-gold">
          <UiIcon id="production" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold tracking-wide text-gold">{ville ? ville.nom : nomProv}</h2>
          <div className="text-xs text-parchment/60">
            {nomProv}{ville ? ` · ${Math.round(ville.population || 0)} habitants` : ' · aucune cité'}{estCapitale ? ' · capitale' : ''}
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-sm text-parchment/80"><ResIcon id="or" size={15} style={{ color: '#e0b23e' }} /><b className="text-gold">{num(or)}</b></span>
        <button onClick={onClose} className="btn btn-ghost btn-sm">Fermer</button>
      </div>

      {flash && <div className={'px-5 py-1.5 text-sm ' + (flash.ok ? 'bg-emerald-950/50 text-emerald-100' : 'bg-red-950/50 text-red-100')}>{flash.text}</div>}

      {ville && chantier && (
        <div className="flex items-center gap-3 border-b border-bronze-dark/40 bg-black/30 px-5 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/60 bg-black/40 text-gold"><BuildingIcon id={chantier.batiment} size={20} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-parchment/80">En chantier : <b className="text-gold">{nomBat(batiments, chantier.batiment)}</b></span>
              <span className="text-xs text-parchment/60">{chantier.tours_restants} tour{chantier.tours_restants > 1 ? 's' : ''} restant{chantier.tours_restants > 1 ? 's' : ''}</span>
            </div>
            <div className="progress mt-1"><div className="progress-bar" style={{ width: `${Math.round(100 * (chantier.duree - chantier.tours_restants) / chantier.duree)}%` }} /></div>
          </div>
        </div>
      )}

      {ville && (
        <div className="flex gap-1 border-b border-bronze-dark/50 px-4 pt-2">
          {[['batiments', `Bâtiments (${dispo})`], ['merveilles', `Merveilles${mervIci.length ? ' ✦' : ''}`], ['gouvernance', 'Gouvernance']].map(([k, l]) => (
            <button key={k} onClick={() => setOnglet(k)}
                    className={'rounded-t-md border border-b-0 px-4 py-1.5 font-display text-[12px] tracking-wider transition ' +
                      (onglet === k ? 'border-bronze-dark bg-[#2a2216] text-gold shadow-[inset_0_-2px_0_#e8c267]' : 'border-transparent text-parchment/55 hover:text-parchment')}>
              {l}
            </button>
          ))}
        </div>
      )}

      <div className="thin-scroll max-h-[64vh] overflow-y-auto p-4">
        {!ville ? (
          <>
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
                  <div className="shrink-0 self-start overflow-hidden rounded-md shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
                       style={ruine ? { filter: 'grayscale(0.7) brightness(0.8)' } : undefined}>
                    <WonderArt id={m.id} type={m.type} size={120} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gold">{m.nom}</span>
                      <span className="chip">{ETAT_LABEL[etat] || etat}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-bronze/90">{m.desc}</div>
                    {bonusTxt && <div className="mt-0.5 text-[11px] text-emerald-300">Bonus : {bonusTxt} · prestige +{m.prestige}</div>}
                    {m.special && <div className="mt-0.5 text-[11px] text-sky-200"><b>✦ {m.special.nom}</b> — {m.special.desc}</div>}
                    {m.type === 'antique' && <div className="mt-1 text-[11px] text-parchment/55">Bonus actif tant que vous tenez la province.</div>}
                    {m.type === 'naturelle' && <div className="mt-1 text-[11px] text-parchment/55">Site naturel : ne se bâtit ni ne se perd — son bonus va à qui tient la province.</div>}
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
          <div className="rounded-md border border-bronze/40 bg-black/25 p-4 text-center">
            <p className="mb-1 text-sm text-parchment/85">Aucune ville dans <b className="text-gold">{nomProv}</b>.</p>
            <p className="mb-3 text-xs text-parchment/55">Fondez-y une ville pour pouvoir y produire (coûteux : la colonie débute instable, en pacification 3 tours).</p>
            <button disabled={or < fond.cout_or || !!busy} onClick={() => act('fonder_ville', { territoire: terr }, 'fonder')} className="btn btn-primary">
              Fonder une ville ({fond.cout_or} or · {fond.colons} colons · stabilité −{fond.penalite_stabilite})
            </button>
          </div>
          </>
        ) : onglet === 'batiments' ? (
          <div className="space-y-4">
            {categories.map((cat) => (
              <div key={cat.nom}>
                <h3 className="mb-1.5 font-display text-[11px] uppercase tracking-[0.22em] text-bronze/80">{cat.nom}</h3>
                <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                  {cat.items.map((b) => {
                    const built = dejaBatis.has(b.id)
                    const coutRes = b.cout_res || {}
                    const resOk = Object.entries(coutRes).every(([rr, v]) => (ress[rr] || 0) >= v)
                    const orOk = or >= b.cout
                    const dis = built || !orOk || !resOk || !!chantier || !!busy
                    return (
                      <button key={b.id} disabled={dis} title={b.effet}
                              onClick={() => act('construire', { batiment: b.id, ville: ville.id }, 'b' + b.id)}
                              className={'ligne-prod ' + (built ? 'ligne-prod-fait' : dis ? 'ligne-prod-off' : '')}>
                        <span className="medaillon-prod"><BuildingIcon id={b.id} size={24} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-display text-[13px] font-semibold tracking-wide text-parchment">{b.nom}</span>
                          <span className="block truncate text-[11.5px] text-emerald-200/80">{b.effet}</span>
                        </span>
                        {built ? (
                          <span className="font-display text-xs text-emerald-300">Bâti ✓</span>
                        ) : (
                          <span className="flex shrink-0 flex-col items-end gap-0.5 text-[11px]">
                            <span className="flex items-center gap-2">
                              <span className={'flex items-center gap-0.5 ' + (orOk ? 'text-gold' : 'text-red-300')}><ResIcon id="or" size={12} style={{ color: '#e0b23e' }} />{b.cout}</span>
                              {Object.entries(coutRes).map(([rr, v]) => (
                                <span key={rr} className={'flex items-center gap-0.5 ' + ((ress[rr] || 0) >= v ? 'text-parchment/75' : 'text-red-300')}><ResIcon id={rr} size={12} />{v}</span>
                              ))}
                            </span>
                            <span className="text-parchment/50">⧗ {b.duree} tour{b.duree > 1 ? 's' : ''}</span>
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {chantier && <p className="text-center text-xs italic text-parchment/45">Une seule construction à la fois : attendez la fin du chantier en cours.</p>}
          </div>
        ) : onglet === 'merveilles' ? (
          <>
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
                  <div className="shrink-0 self-start overflow-hidden rounded-md shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
                       style={ruine ? { filter: 'grayscale(0.7) brightness(0.8)' } : undefined}>
                    <WonderArt id={m.id} type={m.type} size={120} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gold">{m.nom}</span>
                      <span className="chip">{ETAT_LABEL[etat] || etat}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-bronze/90">{m.desc}</div>
                    {bonusTxt && <div className="mt-0.5 text-[11px] text-emerald-300">Bonus : {bonusTxt} · prestige +{m.prestige}</div>}
                    {m.special && <div className="mt-0.5 text-[11px] text-sky-200"><b>✦ {m.special.nom}</b> — {m.special.desc}</div>}
                    {m.type === 'antique' && <div className="mt-1 text-[11px] text-parchment/55">Bonus actif tant que vous tenez la province.</div>}
                    {m.type === 'naturelle' && <div className="mt-1 text-[11px] text-parchment/55">Site naturel : ne se bâtit ni ne se perd — son bonus va à qui tient la province.</div>}
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
            {mervConstruct.length > 0 && (
              <div className="mt-1">
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
                      <div className="shrink-0 self-start overflow-hidden rounded-md shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
                           style={(!etat || etat === 'non_construite' || enChantier) ? { filter: 'grayscale(0.55) brightness(0.85)' } : undefined}>
                        <WonderArt id={m.id} type={m.type} size={120} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gold">{m.nom}</span>
                          <span className="chip">{ETAT_LABEL[etat] || 'Disponible'}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-bronze/90">{m.desc}</div>
                        <div className="mt-0.5 text-[11px] text-emerald-300">
                          Bonus : {Object.entries(m.bonus || {}).map(([k, v]) => fmtBonus(k, v)).join(', ')} · prestige +{m.prestige} (unique au monde)
                        </div>
                        {m.special && <div className="mt-0.5 text-[11px] text-sky-200"><b>✦ {m.special.nom}</b> — {m.special.desc}</div>}
                        {m.tech_requise && !techs.has(m.tech_requise) && (
                          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-red-300/90"><UiIcon id="lock" size={12} />requiert {TECH_NOMS[m.tech_requise] || m.tech_requise}</div>
                        )}
                        {(!etat || etat === 'non_construite') && (
                          <button disabled={!resOk || !!busy || (m.tech_requise && !techs.has(m.tech_requise))} onClick={() => act('construire_merveille', { merveille: m.id, ville: ville.id }, 'm' + m.id)}
                                  className={'btn btn-primary btn-sm mt-1.5 ' + (resOk && !(m.tech_requise && !techs.has(m.tech_requise)) ? '' : 'opacity-50')}>Bâtir ({coutTxt} · {m.duree}t)</button>
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
        ) : (
          <>
            {/* Gouvernance de la province */}
            <div>
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

          </>
        )}
      </div>
    </Overlay>
  )
}

const TECH_NOMS = {
  philosophie_grecque: 'Philosophie grecque', navigation_maritime: 'Navigation maritime', ingenierie_hydraulique: 'Ingénierie hydraulique',
  architecture_pierre: 'Architecture en pierre', genie_militaire: 'Génie militaire', legion_tactique: 'Tactique de la légion',
}
const BONUS_LABEL = { or: 'Or', nourriture: 'Nourriture', eau: 'Eau', stabilite: 'Stabilité', recherche_pct: 'Recherche',
                      attaque_pct: 'Attaque', defense_pct: 'Défense' }
function fmtBonus(k, v) {
  if (k.endsWith('_pct')) return `${BONUS_LABEL[k] || k} ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`
  return `${BONUS_LABEL[k] || k} ${v > 0 ? '+' : ''}${v}`
}

const ETAT_LABEL = {
  intacte: 'Intacte', ruine: 'En ruine', site: 'À fouiller',
  en_restauration: 'Restauration…', fouille_en_cours: 'Fouille…', en_construction: 'Chantier…',
  restauree: 'Restaurée ✓', fouillee: 'Fouillée ✓', construite: 'Bâtie ✓', non_construite: 'Disponible',
}

function nomBat(batiments, id) { const b = batiments.find((x) => x.id === id); return b ? b.nom : id }

export function Overlay({ children, onClose, large = false }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className={'fenetre flex max-h-[88vh] w-full flex-col overflow-hidden ' + (large ? 'max-w-4xl' : 'max-w-2xl')} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
