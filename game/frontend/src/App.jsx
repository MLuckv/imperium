import { useCallback, useEffect, useRef, useState } from 'react'
import { getHealth, getState, newGame, endTurn, saveGame, loadGame, moveUnit, annexProvince, getCatalog, getMap, postAction, ApiError } from './api'
import Map from './components/Map'
import ResourceBar from './components/ResourceBar'
import ProductionModal from './components/ProductionModal'
import RecruitmentModal from './components/RecruitmentModal'
import DiplomacyModal from './components/DiplomacyModal'
import ConseillerModal from './components/ConseillerModal'
import PeaceModal from './components/PeaceModal'
import JournalModal from './components/JournalModal'
import Objectifs from './components/Objectifs'
import ProvincePanel from './components/ProvincePanel'
import TechTree from './components/TechTree'
import DogmeTree from './components/DogmeTree'
import { factionColor, factionLabel, leaderName, reputationTone, num } from './lib/format'
import { FactionEmblem, UiIcon } from './components/Icons'

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
  { id: 'francs', nom: 'Francs', leader: "Jeanne d'Arc", style: 'Foi & délivrance',
    desc: 'Bannière, sacre de Reims, armée disciplinée et pieuse.', bonus: 'Moral & Défense' },
  { id: 'bretons', nom: 'Bretons', leader: 'Arthur', style: 'Justice & serment',
    desc: 'Camelot, la Table Ronde, une île que nul ne prend.', bonus: 'Loyauté & Terrain' },
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
  const [paixTarget, setPaixTarget] = useState(null)  // traité de paix en cours
  const [resume, setResume] = useState('')
  const [resumeSource, setResumeSource] = useState('')
  const [resumeAnnee, setResumeAnnee] = useState(null)  // chronique annuelle (livre d'histoire)
  const [finPartieVue, setFinPartieVue] = useState(false) // écran victoire/défaite déjà fermé
  const [evenements, setEvenements] = useState([])
  const [showChronique, setShowChronique] = useState(false)
  const [msgIA, setMsgIA] = useState(0)  // messages spontanés des dirigeants non lus
  const [journalVu, setJournalVu] = useState(0)  // taille du journal déjà consultée
  const [menuOuvert, setMenuOuvert] = useState(null)  // {bas, droite} quand le menu Partie est ouvert
  const [marqueurs, setMarqueurs] = useState([])       // événements localisés du dernier tour (carte)
  const [courriers, setCourriers] = useState([])       // messages des souverains reçus ce tour (à répondre)
  const [selProv, setSelProv] = useState(null)   // province cliquée {id, faction, nom}
  const [conqueteCost, setConqueteCost] = useState(90)
  const [provNames, setProvNames] = useState({}) // id -> nom
  const [impotsOpts, setImpotsOpts] = useState([])
  const [nbIa, setNbIa] = useState(5)   // adversaires IA (5 = toutes les autres civs)
  const nbIaRef = useRef(5)             // toujours à jour, même si l'on clique très vite
  // Le gestionnaire clavier est monté une fois : il lit l'état courant via ces refs.
  const screenRef = useRef('menu'); const modalRef = useRef(null)
  const busyRef = useRef(false); const stateRef = useRef(null)
  const diploRef = useRef(null); const paixRef = useRef(null)
  screenRef.current = screen; modalRef.current = modal
  busyRef.current = busy; stateRef.current = state
  diploRef.current = diploTarget; paixRef.current = paixTarget

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

  // Raccourcis clavier : jouer au clavier plutôt qu'à la souris sur chaque bouton.
  // Espace = fin de tour ; Échap ferme ; une lettre ouvre le panneau correspondant.
  useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      // Échap ferme TOUJOURS, même depuis un champ de saisie (recherche, chat).
      if (e.key === 'Escape') {
        if (!modalRef.current && !diploRef.current && !paixRef.current) setSelProv(null)
        setModal(null); setDiploTarget(null); setPaixTarget(null); setMenuOuvert(null); return
      }
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return
      if (screenRef.current !== 'game' || modalRef.current || busyRef.current) return
      if (e.key === ' ') { e.preventDefault(); handleEndTurn(1); return }
      const cible = { t: 'tech', g: 'dogmes', d: 'civs', c: 'conseiller', j: 'journal' }[e.key.toLowerCase()]
      if (cible) {
        e.preventDefault()
        if (cible === 'civs') setMsgIA(0)
        if (cible === 'journal') setJournalVu(((stateRef.current || {}).journal || []).length)
        setModal(cible)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function flash(type, text) { setBanner({ type, text }) }

  async function startGame(civId) {
    setBusy(true); setBanner(null)
    try {
      const s = await newGame(civId, nbIaRef.current)
      setState(s); setHasSavedGame(true); setEvenements([]); setResume(''); setShowChronique(false); setCourriers([]); setMarqueurs([])
      const rivaux = Object.keys(s.pays || {}).filter((id) => id !== civId).length
      setScreen('game')
      flash('ok', `Vous incarnez ${factionLabel(civId, s.pays[civId] && s.pays[civId].nom)} — ${rivaux} ${rivaux > 1 ? 'rivaux' : 'rival'} en lice.`)
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
      setMarqueurs(evs.filter((e) => e && e.territoire).map((e) => ({ territoire: e.territoire, icone: e.icone })))
      // Courriers des souverains : une carte par expéditeur (le dernier mot compte),
      // avec un bouton pour répondre — un silence de 3 tours dégénère en ultimatum.
      const parFaction = {}
      for (const e of evs) if (e && e.type === 'message_ia' && e.faction) parFaction[e.faction] = String(e.texte || '').replace(/^✉\s*/, '')
      // Les courriers graves d'abord (ultimatum, armées massées, guerre), les politesses ensuite.
      const gravite = (tx) => (/ULTIMATUM|massées|guerre|paix/i.test(tx) ? 0 : /hausse le ton|menace|rompt/i.test(tx) ? 1 : 2)
      setCourriers(Object.entries(parFaction).map(([faction, texte]) => ({ faction, texte }))
                         .sort((a, b) => gravite(a.texte) - gravite(b.texte)))
      if (r && r.interruption && tours > 1) {
        flash('warn', `⏸ Avance interrompue après ${r.tours_joues} mois — ${r.interruption}`)
      }
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
      if (last && last.bataille) {
        // Le choc a lieu SOUS LES YEUX du joueur : marqueur sur la province + verdict.
        setMarqueurs([{ territoire: last.territoire || toTerr, icone: last.prise ? '🏴' : '⚔' }])
        flash(last.prise ? 'ok' : 'err', last.raison || (last.prise ? 'Province prise !' : 'Assaut repoussé.'))
      }
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

        {/* Nombre d'adversaires : les civilisations écartées n'existent pas dans la partie */}
        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="text-xs uppercase tracking-widest text-bronze">Adversaires</div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => { setNbIa(n); nbIaRef.current = n }}
                      className={'h-9 w-9 rounded-md border text-sm font-semibold transition ' +
                        (nbIa === n
                          ? 'border-gold bg-gold/20 text-gold'
                          : 'border-bronze-dark/60 text-parchment/70 hover:border-bronze')}>
                {n}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-parchment/50">
            {nbIa === 5 ? 'Toutes les civilisations entrent en lice.'
                        : `${nbIa} ${nbIa > 1 ? 'rivaux tirés' : 'rival tiré'} au sort ; les autres n'existeront pas.`}
          </div>
        </div>
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
  // Armées qui peuvent encore marcher ce tour-ci (évite de terminer son tour
  // en oubliant des troupes immobiles).
  const armeesPretes = ((joueur && joueur.unites) || []).filter((u) => !u.a_bouge).length
  const nbJournal = ((state && state.journal) || []).length
  // Guerres en cours du joueur : {faction, score vu du joueur}
  const mesGuerres = (((state.diplomatie || {}).guerres_actives) || [])
    .filter((g) => g.a === joueurId || g.b === joueurId)
    .map((g) => ({
      faction: g.a === joueurId ? g.b : g.a,
      score: g.a === joueurId ? (g.score || 0) : -(g.score || 0),
    }))

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
        <Map stateData={state} onSelectFaction={setDiploTarget} onMoveStack={handleMoveStack} onSelectProvince={setSelProv} marqueurs={marqueurs} />

        <Objectifs state={state} onAction={(a) => { if (a === 'civs') setMsgIA(0); setModal(a) }} />

        {/* Panneau de la province cliquée (cité, bâtiments, chantier, garnison, actions) */}
        {selProv && (
          <ProvincePanel prov={selProv} state={state} annexable={annexables.includes(selProv.id)} conqueteCost={conqueteCost}
                         onProduction={() => setModal('production')} onArmee={() => setModal('recrutement')}
                         onAnnex={() => handleAnnex(selProv.id)} onDiplo={(f) => setDiploTarget(f)}
                         onClose={() => setSelProv(null)} />
        )}

        {/* Toast (flottant, ne décale plus la carte) */}
        {banner && (
          <div className={'absolute left-1/2 top-3 z-20 flex max-w-[min(90%,40rem)] -translate-x-1/2 items-center gap-3 rounded-lg border px-4 py-2 text-sm shadow-xl ' + (banner.type === 'ok' ? 'border-emerald-700/60 bg-emerald-950/90 text-emerald-100' : banner.type === 'warn' ? 'border-amber-600/60 bg-amber-950/90 text-amber-100' : 'border-red-700/60 bg-red-950/90 text-red-100')}>
            <span>{banner.text}</span>
            <button onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Guerres en cours : bandeau SOUS le toast, dans la carte (il recouvrait
            la barre de ressources). */}
        {mesGuerres.length > 0 && (
          <div className={'absolute left-1/2 z-[15] flex -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-lg border border-red-900/60 bg-night/95 px-3 py-1.5 shadow-lg ' + (banner ? 'top-14' : 'top-3')}>
            <span className="text-xs font-semibold uppercase tracking-widest text-red-300">⚔ En guerre</span>
            {mesGuerres.map((g) => (
              <button key={g.faction} onClick={() => setPaixTarget(g.faction)}
                      title="Négocier la paix : dépensez votre score de guerre pour réclamer des provinces"
                      className="flex items-center gap-1.5 rounded border border-bronze-dark/60 px-2 py-0.5 text-xs hover:border-gold">
                <span style={{ color: factionColor(g.faction) }}>
                  {factionLabel(g.faction, state.pays[g.faction] && state.pays[g.faction].nom)}
                </span>
                <span className={g.score >= 0 ? 'font-semibold text-emerald-300' : 'font-semibold text-red-300'}>
                  {g.score >= 0 ? '+' : ''}{Math.round(g.score)}
                </span>
                <span className="text-parchment/50">· négocier</span>
              </button>
            ))}
          </div>
        )}

        {/* Courriers des souverains : on ne les laisse plus dormir derrière un badge. */}
        {courriers.length > 0 && (
          <div className="absolute bottom-3 right-3 z-10 flex w-80 max-w-[calc(100%-1.5rem)] flex-col gap-2">
            {courriers.slice(0, 3).map((c) => (
              <div key={c.faction} className="panel !p-3">
                <div className="flex items-start gap-2">
                  <FactionEmblem faction={c.faction} size={20} className="mt-0.5 shrink-0" style={{ color: factionColor(c.faction) }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: factionColor(c.faction) }}>
                      ✉ {leaderName(c.faction)}
                    </div>
                    <p className="mt-0.5 line-clamp-3 text-xs italic leading-snug text-parchment/85">{c.texte}</p>
                  </div>
                  <button onClick={() => setCourriers((l) => l.filter((x) => x.faction !== c.faction))}
                          className="text-parchment/50 hover:text-parchment" title="Ignorer">✕</button>
                </div>
                <div className="mt-2 flex justify-end">
                  <button onClick={() => { setCourriers((l) => l.filter((x) => x.faction !== c.faction)); setMsgIA(0); setDiploTarget(c.faction) }}
                          className="btn btn-primary btn-sm">Répondre</button>
                </div>
              </div>
            ))}
            {courriers.length > 3 && <div className="text-right text-[11px] text-parchment/50">+{courriers.length - 3} autre{courriers.length - 3 > 1 ? 's' : ''} courrier{courriers.length - 3 > 1 ? 's' : ''} (Diplomatie)</div>}
          </div>
        )}

        {/* Chronique : événements marquants du tour, et belle chronique au passage d'une année */}
        {showChronique && (resume || evenements.length > 0) && (
          <div className={'panel thin-scroll absolute right-3 top-3 z-10 max-h-[42vh] overflow-y-auto ' + (resumeAnnee ? 'max-w-md' : 'max-w-sm')}>
            <div className="flex items-center justify-between">
              <h2 className="panel-title !mb-0 !border-0 !pb-0">{resumeAnnee ? `Chronique de l'an ${resumeAnnee}` : 'Événements'}</h2>
              <button onClick={() => setShowChronique(false)} className="text-parchment/60 hover:text-parchment">✕</button>
            </div>
            <div className="mt-2" />
            {resume && <p className={'whitespace-pre-wrap leading-relaxed ' + (resumeAnnee ? 'font-serif text-[15px] text-gold/95 first-letter:float-left first-letter:mr-1 first-letter:font-display first-letter:text-4xl first-letter:leading-none first-letter:text-gold' : 'text-sm italic text-parchment/90')}>{resume}</p>}
            {evenements.length > 0 && (() => {
              // Vos affaires d'abord, le reste du monde ensuite (en retrait) : le
              // joueur ne cherche plus sa ligne au milieu des chantiers d'Alexandrie.
              const txt = (e) => (typeof e === 'string' ? e : e.texte || e.nom)
              const nomJ = (joueur && joueur.nom) || ''
              const mien = (e) => typeof e !== 'string' && (e.faction === joueurId || e.type === 'message_ia' || (nomJ && String(e.texte || '').includes(nomJ)))
              const miens = evenements.filter(mien), autres = evenements.filter((e) => !mien(e))
              return (
                <div className="thin-scroll mt-2 max-h-40 overflow-y-auto border-t border-bronze-dark/40 pt-2 text-xs">
                  {miens.length > 0 && (
                    <>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gold/80">Chez vous</div>
                      <ul className="space-y-1 text-parchment/90">{miens.map((e, i) => <li key={'m' + i}>• {txt(e)}</li>)}</ul>
                    </>
                  )}
                  {autres.length > 0 && (
                    <>
                      <div className={'mb-1 text-[10px] font-bold uppercase tracking-widest text-bronze/70 ' + (miens.length ? 'mt-2' : '')}>Ailleurs</div>
                      <ul className="space-y-1 text-parchment/60">{autres.map((e, i) => <li key={'a' + i}>• {txt(e)}</li>)}</ul>
                    </>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* Annexion : une armée occupe une province neutre (coût affiché) */}
        {annexables.filter((tt) => !(selProv && selProv.id === tt)).length > 0 && (
          <div className="panel absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 flex-wrap items-center gap-2 whitespace-nowrap">
            <span className="text-sm text-parchment/90">Armée en province neutre :</span>
            {annexables.filter((tt) => !(selProv && selProv.id === tt)).map((t) => (
              <button key={t} onClick={() => handleAnnex(t)} disabled={busy} className="btn btn-primary btn-sm">
                Annexer {provNames[t] || t} ({conqueteCost} or)
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Barre d'action : UNE seule ligne. La partie gauche défile si l'écran est
          étroit ; « Fin de tour » reste TOUJOURS visible à droite (jamais de bouton
          principal caché derrière un défilement). Sous 1024 px, les libellés
          s'effacent et les icônes suffisent. */}
      <div className="flex items-stretch border-t border-bronze-dark/60 bg-night">
        <div className="thin-scroll flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto px-2 py-1.5">
          <button onClick={() => setModal('tech')} className="btn btn-ghost btn-sm shrink-0" title="Technologies (T)"><UiIcon id="tech" /><span className="hidden lg:inline">Technos</span></button>
          <button onClick={() => setModal('dogmes')} className="btn btn-ghost btn-sm shrink-0" title="Dogmes (G)"><UiIcon id="dogmes" /><span className="hidden lg:inline">Dogmes</span></button>
          <button onClick={() => { setModal('civs'); setMsgIA(0) }} className="btn btn-ghost btn-sm relative shrink-0" title="Diplomatie (D)">
            <UiIcon id="diplomatie" /><span className="hidden lg:inline">Diplomatie</span>
            {msgIA > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{msgIA}</span>}
          </button>
          <button onClick={() => setModal('conseiller')} className="btn btn-ghost btn-sm shrink-0" title="Conseiller (C)"><UiIcon id="conseiller" /><span className="hidden lg:inline">Conseiller</span></button>
          <button onClick={() => { setModal('journal'); setJournalVu(nbJournal) }} className="btn btn-ghost btn-sm relative shrink-0" title="Journal du règne (J)">
            <UiIcon id="journal" /><span className="hidden lg:inline">Journal</span>
            {nbJournal > journalVu && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-ink">{nbJournal - journalVu}</span>}
          </button>

          {impotsOpts.length > 0 && (
            <select value={(joueur && joueur.impots) || 'normal'} onChange={(e) => setImpots(e.target.value)}
                    title="Niveau d'imposition" className="shrink-0 rounded border border-bronze-dark/60 bg-night px-1.5 py-1 text-xs text-parchment">
              {impotsOpts.map((o) => <option key={o.id} value={o.id}>Impôts : {o.nom} ({o.stab >= 0 ? '+' : ''}{o.stab} stab)</option>)}
            </select>
          )}

          {/* Sauver / Menu, repliés pour ne plus disputer la place aux vraies actions */}
          <div className="shrink-0">
            <button onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect()
                      setMenuOuvert(menuOuvert ? null : { bas: window.innerHeight - r.top + 4, droite: window.innerWidth - r.right })
                    }}
                    className="btn btn-ghost btn-sm" title="Partie"><UiIcon id="menu" /></button>
            {menuOuvert && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenuOuvert(null)} />
                <div style={{ bottom: menuOuvert.bas, right: menuOuvert.droite }}
                     className="fixed z-30 flex w-36 flex-col rounded-md border border-bronze-dark bg-night py-1 shadow-xl">
                  <button onClick={() => { setMenuOuvert(null); handleSave() }} disabled={busy}
                          className="px-3 py-1.5 text-left text-sm text-parchment hover:bg-black/40">Sauvegarder</button>
                  <button onClick={() => { setMenuOuvert(null); setScreen('menu') }}
                          className="px-3 py-1.5 text-left text-sm text-parchment hover:bg-black/40">Menu principal</button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center border-l border-bronze-dark/60 px-2 py-1.5">
          <div className="flex items-stretch gap-px overflow-hidden rounded-md">
            <button onClick={() => handleEndTurn(1)} disabled={busy} className="btn btn-primary rounded-none"
                    title={armeesPretes > 0 ? `${armeesPretes} armée(s) peuvent encore marcher — Espace` : "Avancer d'un mois (Espace)"}>
              {busy ? 'Le monde avance…' : 'Fin de tour ▸'}
              {!busy && armeesPretes > 0 && (
                <span className="ml-2 rounded-full bg-ink/30 px-1.5 text-[11px] font-bold" title="Armées encore disponibles">
                  ⚔ {armeesPretes}
                </span>
              )}
            </button>
            <button onClick={() => handleEndTurn(3)} disabled={busy} className="btn btn-primary rounded-none px-2" title="Avancer de 3 mois">+3 m</button>
            <button onClick={() => handleEndTurn(12)} disabled={busy} className="btn btn-primary rounded-none px-2" title="Avancer d'un an (12 mois)">+1 an</button>
          </div>
        </div>
      </div>

      {/* Modales */}
      {modal === 'production' && <ProductionModal state={state} forcedTerr={monProv && monProv.id} onClose={() => setModal(null)} onStateChange={setState} />}
      {modal === 'recrutement' && <RecruitmentModal state={state} forcedTerr={monProv && monProv.id} provNames={provNames} onClose={() => setModal(null)} onStateChange={setState} />}
      {modal === 'tech' && <TechTree state={state} onClose={() => setModal(null)} onStateChange={setState} />}
      {modal === 'dogmes' && <DogmeTree state={state} onClose={() => setModal(null)} onStateChange={setState} />}
      {modal === 'civs' && (
        <CivPicker autres={autres} state={state} joueur={joueur} joueurId={joueurId}
                   onPick={(id) => { setModal(null); setDiploTarget(id) }} onClose={() => setModal(null)} />
      )}
      {diploTarget && state.pays[diploTarget] && (
        <DiplomacyModal cible={diploTarget} state={state} onClose={() => setDiploTarget(null)} onStateChange={setState} />
      )}
      {paixTarget && (
        <PeaceModal cible={paixTarget} state={state}
                    onClose={(msg) => { setPaixTarget(null); if (msg) flash('ok', msg) }}
                    onStateChange={setState} />
      )}
      {modal === 'journal' && (
        <JournalModal state={state} onClose={() => setModal(null)} />
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

// Sélecteur de civilisation pour le bouton Diplomatie : un VRAI tableau de bord
// des rivaux (terres, armées, puissance, traités, guerre), pas une simple liste.
function CivPicker({ autres, state, joueur, joueurId, onPick, onClose }) {
  const guerres = ((state.diplomatie || {}).guerres_actives) || []
  const traites = ((state.diplomatie || {}).traites_actifs) || []
  const maPuissance = (joueur && joueur.puissance) || 0
  const monArmee = (joueur && joueur.force_armee) || 0
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-bronze-dark bg-night p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-gold">Diplomatie</h2>
            <div className="text-[11px] text-parchment/50">Vous : armée <b className="text-parchment/80">⚔ {num(monArmee)}</b> · puissance <b className="text-parchment/80">✦ {num(maPuissance)}</b></div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Fermer</button>
        </div>
        <div className="flex flex-col gap-2">
          {autres.map((id) => {
            const p = state.pays[id] || {}
            const score = joueur && joueur.reputation && joueur.reputation[id]
            const tone = reputationTone(score)
            const enGuerre = guerres.some((g) => new Set([g.a, g.b]).has(id) && new Set([g.a, g.b]).has(joueurId))
            const parties = (tr) => (tr.parties && tr.parties.length ? tr.parties : [tr.a, tr.b].filter(Boolean))
            const TRAITE_LABEL = { alliance: 'Alliance', non_agression: 'Non-agression', route_commerciale: 'Commerce', commercial: 'Commerce', traite_commercial: 'Commerce' }
            const mesTraites = traites.filter((tr) => parties(tr).includes(id) && parties(tr).includes(joueurId))
            const puissance = p.puissance != null ? p.puissance : p.puissance_estimee
            const estime = p.puissance == null
            const armee = p.force_armee != null ? p.force_armee : p.force_armee_estimee
            const rapport = monArmee > 0 ? (armee || 0) / monArmee : (armee > 0 ? Infinity : null)
            const force = rapport == null ? null : rapport > 1.35 ? { t: 'armée plus forte', c: 'text-red-300' }
              : rapport > 0.75 ? { t: 'armées comparables', c: 'text-amber-300' } : { t: 'armée plus faible', c: 'text-emerald-300' }
            return (
              <button key={id} onClick={() => onPick(id)} className="flex items-center gap-3 rounded-md border border-transparent bg-black/20 px-3 py-2 text-left transition hover:border-bronze hover:bg-black/30">
                <FactionEmblem faction={id} size={24} className="shrink-0" style={{ color: p.couleur || factionColor(id) }} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-parchment">{factionLabel(id, p.nom)}</span>
                    <span className="text-[11px] text-parchment/50">{leaderName(id)}</span>
                    {enGuerre && <span className="chip chip-war">Guerre</span>}
                    {mesTraites.map((tr) => <span key={tr.type} className="chip text-emerald-200">{TRAITE_LABEL[tr.type] || tr.type}</span>)}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-parchment/60">
                    {(p.territoires || []).length} prov. · {(p.unites || []).length} unité{(p.unites || []).length > 1 ? 's' : ''} · ⚔ {estime ? '≈' : ''}{num(armee || 0)}
                    {puissance != null && <> · ✦ {estime ? '≈' : ''}{num(puissance)}</>}
                    {force && <span className={'ml-1 ' + force.c}>({force.t})</span>}
                  </span>
                </span>
                <span className={'shrink-0 text-right text-xs font-semibold ' + tone.className}>
                  {tone.label}
                  {score != null && <span className="block font-normal text-parchment/50">{score > 0 ? '+' : ''}{num(score)}</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
