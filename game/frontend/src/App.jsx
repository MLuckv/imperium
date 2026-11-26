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
import { PanoramaAntique, Banniere, Filet, Laurier } from './components/Decors'
import Medaillon from './components/Medaillon'
import Embleme from './components/Emblemes'

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
  if (booting) return <div className="menu-screen"><PanoramaAntique /><div className="titre-imperium">IMPERIVM</div><p className="menu-subtitle">Connexion…</p></div>
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
        <PanoramaAntique />
        <div className="menu-voile" />
        <div className="flex flex-col items-center" style={{ marginTop: '-8vh' }}>
          <div className="titre-imperium titre-brille">IMPERIVM</div>
          <Laurier className="-mt-1" largeur={150} />
          <p className="menu-subtitle">Grande stratégie — des souverains de toutes les époques, une seule Méditerranée</p>
          <div className="menu-carte mt-8">
            <button onClick={() => setScreen('civ')} disabled={busy} className="btn-fin-tour w-full justify-center rounded-md" style={{ fontSize: '1rem', padding: '0.85rem 1.5rem' }}>Nouvelle partie</button>
            {hasSavedGame && <button onClick={() => setScreen('game')} className="btn-hud w-full justify-center !py-2"><span className="hud-ico"><UiIcon id="journal" size={14} /></span>Reprendre la partie</button>}
            <button onClick={handleLoad} disabled={busy} className="btn-hud w-full justify-center !py-2"><span className="hud-ico"><UiIcon id="production" size={14} /></span>Charger (emplacement {SLOT})</button>
            <Filet className="mt-1 opacity-80" largeur={220} />
          </div>
        </div>
        {health && (
          <p className="absolute bottom-4 text-xs text-parchment/45">
            Conseillers et souverains : {health.modele_pret ? `prêts (${health.modele})` : health.ollama ? 'le modèle se charge…' : 'hors-ligne (répliques de secours)'}
          </p>
        )}
      </div>
    )
  }
  if (screen === 'civ') {
    return (
      <div className="menu-screen !justify-start overflow-y-auto py-10">
        <PanoramaAntique className="opacity-60" />
        <div className="menu-voile menu-voile-fort" />
        <div className="titre-imperium" style={{ fontSize: 'clamp(1.7rem,3.6vw,2.6rem)' }}>Choisissez votre civilisation</div>
        <Filet className="mt-2" largeur={300} />
        <p className="menu-subtitle">Vous débuterez avec une seule province et tout à bâtir.</p>

        {/* Nombre d'adversaires : les civilisations écartées n'existent pas dans la partie */}
        <div className="mt-5 flex flex-col items-center gap-2">
          <div className="font-display text-[11px] uppercase tracking-[0.25em] text-bronze">Adversaires</div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => { setNbIa(n); nbIaRef.current = n }}
                      className={'h-9 w-9 rounded-md border font-display text-sm font-semibold transition ' +
                        (nbIa === n
                          ? 'border-gold bg-gold/20 text-gold shadow-[0_0_12px_rgba(232,194,103,0.35)]'
                          : 'border-bronze-dark/60 bg-black/30 text-parchment/70 hover:border-bronze')}>
                {n}
              </button>
            ))}
          </div>
          <div className="text-[12px] italic text-parchment/60">
            {nbIa === 5 ? 'Toutes les civilisations entrent en lice.'
                        : `${nbIa} ${nbIa > 1 ? 'rivaux tirés' : 'rival tiré'} au sort ; les autres n'existeront pas.`}
          </div>
        </div>
        <div className="mt-7 grid w-full max-w-5xl grid-cols-1 gap-4 px-4 md:grid-cols-2 lg:grid-cols-3">
          {CIVS.map((c) => (
            <button key={c.id} onClick={() => startGame(c.id)} disabled={busy}
                    className="civ-carte group text-left" style={{ '--civ': factionColor(c.id) }}>
              <Banniere faction={c.id} couleur={factionColor(c.id)}
                        className="h-32 w-24 shrink-0 drop-shadow-[0_6px_8px_rgba(0,0,0,0.55)] transition-transform duration-300 group-hover:-rotate-2 group-hover:scale-105" />
              <div className="min-w-0">
                <div className="font-display text-xl font-bold tracking-wide" style={{ color: factionColor(c.id), textShadow: '0 1px 0 #000' }}>{c.nom}</div>
                <div className="flex items-center gap-1.5 font-display text-[11px] uppercase tracking-[0.18em] text-gold/90">
                  <Medaillon faction={c.id} taille={26} className="shrink-0" />{c.leader}
                </div>
                <div className="text-xs italic text-parchment/55">{c.style}</div>
                <p className="mt-1.5 text-[13px] leading-snug text-parchment/85">{c.desc}</p>
                <div className="mt-1.5 inline-block rounded border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-[11px] text-gold">Atout : {c.bonus}</div>
              </div>
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
                  <Medaillon faction={c.faction} taille={34} className="shrink-0 drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]" />
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
      <div className="barre-bas flex items-stretch">
        <div className="thin-scroll flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto px-2 py-1.5">
          <button onClick={() => setModal('tech')} className="btn-hud shrink-0" title="Technologies (T)"><span className="hud-ico"><UiIcon id="tech" size={15} /></span><span className="hidden lg:inline">Technos</span></button>
          <button onClick={() => setModal('dogmes')} className="btn-hud shrink-0" title="Dogmes (G)"><span className="hud-ico"><UiIcon id="dogmes" size={15} /></span><span className="hidden lg:inline">Dogmes</span></button>
          <button onClick={() => { setModal('civs'); setMsgIA(0) }} className="btn-hud relative shrink-0" title="Diplomatie (D)">
            <span className="hud-ico"><UiIcon id="diplomatie" size={15} /></span><span className="hidden lg:inline">Diplomatie</span>
            {msgIA > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{msgIA}</span>}
          </button>
          <button onClick={() => setModal('conseiller')} className="btn-hud shrink-0" title="Conseiller (C)"><span className="hud-ico"><UiIcon id="conseiller" size={15} /></span><span className="hidden lg:inline">Conseiller</span></button>
          <button onClick={() => { setModal('journal'); setJournalVu(nbJournal) }} className="btn-hud relative shrink-0" title="Journal du règne (J)">
            <span className="hud-ico"><UiIcon id="journal" size={15} /></span><span className="hidden lg:inline">Journal</span>
            {nbJournal > journalVu && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-ink">{nbJournal - journalVu}</span>}
          </button>

          {impotsOpts.length > 0 && (
            <select value={(joueur && joueur.impots) || 'normal'} onChange={(e) => setImpots(e.target.value)}
                    title="Niveau d'imposition" className="shrink-0 rounded-full border border-bronze-dark/60 bg-black/40 px-3 py-1.5 text-xs text-parchment">
              {impotsOpts.map((o) => <option key={o.id} value={o.id}>Impôts : {o.nom} ({o.stab >= 0 ? '+' : ''}{o.stab} stab)</option>)}
            </select>
          )}

          {/* Sauver / Menu, repliés pour ne plus disputer la place aux vraies actions */}
          <div className="shrink-0">
            <button onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect()
                      setMenuOuvert(menuOuvert ? null : { bas: window.innerHeight - r.top + 4, droite: window.innerWidth - r.right })
                    }}
                    className="btn-hud !pr-1" title="Partie"><span className="hud-ico"><UiIcon id="menu" size={15} /></span></button>
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

        <div className="flex shrink-0 items-center px-3 py-1.5">
          <div className="flex items-stretch gap-px overflow-hidden rounded-full shadow-[0_0_18px_rgba(232,194,103,0.25)]">
            <button onClick={() => handleEndTurn(1)} disabled={busy} className="btn-fin-tour"
                    title={armeesPretes > 0 ? `${armeesPretes} armée(s) peuvent encore marcher — Espace` : "Avancer d'un mois (Espace)"}>
              {busy ? 'Le monde avance…' : 'Fin de tour ▸'}
              {!busy && armeesPretes > 0 && (
                <span className="ml-2 rounded-full bg-ink/30 px-1.5 text-[11px] font-bold" title="Armées encore disponibles">
                  ⚔ {armeesPretes}
                </span>
              )}
            </button>
            <button onClick={() => handleEndTurn(3)} disabled={busy} className="btn-fin-tour-mini" title="Avancer de 3 mois">+3 m</button>
            <button onClick={() => handleEndTurn(12)} disabled={busy} className="btn-fin-tour-mini" title="Avancer d'un an (12 mois)">+1 an</button>
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
// des rivaux (terres, armées, puissance, traités, guerre), façon Civilization.
const estClair = (hex) => {
  const n = parseInt((hex || '#000').slice(1), 16)
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.55
}
const TRAITE_LABEL = { alliance: 'Alliance', non_agression: 'Non-agression', route_commerciale: 'Route commerciale', commercial: 'Commerce', traite_commercial: 'Commerce' }
function CivPicker({ autres, state, joueur, joueurId, onPick, onClose }) {
  const guerres = ((state.diplomatie || {}).guerres_actives) || []
  const traites = ((state.diplomatie || {}).traites_actifs) || []
  const maPuissance = (joueur && joueur.puissance) || 0
  const monArmee = (joueur && joueur.force_armee) || 0
  const maCouleur = factionColor(joueurId, joueur && joueur.couleur)
  const parties = (tr) => (tr.parties && tr.parties.length ? tr.parties : [tr.a, tr.b].filter(Boolean))
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="fenetre w-full max-w-3xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-4">
          <Medaillon faction={joueurId} taille={52} className="shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
          <div className="min-w-0 flex-1">
            <h2 className="titre-fenetre">Chancellerie</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-parchment/60">
              <span>Les souverains connus du monde</span>
              <span className="pastille-stat"><UiIcon id="armee" size={12} /> {num(monArmee)}</span>
              <span className="pastille-stat"><UiIcon id="merveille" size={12} /> {num(maPuissance)}</span>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Fermer</button>
        </div>
        <div className="flex flex-col gap-2.5">
          {autres.map((id) => {
            const p = state.pays[id] || {}
            const couleur = factionColor(id, p.couleur)
            const score = joueur && joueur.reputation && joueur.reputation[id]
            const tone = reputationTone(score)
            const enGuerre = guerres.some((g) => new Set([g.a, g.b]).has(id) && new Set([g.a, g.b]).has(joueurId))
            const mesTraites = traites.filter((tr) => parties(tr).includes(id) && parties(tr).includes(joueurId))
            const allie = mesTraites.some((tr) => tr.type === 'alliance')
            const statut = enGuerre ? { t: 'En guerre', c: 'statut-guerre' } : allie ? { t: 'Alliés', c: 'statut-allie' } : { t: 'En paix', c: 'statut-paix' }
            const puissance = p.puissance != null ? p.puissance : p.puissance_estimee
            const estime = p.puissance == null
            const armee = (p.force_armee != null ? p.force_armee : p.force_armee_estimee) || 0
            const part = monArmee + armee > 0 ? monArmee / (monArmee + armee) : 0.5
            const rapport = monArmee > 0 ? armee / monArmee : (armee > 0 ? Infinity : null)
            const force = rapport == null ? null : rapport > 1.35 ? { t: 'Armée plus forte que la vôtre', c: 'text-red-300' }
              : rapport > 0.75 ? { t: 'Armées comparables', c: 'text-amber-200' } : { t: 'Armée plus faible', c: 'text-emerald-300' }
            const s = Math.max(-100, Math.min(100, score || 0))
            return (
              <button key={id} onClick={() => onPick(id)} className="carte-rival group" style={{ '--c': couleur }}>
                <span className="carte-rival-bande"><Embleme faction={id} taille={24} style={{ color: estClair(couleur) ? '#3a2508' : '#f7e6b5', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.5))' }} /></span>
                <Medaillon faction={id} taille={64} className="shrink-0 drop-shadow-[0_3px_5px_rgba(0,0,0,0.65)]" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-display text-base font-bold tracking-wide" style={{ color: couleur, filter: 'brightness(1.5) saturate(0.8)' }}>{factionLabel(id, p.nom)}</span>
                    <span className="font-serif text-[13px] italic text-parchment/70">{leaderName(id)}</span>
                    <span className={'statut-ruban ' + statut.c}>{statut.t}</span>
                    {mesTraites.filter((tr) => tr.type !== 'alliance').map((tr, i) => <span key={tr.type + i} className="statut-ruban statut-traite">{TRAITE_LABEL[tr.type] || tr.type}</span>)}
                  </span>
                  <span className="mt-2 grid grid-cols-[1fr_1fr] gap-x-5 gap-y-1">
                    <span>
                      <span className="flex justify-between text-[10px] uppercase tracking-[0.14em] text-parchment/45"><span>Opinion</span><span className={tone.className + ' normal-case tracking-normal font-semibold'}>{tone.label}{score != null && ` (${score > 0 ? '+' : ''}${num(score)})`}</span></span>
                      <span className="jauge-opinion">
                        <span className="jauge-opinion-milieu" />
                        <span className="jauge-opinion-rempli" style={{ left: s < 0 ? `${50 + s / 2}%` : '50%', width: `${Math.abs(s) / 2}%`, background: tone.bar }} />
                        <span className="jauge-opinion-curseur" style={{ left: `${50 + s / 2}%` }} />
                      </span>
                    </span>
                    <span>
                      <span className="flex justify-between text-[10px] uppercase tracking-[0.14em] text-parchment/45"><span>Rapport de forces</span>{force && <span className={force.c + ' normal-case tracking-normal font-semibold'}>{force.t}</span>}</span>
                      <span className="jauge-forces">
                        <span style={{ width: `${part * 100}%`, background: maCouleur }} />
                        <span style={{ flex: 1, background: couleur }} />
                      </span>
                    </span>
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-parchment/75">
                    <span className="pastille-stat"><UiIcon id="annexer" size={12} /> {(p.territoires || []).length} province{(p.territoires || []).length > 1 ? 's' : ''}</span>
                    <span className="pastille-stat"><UiIcon id="armee" size={12} /> {(p.unites || []).length} armée{(p.unites || []).length > 1 ? 's' : ''} · {estime ? '≈' : ''}{num(armee)}</span>
                    {puissance != null && <span className="pastille-stat"><UiIcon id="merveille" size={12} /> Puissance {estime ? '≈' : ''}{num(puissance)}</span>}
                  </span>
                </span>
                <span className="carte-rival-parler">Parler<span className="ml-1 transition group-hover:translate-x-0.5">›</span></span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
