import { useCallback, useEffect, useState } from 'react'
import { getHealth, getState, newGame, endTurn, saveGame, loadGame, moveUnit, annexProvince, getCatalog, getMap, postAction, ApiError } from './api'
import Map from './components/Map'
import ResourceBar from './components/ResourceBar'
import ProductionModal from './components/ProductionModal'
import RecruitmentModal from './components/RecruitmentModal'
import DiplomacyModal from './components/DiplomacyModal'
import ConseillerModal from './components/ConseillerModal'
import TechTree from './components/TechTree'
import DogmeTree from './components/DogmeTree'
import { factionColor, factionLabel, leaderName, reputationTone, num } from './lib/format'
import { FactionEmblem } from './components/Icons'

const SLOT = 1

const CIVS = [
  { id: 'rome', nom: 'Rome', leader: 'Néron', style: 'Empire & ingénierie',
    desc: 'Légions, routes, grands monuments. La puissance dominante.', bonus: 'Stabilité & Or' },
  { id: 'macedoine', nom: 'Macédoine', leader: 'Alexandre le Grand', style: 'Conquête éclair',
    desc: 'Phalange et Compagnons. Une soif d\'empire sans limite.', bonus: 'Offensive & Gloire' },
  { id: 'sparte', nom: 'Sparte', leader: 'Léonidas', style: 'Caste guerrière',
    desc: 'Hoplites d\'élite, discipline d\'airain, défense farouche.', bonus: 'Armée & Défense' },
  { id: 'carthage', nom: 'Égypte', leader: 'Ptolémée', style: 'Commerce & savoir',
    desc: 'Or du Nil, grain, merveilles et bibliothèques.', bonus: 'Or & Luxe' },
]

export default function App() {
  const [booting, setBooting] = useState(true)
  const [backendOk, setBackendOk] = useState(false)
  const [health, setHealth] = useState(null)
  const [bootError, setBootError] = useState(null)

  const [screen, setScreen] = useState('menu')
  const [state, setState] = useState(null)
  const [hasSavedGame, setHasSavedGame] = useState(false)

  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState(null)
  // Modales (UI épurée : tout s'ouvre via un bouton)
  const [modal, setModal] = useState(null) // 'production' | 'recrutement' | 'tech' | 'civs' | null
  const [diploTarget, setDiploTarget] = useState(null)
  const [resume, setResume] = useState('')
  const [resumeSource, setResumeSource] = useState('')
  const [resumeAnnee, setResumeAnnee] = useState(null)  // chronique annuelle (livre d'histoire)
  const [finPartieVue, setFinPartieVue] = useState(false) // écran victoire/défaite déjà fermé
  const [evenements, setEvenements] = useState([])
  const [showChronique, setShowChronique] = useState(false)
  const [msgIA, setMsgIA] = useState(0)  // messages spontanés des dirigeants non lus
  const [selProv, setSelProv] = useState(null)   // province cliquée {id, faction, nom}
  const [conqueteCost, setConqueteCost] = useState(90)
  const [provNames, setProvNames] = useState({}) // id -> nom
  const [impotsOpts, setImpotsOpts] = useState([])

  useEffect(() => {
    getCatalog().then((c) => { if (c) { if (c.conquete) setConqueteCost(c.conquete.cout_or); if (c.impots) setImpotsOpts(c.impots) } }).catch(() => {})
    getMap().then((m) => { const n = {}; for (const t of (m.territoires || [])) n[t.id] = t.nom; setProvNames(n) }).catch(() => {})
  }, [])

  async function setImpots(niveau) {
    try {
      const r = await postAction({ type: 'definir_impots', params: { niveau } })
      if (r && r.state) setState(r.state)
      if (r && r.raison) flash('ok', r.raison)
    } catch (err) { flash('err', err.message || 'Échec') }
  }

  const boot = useCallback(async () => {
    setBooting(true); setBootError(null)
    try { const h = await getHealth(); setHealth(h); setBackendOk(true) }
    catch (err) { setBackendOk(false); setBootError(err.message || 'Backend injoignable'); setBooting(false); return }
    try { const s = await getState(); setState(s); setHasSavedGame(true); setResume(s.resume_tour || '') }
    catch (err) { if (!(err instanceof ApiError && err.status === 404)) setBootError(err.message || 'Erreur de chargement') }
    finally { setBooting(false) }
  }, [])
  useEffect(() => { boot() }, [boot])

  function flash(type, text) { setBanner({ type, text }) }

  async function startGame(civId) {
    setBusy(true); setBanner(null)
    try {
      const s = await newGame(civId)
      setState(s); setHasSavedGame(true); setEvenements([]); setResume(''); setShowChronique(false)
      setScreen('game'); flash('ok', `Vous incarnez ${factionLabel(civId, s.pays[civId] && s.pays[civId].nom)}.`)
    } catch (err) { flash('err', err.message || 'Échec de la création') }
    finally { setBusy(false) }
  }

  async function handleEndTurn(tours = 1) {
    setBusy(true); setBanner(null)
    try {
      const r = await endTurn(tours)
      if (r && r.state) setState(r.state)
      const evs = (r && r.evenements) || []
      setEvenements(evs)
      setMsgIA((n) => n + evs.filter((e) => e && e.type === 'message_ia').length)
      setResume((r && r.resume) || '')
      setResumeSource((r && r.resume_source) || '')
      setResumeAnnee((r && r.resume_annee) || null)
      setShowChronique(true)
    } catch (err) { flash('err', err.message || 'Échec de la fin de tour') }
    finally { setBusy(false) }
  }

  async function handleSave() {
    setBusy(true)
    try { await saveGame(SLOT); flash('ok', `Partie sauvegardée (slot ${SLOT}).`) }
    catch (err) { flash('err', err.message || 'Échec de la sauvegarde') }
    finally { setBusy(false) }
  }
  async function handleLoad() {
    setBusy(true)
    try {
      const s = await loadGame(SLOT)
      setState(s); setHasSavedGame(true); setEvenements([]); setResume(s.resume_tour || ''); setScreen('game')
      flash('ok', `Partie chargée (slot ${SLOT}).`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) flash('err', `Aucune sauvegarde slot ${SLOT}.`)
      else flash('err', err.message || 'Échec du chargement')
    } finally { setBusy(false) }
  }

  async function handleMoveStack(unitIds, toTerr) {
    let last = null
    try {
      for (const id of unitIds) last = await moveUnit(id, toTerr)
      if (last && last.state) setState(last.state)
      if (last && !last.ok && last.raison) flash('err', last.raison) // pas de popup si succès
    } catch (err) { flash('err', err.message || 'Déplacement impossible') }
  }

  async function handleAnnex(terr) {
    setBusy(true); setBanner(null)
    try {
      const r = await annexProvince(terr)
      if (r && r.state) setState(r.state)
      flash(r && r.ok ? 'ok' : 'err', (r && r.raison) || 'Annexion impossible')
    } catch (err) { flash('err', err.message || 'Annexion impossible') }
    finally { setBusy(false) }
  }

  // ---- Écrans hors-jeu ----
  if (booting) return <div className="menu-screen"><div className="menu-title">IMPERIVM</div><p className="menu-subtitle">Connexion…</p></div>
  if (!backendOk) {
    return (
      <div className="menu-screen">
        <div className="menu-title" style={{ color: 'var(--color-terracotta)' }}>Backend indisponible</div>
        <p className="menu-subtitle">{bootError}</p>
        <button onClick={boot} className="btn btn-primary mt-5">Réessayer</button>
      </div>
    )
  }
  if (screen === 'menu') {
    return (
      <div className="menu-screen">
        <div className="menu-title">IMPERIVM</div>
        <p className="menu-subtitle">Grande stratégie antique — Méditerranée, 5 av. J.-C.</p>
        <div className="mt-10 flex flex-col gap-3">
          <button onClick={() => setScreen('civ')} disabled={busy} className="btn btn-primary" style={{ minWidth: 240, fontSize: '1.1rem', padding: '0.8rem 1.5rem' }}>Jouer</button>
          {hasSavedGame && <button onClick={() => setScreen('game')} className="btn btn-ghost" style={{ minWidth: 240 }}>Reprendre la partie</button>}
          <button onClick={handleLoad} disabled={busy} className="btn btn-ghost" style={{ minWidth: 240 }}>Charger (slot {SLOT})</button>
        </div>
        {health && <p className="mt-10 text-xs text-parchment/40">IA : {health.modele_pret ? `prête (${health.modele})` : health.ollama ? 'modèle en chargement (repli)' : 'hors-ligne (mode repli)'}</p>}
      </div>
    )
  }
  if (screen === 'civ') {
    return (
      <div className="menu-screen">
        <div className="menu-title" style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)' }}>Choisissez votre civilisation</div>
        <p className="menu-subtitle">Vous débuterez avec une seule province et tout à bâtir.</p>
        <div className="mt-8 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          {CIVS.map((c) => (
            <button key={c.id} onClick={() => startGame(c.id)} disabled={busy}
                    className="panel text-left transition hover:scale-[1.02]" style={{ borderColor: factionColor(c.id) }}>
              <div className="flex items-center gap-2">
                <FactionEmblem faction={c.id} size={28} className="shrink-0" style={{ color: factionColor(c.id) }} />
                <span className="font-display text-lg font-bold" style={{ color: factionColor(c.id) }}>{c.nom}</span>
              </div>
              <div className="mt-1 text-xs italic text-parchment/60">{c.leader} · {c.style}</div>
              <p className="mt-2 text-sm text-parchment/85">{c.desc}</p>
              <div className="mt-2 text-xs text-gold">Atout : {c.bonus}</div>
            </button>
          ))}
        </div>
        <button onClick={() => setScreen('menu')} className="btn btn-ghost btn-sm mt-8">← Retour</button>
      </div>
    )
  }

  if (!state) { setScreen('menu'); return null }

  const joueurId = state.meta && state.meta.joueur_pays
  const joueur = joueurId && state.pays ? state.pays[joueurId] : null
  const autres = Object.keys(state.pays || {}).filter((id) => id !== joueurId && !(state.pays[id] || {}).elimine)
  const victoire = state.victoire

  // Provinces neutres occupées par une armée du joueur → annexables.
  const ownedAll = new Set()
  for (const p of Object.values(state.pays || {})) for (const t of p.territoires || []) ownedAll.add(t)
  const annexables = [...new Set((joueur && joueur.unites || []).map((u) => u.territoire))].filter((t) => !ownedAll.has(t))

  // ---- Vue de jeu : carte + barre du haut + barre d'action (façon Civ/AoH) ----
  const monProv = selProv && selProv.faction === joueurId ? selProv : null

  return (
    <div className="flex h-screen flex-col bg-abyss text-parchment">
      <ResourceBar meta={state.meta} joueur={joueur} />

      <main className="relative min-h-0 flex-1">
        <Map stateData={state} onSelectFaction={setDiploTarget} onMoveStack={handleMoveStack} onSelectProvince={setSelProv} />

        {/* Toast (flottant, ne décale plus la carte) */}
        {banner && (
          <div className={'absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border px-4 py-2 text-sm shadow-xl ' + (banner.type === 'ok' ? 'border-emerald-700/60 bg-emerald-950/90 text-emerald-100' : 'border-red-700/60 bg-red-950/90 text-red-100')}>
            <span>{banner.text}</span>
            <button onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Chronique : événements marquants du tour, et belle chronique au passage d'une année */}
        {showChronique && (resume || evenements.length > 0) && (
          <div className={'panel absolute right-3 top-3 z-10 ' + (resumeAnnee ? 'max-w-md' : 'max-w-sm')}>
            <div className="flex items-center justify-between">
              <h2 className="panel-title !mb-0 !border-0 !pb-0">{resumeAnnee ? `Chronique de l'an ${resumeAnnee}` : 'Événements'}</h2>
              <button onClick={() => setShowChronique(false)} className="text-parchment/60 hover:text-parchment">✕</button>
            </div>
            <div className="mt-2" />
            {resume && <p className={'whitespace-pre-wrap leading-relaxed ' + (resumeAnnee ? 'font-serif text-[15px] text-gold/95 first-letter:float-left first-letter:mr-1 first-letter:font-display first-letter:text-4xl first-letter:leading-none first-letter:text-gold' : 'text-sm italic text-parchment/90')}>{resume}</p>}
            {evenements.length > 0 && (
              <ul className="thin-scroll mt-2 max-h-32 space-y-1 overflow-y-auto border-t border-bronze-dark/40 pt-2 text-xs text-parchment/80">
                {evenements.map((e, i) => <li key={i}>• {typeof e === 'string' ? e : e.texte || e.nom}</li>)}
              </ul>
            )}
          </div>
        )}

        {/* Annexion : une armée occupe une province neutre (coût affiché) */}
        {annexables.length > 0 && (
          <div className="panel absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-2">
            <span className="text-sm text-parchment/90">Armée en province neutre :</span>
            {annexables.map((t) => (
              <button key={t} onClick={() => handleAnnex(t)} disabled={busy} className="btn btn-primary btn-sm">
                Annexer {provNames[t] || t} ({conqueteCost} or)
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Barre d'action en bas (n'empiète plus sur la carte) */}
      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-bronze-dark/60 bg-night px-3 py-2">
        {monProv ? (
          <>
            <span className="mr-1 text-xs text-parchment/70">{monProv.nom} :</span>
            <button onClick={() => setModal('production')} className="btn btn-ghost">Production</button>
            <button onClick={() => setModal('recrutement')} className="btn btn-ghost">Armée</button>
            <span className="mx-1 h-6 w-px bg-bronze-dark/50" />
          </>
        ) : (
          <span className="mr-1 text-xs italic text-parchment/45">Cliquez une de vos provinces pour la gérer</span>
        )}
        <button onClick={() => setModal('tech')} className="btn btn-ghost">Technologies</button>
        <button onClick={() => setModal('dogmes')} className="btn btn-ghost">Dogmes</button>
        <button onClick={() => { setModal('civs'); setMsgIA(0) }} className="btn btn-ghost relative">
          Diplomatie
          {msgIA > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">{msgIA}</span>}
        </button>
        <button onClick={() => setModal('conseiller')} className="btn btn-ghost">Conseiller</button>
        {impotsOpts.length > 0 && (
          <label className="flex items-center gap-1 text-xs text-parchment/70">
            Impôts
            <select value={(joueur && joueur.impots) || 'normal'} onChange={(e) => setImpots(e.target.value)}
                    className="rounded border border-bronze-dark/60 bg-night px-1.5 py-1 text-parchment">
              {impotsOpts.map((o) => <option key={o.id} value={o.id}>{o.nom} (stab {o.stab >= 0 ? '+' : ''}{o.stab})</option>)}
            </select>
          </label>
        )}
        <span className="mx-1 h-6 w-px bg-bronze-dark/50" />
        <button onClick={handleSave} disabled={busy} className="btn btn-ghost btn-sm">Sauver</button>
        <button onClick={() => setScreen('menu')} className="btn btn-ghost btn-sm">Menu</button>
        <div className="flex items-stretch gap-px overflow-hidden rounded-md">
          <button onClick={() => handleEndTurn(1)} disabled={busy} className="btn btn-primary rounded-none" title="Avancer d'un mois">{busy ? 'Le monde avance…' : 'Fin de tour ▸'}</button>
          <button onClick={() => handleEndTurn(3)} disabled={busy} className="btn btn-primary rounded-none px-2" title="Avancer de 3 mois">+3 mois</button>
          <button onClick={() => handleEndTurn(12)} disabled={busy} className="btn btn-primary rounded-none px-2" title="Avancer d'un an (12 mois)">+1 an</button>
        </div>
      </div>

      {/* Modales */}
      {modal === 'production' && <ProductionModal state={state} forcedTerr={monProv && monProv.id} onClose={() => setModal(null)} onStateChange={setState} />}
      {modal === 'recrutement' && <RecruitmentModal state={state} forcedTerr={monProv && monProv.id} onClose={() => setModal(null)} onStateChange={setState} />}
      {modal === 'tech' && <TechTree state={state} onClose={() => setModal(null)} onStateChange={setState} />}
      {modal === 'dogmes' && <DogmeTree state={state} onClose={() => setModal(null)} onStateChange={setState} />}
      {modal === 'civs' && (
        <CivPicker autres={autres} state={state} joueur={joueur} joueurId={joueurId}
                   onPick={(id) => { setModal(null); setDiploTarget(id) }} onClose={() => setModal(null)} />
      )}
      {diploTarget && state.pays[diploTarget] && (
        <DiplomacyModal cible={diploTarget} state={state} onClose={() => setDiploTarget(null)} onStateChange={setState} />
      )}
      {modal === 'conseiller' && (
        <ConseillerModal state={state} onClose={() => setModal(null)} onStateChange={setState} />
      )}
      {victoire && !finPartieVue && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
          <div className="panel max-w-lg text-center">
            <h2 className="font-display text-3xl font-bold tracking-wide"
                style={{ color: victoire.type === 'defaite' || (victoire.gagnant && victoire.gagnant !== joueurId) ? '#c0392b' : '#e8c267' }}>
              {victoire.type === 'defaite' ? '☠ DÉFAITE' : victoire.gagnant === joueurId ? '🏆 VICTOIRE' : '☠ DÉFAITE'}
            </h2>
            <div className="mt-1 text-xs uppercase tracking-widest text-bronze">
              {victoire.type === 'militaire' ? 'Victoire militaire' : victoire.type === 'diplomatique' ? 'Victoire diplomatique'
                : victoire.type === 'touristique' ? 'Victoire touristique' : 'Fin de partie'}
            </div>
            <p className="mt-4 font-serif text-parchment/90">{victoire.raison}</p>
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={() => setFinPartieVue(true)} className="btn btn-ghost">Contempler le monde</button>
              <button onClick={() => setScreen('menu')} className="btn btn-primary">Menu principal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Sélecteur de civilisation pour le bouton Diplomatie.
function CivPicker({ autres, state, joueur, joueurId, onPick, onClose }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-bronze-dark bg-night p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-gold">Diplomatie</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Fermer</button>
        </div>
        <div className="flex flex-col gap-2">
          {autres.map((id) => {
            const p = state.pays[id] || {}
            const score = joueur && joueur.reputation && joueur.reputation[id]
            const tone = reputationTone(score)
            const enGuerre = ((state.diplomatie || {}).guerres_actives || []).some((g) => new Set([g.a, g.b]).has(id) && new Set([g.a, g.b]).has(joueurId))
            return (
              <button key={id} onClick={() => onPick(id)} className="flex items-center gap-2 rounded-md border border-transparent bg-black/20 px-3 py-2 text-left transition hover:border-bronze hover:bg-black/30">
                <FactionEmblem faction={id} size={22} className="shrink-0" style={{ color: p.couleur || factionColor(id) }} />
                <span className="flex-1">
                  <span className="block text-sm text-parchment">{factionLabel(id, p.nom)}</span>
                  <span className="block text-[11px] text-parchment/50">{leaderName(id)}</span>
                </span>
                {enGuerre && <span className="chip chip-war">Guerre</span>}
                <span className={'text-xs font-semibold ' + tone.className}>{tone.label}{score != null && ` (${score > 0 ? '+' : ''}${num(score)})`}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
