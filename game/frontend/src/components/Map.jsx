import { useEffect, useRef, useState } from 'react'
import { Application, Container, Graphics, Text } from 'pixi.js'
import { getMap } from '../api'
import { factionColor, factionLabel } from '../lib/format'

// Carte façon Age of History : mer bleue, terres (parchemin) découpées en
// provinces, empires colorés. Clic sur une province => elle se SOULÈVE (sélection).
// Clic sur SON armée => des FLÈCHES montrent où aller (terre, et mer si la techno
// « Navigation maritime » est acquise). Zoom molette + glisser. Conquête des
// provinces neutres en s'y déplaçant.

const SEA_TOP = 0x2b4a63
const SEA_BOT = 0x16222e
const LAND_NEUTRAL = 0xcdbb94   // terre neutre : parchemin/tan (vraie carte)
const BORDER_COLOR = 0x2b2417
const HOVER_LINE = 0xfdf6e3
const ARROW_LAND = 0xe8c267
const ARROW_SEA = 0x6fb7d6
const TECH_NAVALE = 'navigation_maritime'

function hexToNumber(hex) {
  if (typeof hex !== 'string') return LAND_NEUTRAL
  return parseInt(hex.replace('#', ''), 16)
}

const LUXE_BAT = { vin: 'ferme', grain: 'ferme', epices: 'marche', ivoire: 'marche', ambre: 'marche', pourpre: 'port', or: 'mine', fer: 'mine', sel: 'mine', marbre: 'carriere' }

export default function Map({ stateData, onSelectFaction, onMoveStack, onSelectProvince, refreshKey, marqueurs }) {
  const hostRef = useRef(null)
  const appRef = useRef(null)
  const worldRef = useRef(null)
  const labelLayerRef = useRef(null)
  const unitLayerRef = useRef(null)
  const arrowLayerRef = useRef(null)
  const marcheLayerRef = useRef(null)   // colonne en marche (animation)
  const marqueurLayerRef = useRef(null) // marqueurs d'événements du tour (batailles, feux…)
  const provLabelsRef = useRef(null)    // noms des provinces sans cité (visibles zoomé)
  const marqueursRef = useRef([])       // [{x, y, icone, t0}] en cours d'animation
  const [armeeSel, setArmeeSel] = useState(null) // {territoire, nom, effectif} : armée sélectionnée
  const marcheRef = useRef(null)        // {from,to,t0,duree,col,effectif}
  const dataRef = useRef(null)
  const stateRef = useRef(stateData)
  const hoveredRef = useRef(null)
  const [apercu, setApercu] = useState(null)  // survol : fiche province + puissance du rival
  const selProvRef = useRef(null)     // province soulevée (sélection)
  const selUnitTerrRef = useRef(null) // territoire de l'armée joueur sélectionnée
  const viewRef = useRef({ scale: 1, x: 0, y: 0 })
  const fitRef = useRef({ scale: 1 })
  const userAdjustedRef = useRef(false) // true dès que l'utilisateur zoome/déplace

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  stateRef.current = stateData

  function joueurId() { const st = stateRef.current; return st && st.meta && st.meta.joueur_pays }
  function playerTechs() {
    const st = stateRef.current; const j = joueurId()
    return new Set((st && st.pays && st.pays[j] && st.pays[j].technologies) || [])
  }
  function hasNaval() { return playerTechs().has(TECH_NAVALE) }

  // Centre des terres du joueur (pour ouvrir la carte chez lui).
  function centreJoueur() {
    const st = stateRef.current; const j = joueurId()
    const terrs = (st && st.pays && st.pays[j] && st.pays[j].territoires) || []
    const pts = terrs.map((id) => centreOf(id)).filter(Boolean)
    if (!pts.length) return null
    return [pts.reduce((s, p) => s + p[0], 0) / pts.length,
            pts.reduce((s, p) => s + p[1], 0) / pts.length]
  }

  function resolveFaction(t) {
    const st = stateRef.current
    // Partie en cours : l'ÉTAT fait foi. Une province que personne ne possède est
    // neutre — y compris la capitale d'une civilisation écartée de cette partie.
    if (st && st.pays) {
      for (const [pid, p] of Object.entries(st.pays)) {
        if (Array.isArray(p.territoires) && p.territoires.includes(t.id)) return pid
      }
      return null
    }
    return t.faction || null   // aperçu hors partie (menu)
  }
  function terrById(id) { return ((dataRef.current && dataRef.current.territoires) || []).find((x) => x.id === id) }
  function centreOf(id) { const t = terrById(id); return t && (t.centre || polygonCentroid(t.polygone)) }
  function adjacentsOf(id) { const t = terrById(id); return (t && t.adjacents) || [] }
  function seaAdjacentsOf(id) { const t = terrById(id); return (t && t.adjacents_mer) || [] }

  // Cases atteignables depuis une province : terre toujours, mer si techno navale.
  function reachable(terr) {
    const land = new Set(adjacentsOf(terr))
    const sea = hasNaval() ? new Set(seaAdjacentsOf(terr)) : new Set()
    return { land, sea, all: new Set([...land, ...sea]) }
  }

  function collectCities() {
    const st = stateRef.current; const data = dataRef.current; const out = []
    if (!st || !st.pays) return out
    const caps = new Set(((data && data.territoires) || []).filter((t) => t.capitale).map((t) => t.id))
    for (const [, p] of Object.entries(st.pays))
      for (const v of p.villes || []) {
        const pos = v.position || centreOf(v.territoire)
        if (pos) out.push({ nom: v.nom || v.id, pos, terr: v.territoire, batiments: v.batiments || [], construction: v.construction, capitale: caps.has(v.territoire) })
      }
    return out
  }
  function collectArmies() {
    const st = stateRef.current; const groups = {}
    if (!st || !st.pays) return []
    for (const [pid, p] of Object.entries(st.pays))
      for (const u of p.unites || []) {
        const key = `${u.territoire}|${pid}`
        if (!groups[key]) groups[key] = { faction: pid, territoire: u.territoire, effectif: 0, idsLibres: [], pos: centreOf(u.territoire) }
        groups[key].effectif += u.effectif || 1
        if (!u.a_bouge) groups[key].idsLibres.push(u.id)
      }
    return Object.values(groups).filter((g) => g.pos)
  }

  function fillFor(factionId) { return factionId ? hexToNumber(factionColor(factionId)) : LAND_NEUTRAL }

  // --- Animation de MARCHE : la colonne glisse de la province de départ vers sa
  // destination (façon Risk), avec une traînée et un badge qui suit. Purement
  // visuel : l'état réel est mis à jour par l'API en parallèle.
  function lancerMarche(from, to, col, effectif) {
    if (!from || !to) return
    const dist = Math.hypot(to[0] - from[0], to[1] - from[1])
    marcheRef.current = {
      from, to, t0: performance.now(),
      duree: Math.min(900, Math.max(380, dist * 3.2)),   // plus c'est loin, plus c'est long
      col, effectif,
    }
  }

  function animerMarche() {
    const layer = marcheLayerRef.current
    if (!layer) return
    const m = marcheRef.current
    if (!m) { if (layer.children.length) layer.removeChildren(); return }
    layer.removeChildren()
    const av = Math.min(1, (performance.now() - m.t0) / m.duree)
    // Adoucissement : départ vif, arrivée en douceur.
    const e = 1 - Math.pow(1 - av, 3)
    const x = m.from[0] + (m.to[0] - m.from[0]) * e
    const y = m.from[1] + (m.to[1] - m.from[1]) * e

    // Traînée : le chemin déjà parcouru s'estompe derrière la colonne.
    const trail = new Graphics()
    trail.moveTo(m.from[0], m.from[1]); trail.lineTo(x, y)
    trail.stroke({ width: 3, color: m.col, alpha: 0.45 * (1 - e) + 0.15 })
    trail.eventMode = 'none'; layer.addChild(trail)

    // Halo de progression + badge de la colonne.
    const halo = new Graphics(); halo.circle(x, y, 15 - 5 * e)
    halo.fill({ color: m.col, alpha: 0.30 * (1 - e) })
    halo.eventMode = 'none'; layer.addChild(halo)

    const badge = new Graphics(); badge.roundRect(x - 13, y - 30, 26, 18, 5)
    badge.fill({ color: m.col, alpha: 0.98 }); badge.stroke({ width: 2, color: ARROW_LAND })
    badge.eventMode = 'none'; layer.addChild(badge)
    const txt = new Text({ text: `⚔ ${m.effectif}`, style: { fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: '700', fill: 0xfdf6e3, stroke: { color: 0x14110c, width: 2 } } })
    txt.anchor.set(0.5); txt.position.set(x, y - 21); txt.eventMode = 'none'; layer.addChild(txt)

    if (av >= 1) { marcheRef.current = null; layer.removeChildren(); draw() }
  }

  // --- MARQUEURS D'ÉVÉNEMENTS : à chaque fin de tour, batailles, incendies,
  // révoltes… s'affichent LÀ OÙ ils ont eu lieu (anneau qui pulse, puis s'efface).
  // La liste textuelle reste ; ceci donne le « où » d'un coup d'œil.
  const MARQUEUR_DUREE = 9000
  function poserMarqueurs(liste) {
    const now = performance.now()
    marqueursRef.current = (liste || []).map((m, i) => {
      const c = centreOf(m.territoire); if (!c) return null
      // Décale les marqueurs qui tombent sur la même province.
      const memes = (liste || []).slice(0, i).filter((x) => x.territoire === m.territoire).length
      return { x: c[0] + memes * 14, y: c[1] - 4 - memes * 6, icone: m.icone || '!', t0: now }
    }).filter(Boolean)
  }
  function animerMarqueurs() {
    const layer = marqueurLayerRef.current; if (!layer) return
    const now = performance.now()
    const vivants = marqueursRef.current.filter((m) => now - m.t0 < MARQUEUR_DUREE)
    marqueursRef.current = vivants
    layer.removeChildren()
    if (!vivants.length) return
    const s = Math.max(0.35, 1 / (viewRef.current.scale || 1))  // taille constante à l'écran
    for (const m of vivants) {
      const age = (now - m.t0) / MARQUEUR_DUREE
      const fade = age > 0.75 ? 1 - (age - 0.75) / 0.25 : 1
      const pulse = 0.5 + 0.5 * Math.sin((now - m.t0) / 180)
      const ring = new Graphics()
      ring.circle(m.x, m.y, (11 + pulse * 7) * s)
      ring.stroke({ width: 2.2 * s, color: 0xe8c267, alpha: (0.35 + 0.45 * (1 - pulse)) * fade })
      ring.circle(m.x, m.y, 10 * s); ring.fill({ color: 0x14110c, alpha: 0.72 * fade })
      ring.eventMode = 'none'; layer.addChild(ring)
      const ic = new Text({ text: m.icone, style: { fontFamily: 'Georgia, serif', fontSize: 13 * s, fill: 0xffffff } })
      ic.anchor.set(0.5, 0.5); ic.position.set(m.x, m.y); ic.alpha = fade; ic.eventMode = 'none'; layer.addChild(ic)
    }
  }

  function draw() {
    const world = worldRef.current, labels = labelLayerRef.current
    const units = unitLayerRef.current, arrows = arrowLayerRef.current, data = dataRef.current
    if (!world || !labels || !units || !arrows || !data) return
    world.removeChildren(); labels.removeChildren(); units.removeChildren(); arrows.removeChildren()

    const reach = selUnitTerrRef.current ? reachable(selUnitTerrRef.current) : null

    for (const t of data.territoires || []) {
      const poly = t.polygone
      if (!Array.isArray(poly) || poly.length < 3) continue
      const factionId = resolveFaction(t)
      const flat = poly.flat()
      const lifted = selProvRef.current === t.id

      if (lifted) { // ombre portée sous la province soulevée
        const sh = new Graphics(); sh.poly(flat); sh.fill({ color: 0x000000, alpha: 0.5 })
        sh.position.set(0, 5); sh.eventMode = 'none'; world.addChild(sh)
      }
      const g = new Graphics()
      g.poly(flat)
      g.fill({ color: fillFor(factionId), alpha: factionId ? 0.96 : 0.88 })
      g.stroke({ width: 0.8, color: BORDER_COLOR, alpha: 0.9 })
      g.eventMode = 'static'; g.cursor = 'pointer'
      g.__terr = t; g.__factionId = factionId
      if (lifted) g.position.set(0, -6)
      g.on('pointerover', (e) => {
        hoveredRef.current = t.id; paint(g, t, factionId, true, reach)
        setApercu({ terr: t.id, nom: t.nom || t.id, faction: factionId, merveille: t.merveille || null, gisement: ((stateRef.current || {}).gisements || {})[t.id] || null, x: e.global.x, y: e.global.y })
      })
      g.on('pointermove', (e) => setApercu((a) => (a && a.terr === t.id ? { ...a, x: e.global.x, y: e.global.y } : a)))
      g.on('pointerout', () => {
        if (hoveredRef.current === t.id) hoveredRef.current = null
        paint(g, t, factionId, false, reach)
        setApercu((a) => (a && a.terr === t.id ? null : a))
      })
      g.on('pointertap', () => onProvinceTap(t, factionId))
      paint(g, t, factionId, hoveredRef.current === t.id, reach)
      world.addChild(g)
    }

    for (const c of collectCities()) {
      if (c.capitale) {
        // Capitale : étoile dorée laurée pour bien la démarquer.
        const ring = new Graphics(); ring.circle(c.pos[0], c.pos[1], 9)
        ring.fill({ color: 0x14110c, alpha: 0.55 }); ring.stroke({ width: 1.5, color: 0xe8c267, alpha: 0.9 })
        ring.eventMode = 'none'; labels.addChild(ring)
        drawStar(labels, c.pos[0], c.pos[1], 7, 3, 0xe8c267)
      } else {
        const dot = new Graphics(); dot.circle(c.pos[0], c.pos[1], 4)
        dot.fill({ color: 0x2b2417, alpha: 0.95 }); dot.stroke({ width: 2, color: 0xfdf6e3, alpha: 0.95 })
        dot.eventMode = 'none'; labels.addChild(dot)
      }
      const label = new Text({ text: c.nom, style: { fontFamily: 'Georgia, serif', fontSize: c.capitale ? 16 : 15, fontWeight: '700', fill: c.capitale ? 0xf3d488 : 0xfdf6e3, stroke: { color: 0x14110c, width: 3.5 } } })
      label.anchor.set(0.5, 0); label.position.set(c.pos[0], c.pos[1] + (c.capitale ? 10 : 6)); label.eventMode = 'none'; labels.addChild(label)

      // Bâtiments construits + échafaud (au-dessus du badge d'armée, pour ne pas
      // le recouvrir). Dessinés en Pixi Graphics (rendu fiable, sans emoji).
      const bats = c.batiments || []
      let bx = c.pos[0] - (bats.length * 7) / 2
      const by = c.pos[1] - 40
      for (const b of bats) {
        drawBuildingGlyph(labels, bx + 3.5, by, b)
        bx += 8
      }
      if (c.construction) {
        drawScaffold(labels, c.pos[0], by - 12)
        const pct = Math.round(100 * (c.construction.duree - c.construction.tours_restants) / c.construction.duree)
        const pb = new Text({ text: `${pct}%`, style: { fontFamily: 'Georgia, serif', fontSize: 10, fontWeight: '700', fill: 0xe8c267, stroke: { color: 0x14110c, width: 3 } } })
        pb.anchor.set(0, 0.5); pb.position.set(c.pos[0] + 8, by - 12); pb.eventMode = 'none'; labels.addChild(pb)
      }
    }

    // Noms des provinces SANS cité : invisibles à faible zoom (bruit), affichés dès
    // qu'on s'approche — « Annexer Sofia » n'oblige plus à chercher Sofia.
    const avecVille = new Set(collectCities().map((c) => c.terr))
    const provLabels = new Container(); provLabels.eventMode = 'none'
    for (const t of data.territoires || []) {
      if (avecVille.has(t.id)) continue
      const c = t.centre || polygonCentroid(t.polygone); if (!c) continue
      const lab = new Text({ text: t.nom || t.id, style: { fontFamily: 'Georgia, serif', fontSize: 11, fill: 0xf3e9d2, stroke: { color: 0x14110c, width: 3 } } })
      lab.anchor.set(0.5, 0.5); lab.position.set(c[0], c[1]); lab.alpha = 0.8; lab.eventMode = 'none'
      provLabels.addChild(lab)
    }
    labels.addChild(provLabels); provLabelsRef.current = provLabels
    ajusterEtiquettes()

    // GISEMENTS DE LUXE : pastille à droite du centre. Vive si le maître des lieux
    // l'exploite (cité + bâtiment), éteinte sinon — on voit d'un coup d'œil ce qui
    // dort encore sous la terre.
    const gisements = (stateRef.current && stateRef.current.gisements) || {}
    const LUXE_ICONE = { vin: '🍇', grain: '🌾', epices: '🌶', ivoire: '🐘', ambre: '🟠', pourpre: '🐚', or: '✨', fer: '⛏', sel: '🧂', marbre: '⬜' }
    for (const [tid, lx] of Object.entries(gisements)) {
      const c = centreOf(tid); if (!c) continue
      const prop = resolveFaction(terrById(tid) || { id: tid })
      const p = prop && stateRef.current.pays[prop]
      const exploite = !!(p && (p.villes || []).some((v) => v.territoire === tid && (v.batiments || []).length && (p.luxes_actifs || []).includes(lx)
        && v.batiments.includes(LUXE_BAT[lx])))
      const bg = new Graphics(); bg.circle(c[0] + 15, c[1] + 9, 8.5)
      bg.fill({ color: exploite ? 0x3a3014 : 0x14110c, alpha: exploite ? 0.95 : 0.6 })
      bg.stroke({ width: 1.4, color: exploite ? 0xe8c267 : 0x8a7d66, alpha: 0.95 })
      bg.eventMode = 'none'; labels.addChild(bg)
      const ic = new Text({ text: LUXE_ICONE[lx] || '•', style: { fontFamily: 'Georgia, serif', fontSize: 11 } })
      ic.anchor.set(0.5, 0.5); ic.position.set(c[0] + 15, c[1] + 9); ic.alpha = exploite ? 1 : 0.75; ic.eventMode = 'none'; labels.addChild(ic)
    }

    // Repères des merveilles sur la carte (✦ doré = active/intacte, grisé = ruine/site).
    const mervEtats = (stateRef.current && stateRef.current.merveilles) || {}
    for (const t of data.territoires || []) {
      if (!t.merveille) continue
      const c = t.centre || polygonCentroid(t.polygone)
      if (!c) continue
      const etat = (mervEtats[t.merveille.id] || {}).etat
      const naturelle = t.merveille.type === 'naturelle'
      const actif = naturelle || ['intacte', 'restauree', 'construite'].includes(etat)
      // Doré = monument (intact/restauré), vert = site naturel, grisé = ruine/site à fouiller.
      const col = naturelle ? 0x8fd19e : actif ? 0xe8c267 : 0x9a8c6a
      const bg = new Graphics(); bg.circle(c[0], c[1] - 2, 8.5)
      bg.fill({ color: 0x14110c, alpha: 0.6 }); bg.stroke({ width: 1.3, color: col, alpha: 0.95 })
      bg.eventMode = 'none'; labels.addChild(bg)
      const star = new Text({ text: naturelle ? '❋' : '✦', style: { fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: '700', fill: col, stroke: { color: 0x14110c, width: 2 } } })
      star.anchor.set(0.5, 0.5); star.position.set(c[0], c[1] - 2); star.eventMode = 'none'; labels.addChild(star)
    }

    // Hordes barbares / rebelles : campement menaçant + trait vers leur proie.
    const hordes = (stateRef.current && stateRef.current.hordes) || []
    for (const h of hordes) {
      const c = centreOf(h.territoire)
      if (!c) continue
      const cible = h.cible_territoire && centreOf(h.cible_territoire)
      if (cible) {  // flèche pointillée rouge vers la civilisation visée
        const g = new Graphics()
        const steps = 16
        for (let i = 0; i < steps; i += 2) {
          const x1 = c[0] + (cible[0] - c[0]) * (i / steps), y1 = c[1] + (cible[1] - c[1]) * (i / steps)
          const x2 = c[0] + (cible[0] - c[0]) * ((i + 1) / steps), y2 = c[1] + (cible[1] - c[1]) * ((i + 1) / steps)
          g.moveTo(x1, y1); g.lineTo(x2, y2)
        }
        g.stroke({ width: 1.6, color: 0xc0392b, alpha: 0.75 }); g.eventMode = 'none'; labels.addChild(g)
      }
      const dot = new Graphics(); dot.circle(c[0], c[1], 9)
      dot.fill({ color: 0x3b1512, alpha: 0.85 }); dot.stroke({ width: 2, color: 0xc0392b })
      dot.eventMode = 'none'; labels.addChild(dot)
      const ic = new Text({ text: '⚔', style: { fontFamily: 'Georgia, serif', fontSize: 12, fill: 0xf5d9a0 } })
      ic.anchor.set(0.5, 0.5); ic.position.set(c[0], c[1]); ic.eventMode = 'none'; labels.addChild(ic)
      const lab = new Text({
        text: `${h.nom} (${Math.round(h.force)})`,
        style: { fontFamily: 'Georgia, serif', fontSize: 11, fontWeight: '700', fill: 0xe07a68, stroke: { color: 0x14110c, width: 3 } },
      })
      lab.anchor.set(0.5, 1); lab.position.set(c[0], c[1] - 11); lab.eventMode = 'none'; labels.addChild(lab)
    }

    // Projets du conseiller (espions, garnisons…) : point à l'origine + trait vers la cible.
    const stPl = stateRef.current; const jid = joueurId()
    const mesProjets = (stPl && stPl.pays && stPl.pays[jid] && stPl.pays[jid].projets) || []
    const ICONE = { espionnage: '🕵', garnison: '🛡', sabotage: '🔥', commerce: '⚖' }
    mesProjets.forEach((p, pi) => {
      const base = centreOf(p.territoire); if (!base) return
      const o = [base[0] + (pi % 2 ? 11 : -11), base[1] - 14 - pi * 10]  // décale les points empilés
      const cible = p.cible_territoire && centreOf(p.cible_territoire)
      const actif = p.statut === 'actif'
      const col = actif ? 0x7fc4a0 : 0xd49a3a
      if (cible) {  // trait pointillé vers la cible
        const g = new Graphics()
        const steps = 14
        for (let i = 0; i < steps; i += 2) {
          const x1 = o[0] + (cible[0] - o[0]) * (i / steps), y1 = o[1] + (cible[1] - o[1]) * (i / steps)
          const x2 = o[0] + (cible[0] - o[0]) * ((i + 1) / steps), y2 = o[1] + (cible[1] - o[1]) * ((i + 1) / steps)
          g.moveTo(x1, y1); g.lineTo(x2, y2)
        }
        g.stroke({ width: 1.4, color: col, alpha: 0.8 }); g.eventMode = 'none'; labels.addChild(g)
      }
      const dot = new Graphics(); dot.circle(o[0], o[1], 6)
      dot.fill({ color: 0x14110c, alpha: 0.6 }); dot.stroke({ width: 1.4, color: col })
      dot.eventMode = 'none'; labels.addChild(dot)
      const ic = new Text({ text: ICONE[p.type] || '✦', style: { fontFamily: 'Georgia, serif', fontSize: 10 } })
      ic.anchor.set(0.5, 0.5); ic.position.set(o[0], o[1]); ic.eventMode = 'none'; labels.addChild(ic)
      const lab = new Text({ text: p.nom, style: { fontFamily: 'Georgia, serif', fontSize: 11, fontWeight: '700', fill: col, stroke: { color: 0x14110c, width: 3 } } })
      lab.anchor.set(0.5, 1); lab.position.set(o[0], o[1] - 8); lab.eventMode = 'none'; labels.addChild(lab)
    })

    const enMarche = marcheRef.current
    for (const a of collectArmies()) {
      if (enMarche && a.pos && Math.hypot(a.pos[0] - enMarche.from[0], a.pos[1] - enMarche.from[1]) < 2) continue
      const [x, y] = a.pos; const mine = a.faction === joueurId()
      const col = hexToNumber(factionColor(a.faction)); const sel = mine && selUnitTerrRef.current === a.territoire
      const badge = new Graphics(); badge.roundRect(x - 13, y - 30, 26, 18, 5)
      badge.fill({ color: col, alpha: 0.97 }); badge.stroke({ width: sel ? 2.5 : 1.4, color: sel ? ARROW_LAND : 0x14110c })
      badge.eventMode = 'none'
      units.addChild(badge)
      if (mine) {
        // Zone de clic GÉNÉREUSE autour du jeton (le badge seul était trop petit).
        const zone = new Graphics(); zone.circle(x, y - 20, 24)
        zone.fill({ color: 0xffffff, alpha: 0.001 })
        zone.eventMode = 'static'; zone.cursor = 'pointer'
        zone.on('pointertap', (e) => { e.stopPropagation && e.stopPropagation(); onArmyTap(a) })
        units.addChild(zone)
      }
      const txt = new Text({ text: `⚔ ${a.effectif}`, style: { fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: '700', fill: 0xfdf6e3, stroke: { color: 0x14110c, width: 2 } } })
      txt.anchor.set(0.5); txt.position.set(x, y - 21); txt.eventMode = 'none'; units.addChild(txt)
    }

    // Flèches de déplacement depuis l'armée sélectionnée.
    if (reach) {
      const from = centreOf(selUnitTerrRef.current)
      if (from) {
        for (const id of reach.land) drawArrow(arrows, from, centreOf(id), ARROW_LAND)
        for (const id of reach.sea) drawArrow(arrows, from, centreOf(id), ARROW_SEA)
      }
    }
  }

  function paint(g, t, factionId, hover, reach) {
    const flat = (t.polygone || []).flat()
    const isReach = reach && reach.all.has(t.id)
    const isSel = selProvRef.current === t.id
    g.clear(); g.poly(flat)
    g.fill({ color: fillFor(factionId), alpha: hover ? 1 : factionId ? 0.96 : 0.88 })
    // Priorité du liseré : sélection (or) > survol > destination atteignable.
    if (isSel) g.stroke({ width: 3, color: 0xe8c267, alpha: 1 })
    else g.stroke({ width: hover || isReach ? 2.4 : 0.8, color: hover ? HOVER_LINE : isReach ? ARROW_LAND : BORDER_COLOR, alpha: hover || isReach ? 1 : 0.9 })
  }

  function drawArrow(layer, a, b, color) {
    if (!a || !b) return
    const dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1
    const ux = dx / len, uy = dy / len
    const sx = a[0] + ux * 14, sy = a[1] + uy * 14       // démarre hors du centre
    const ex = b[0] - ux * 12, ey = b[1] - uy * 12       // s'arrête avant le centre cible
    const g = new Graphics()
    g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke({ width: 3, color, alpha: 0.95 })
    // pointe
    const ah = 9, aw = 6
    const bx = ex - ux * ah, by = ey - uy * ah; const px = -uy, py = ux
    g.poly([ex, ey, bx + px * aw, by + py * aw, bx - px * aw, by - py * aw]).fill({ color, alpha: 0.95 })
    g.eventMode = 'none'; layer.addChild(g)
  }

  // Reflète la sélection d'armée dans React (bandeau d'aide) sans redessiner.
  function majArmeeSel() {
    const terr = selUnitTerrRef.current
    if (!terr) { setArmeeSel(null); return }
    const grp = collectArmies().find((a) => a.territoire === terr && a.faction === joueurId())
    const tt = terrById(terr)
    setArmeeSel(grp ? { territoire: terr, nom: (tt && tt.nom) || terr, effectif: grp.effectif, libres: grp.idsLibres.length } : null)
  }
  function annulerSelection() {
    selUnitTerrRef.current = null; majArmeeSel(); draw()
  }

  function onProvinceTap(t, factionId) {
    selProvRef.current = t.id
    const armyTerr = selUnitTerrRef.current
    if (armyTerr && t.id !== armyTerr) {
      const r = reachable(armyTerr)
      if (r.all.has(t.id)) {
        const grp = collectArmies().find((a) => a.territoire === armyTerr && a.faction === joueurId())
        selUnitTerrRef.current = null; majArmeeSel()
        if (grp && grp.idsLibres.length && typeof onMoveStack === 'function') {
          // La colonne se met en marche TOUT DE SUITE (retour immédiat au joueur),
          // pendant que l'ordre part au serveur.
          lancerMarche(centreOf(armyTerr), centreOf(t.id),
                       hexToNumber(factionColor(joueurId())), grp.effectif)
          onMoveStack(grp.idsLibres, t.id)
        }
        draw(); return
      }
    }
    // Cliquer une de SES provinces où stationne une armée disponible la sélectionne
    // directement : plus besoin de viser le petit jeton.
    const mienne = factionId && factionId === joueurId()
    const garnison = mienne
      ? collectArmies().find((a) => a.territoire === t.id && a.faction === joueurId() && a.idsLibres.length)
      : null
    selUnitTerrRef.current = garnison && selUnitTerrRef.current !== t.id ? t.id : null
    majArmeeSel()
    if (typeof onSelectProvince === 'function') onSelectProvince({ id: t.id, faction: factionId, nom: t.nom, merveille: t.merveille || null, gisement: ((stateRef.current || {}).gisements || {})[t.id] || null })
    // (Le panneau de province propose « Parler à … » : on n'ouvre plus la
    // diplomatie d'office au moindre clic sur une terre étrangère.)
    draw()
  }

  function onArmyTap(a) {
    // Si une armée est DÉJÀ sélectionnée et que l'on clique une garnison voisine
    // atteignable, c'est un ordre de marche (on ne « désélectionne » pas bêtement).
    const dep = selUnitTerrRef.current
    if (dep && dep !== a.territoire && reachable(dep).all.has(a.territoire)) {
      onProvinceTap(terrById(a.territoire) || { id: a.territoire }, a.faction)
      return
    }
    selUnitTerrRef.current = dep === a.territoire ? null : a.territoire
    selProvRef.current = a.territoire
    majArmeeSel()
    // Cliquer son armée sélectionne AUSSI sa province : les boutons de gestion
    // (Production / Armée) apparaissent, comme le promet l'aide en bas d'écran.
    const t = terrById(a.territoire)
    if (t && typeof onSelectProvince === 'function')
      onSelectProvince({ id: t.id, faction: a.faction, nom: t.nom, merveille: t.merveille || null, gisement: ((stateRef.current || {}).gisements || {})[t.id] || null })
    draw()
  }

  function contentBBox() {
    const data = dataRef.current
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const t of (data && data.territoires) || [])
      for (const [x, y] of t.polygone || []) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y }
    if (!isFinite(minX)) { const m = (data && data.monde) || { largeur: 1000, hauteur: 700 }; return { minX: 0, minY: 0, maxX: m.largeur, maxY: m.hauteur } }
    return { minX, minY, maxX, maxY }
  }

  // Étiquettes de provinces : taille CONSTANTE à l'écran, visibles seulement
  // au-delà de 2× le zoom minimal (sinon la carte devient une soupe de noms).
  function ajusterEtiquettes() {
    const pl = provLabelsRef.current; if (!pl) return
    const { scale } = viewRef.current
    pl.visible = scale >= (fitRef.current.scale || 1) * 1.45
    if (!pl.visible) return
    const k = 1 / scale
    for (const lab of pl.children) lab.scale.set(k)
  }

  function applyTransform() {
    const { scale, x, y } = viewRef.current
    ajusterEtiquettes()
    for (const l of [worldRef.current, labelLayerRef.current, unitLayerRef.current, arrowLayerRef.current, marqueurLayerRef.current])
      if (l) { l.scale.set(scale); l.position.set(x, y) }
  }
  function layout(resetView = true) {
    const app = appRef.current, data = dataRef.current, host = hostRef.current
    if (!app || !data || !host) return
    // La carte bouge sous le curseur : l'ancien survol n'a plus de sens.
    hoveredRef.current = null; setApercu(null)
    const W = host.clientWidth || 800, H = host.clientHeight || 560
    app.renderer.resize(W, H)
    const bb = contentBBox()
    const cw = bb.maxX - bb.minX, ch = bb.maxY - bb.minY
    // « cover » = échelle minimale qui remplit l'écran (jamais de marge de mer).
    const cover = Math.max(W / cw, H / ch)
    fitRef.current = { scale: cover, bb }
    if (resetView) {
      // Démarre centré sur VOS terres (sinon on ouvrait la partie sur une mer vide
      // quand le joueur régnait loin de la Méditerranée — Francs, Bretons…).
      const scale = cover * 1.5
      let cx = bb.minX + cw * 0.5, cy = bb.minY + ch * 0.6
      const chez = centreJoueur()
      if (chez) { cx = chez[0]; cy = chez[1]; centreFaitRef.current = true }
      viewRef.current = { scale, x: W / 2 - cx * scale, y: H / 2 - cy * scale }
      clampView()
    }
    applyTransform()
  }
  function resizeOnly() {
    const app = appRef.current, host = hostRef.current
    if (!app || !host) return
    app.renderer.resize(host.clientWidth || 800, host.clientHeight || 560)
    applyTransform()
  }
  // Empêche de voir au-delà des bords : la carte couvre toujours l'écran.
  function clampView() {
    const v = viewRef.current, bb = fitRef.current.bb, host = hostRef.current
    if (!bb || !host) return
    const W = host.clientWidth || 800, H = host.clientHeight || 560
    v.scale = Math.max(fitRef.current.scale, Math.min(fitRef.current.scale * 14, v.scale))
    // Marge de débordement : un royaume en bord de carte (Reims, Camelot) peut être
    // centré à l'écran — le fond marin comble le vide. Sans elle, le cadrage se
    // rabattait vers le centre du monde et le joueur ouvrait la partie sur la Bavière.
    const mX = W * 0.35, mY = H * 0.35
    const minX = W - bb.maxX * v.scale - mX, maxX = -bb.minX * v.scale + mX
    const minY = H - bb.maxY * v.scale - mY, maxY = -bb.minY * v.scale + mY
    v.x = minX <= maxX ? Math.min(maxX, Math.max(minX, v.x)) : (minX + maxX) / 2
    v.y = minY <= maxY ? Math.min(maxY, Math.max(minY, v.y)) : (minY + maxY) / 2
  }
  function zoomAt(mx, my, factor) {
    const v = viewRef.current
    const ns = Math.max(fitRef.current.scale, Math.min(fitRef.current.scale * 14, v.scale * factor))
    const k = ns / v.scale; v.x = mx - (mx - v.x) * k; v.y = my - (my - v.y) * k; v.scale = ns
    userAdjustedRef.current = true; clampView(); applyTransform()
  }

  useEffect(() => {
    let destroyed = false; const app = new Application()
    async function init() {
      await app.init({ backgroundAlpha: 0, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true, resizeTo: hostRef.current || undefined })
      if (destroyed) { app.destroy(true, { children: true }); return }
      appRef.current = app; if (hostRef.current) hostRef.current.appendChild(app.canvas)
      worldRef.current = new Container(); app.stage.addChild(worldRef.current)
      arrowLayerRef.current = new Container(); app.stage.addChild(arrowLayerRef.current)
      labelLayerRef.current = new Container(); app.stage.addChild(labelLayerRef.current)
      unitLayerRef.current = new Container(); app.stage.addChild(unitLayerRef.current)
      marqueurLayerRef.current = new Container(); app.stage.addChild(marqueurLayerRef.current)
      marcheLayerRef.current = new Container(); app.stage.addChild(marcheLayerRef.current)
      app.ticker.add(animerMarche); app.ticker.add(animerMarqueurs)
      try { const data = await getMap(); if (destroyed) return; dataRef.current = data; setError(null); layout(true); draw() }
      catch (err) { if (!destroyed) setError(err.message || 'Carte indisponible') }
      finally { if (!destroyed) setLoading(false) }
    }
    init()
    // À l'ouverture/fermeture d'un panneau, on PRÉSERVE le zoom/pan de l'utilisateur.
    const ro = new ResizeObserver(() => { if (userAdjustedRef.current) resizeOnly(); else layout(true) })
    if (hostRef.current) ro.observe(hostRef.current)
    const host = hostRef.current; let dragging = false, last = null, moved = 0
    const onWheel = (e) => {
      e.preventDefault(); const r = host.getBoundingClientRect()
      // Zoom doux proportionnel au défilement (molette ET trackpad).
      const factor = Math.min(2, Math.max(0.5, Math.exp(-e.deltaY * 0.0016)))
      zoomAt(e.clientX - r.left, e.clientY - r.top, factor)
    }
    const onDown = (e) => { dragging = true; moved = 0; last = { x: e.clientX, y: e.clientY } }
    const onMove = (e) => { if (!dragging || !last) return; const dx = e.clientX - last.x, dy = e.clientY - last.y; moved += Math.abs(dx) + Math.abs(dy); if (moved > 4) { viewRef.current.x += dx; viewRef.current.y += dy; userAdjustedRef.current = true; clampView(); applyTransform(); if (host) host.style.cursor = 'grabbing' } last = { x: e.clientX, y: e.clientY } }
    const onUp = () => { dragging = false; if (host) host.style.cursor = '' }
    const onLeave = () => { hoveredRef.current = null; setApercu(null) }
    // Échap : annule la sélection d'armée (le joueur ne reste plus « collé » à ses flèches).
    const onKey = (e) => { if (e.key === 'Escape' && selUnitTerrRef.current) annulerSelection() }
    if (host) { host.addEventListener('wheel', onWheel, { passive: false }); host.addEventListener('pointerdown', onDown); host.addEventListener('pointerleave', onLeave) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp)
    return () => {
      destroyed = true; ro.disconnect()
      if (host) { host.removeEventListener('wheel', onWheel); host.removeEventListener('pointerdown', onDown); host.removeEventListener('pointerleave', onLeave) }
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp)
      if (appRef.current) appRef.current.destroy(true, { children: true, texture: true })
      appRef.current = null; worldRef.current = null; labelLayerRef.current = null; unitLayerRef.current = null; arrowLayerRef.current = null; marcheLayerRef.current = null; marqueurLayerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recentre sur les terres du joueur dès qu'on les connaît (une seule fois) : si
  // la carte s'est chargée avant l'état, le cadrage initial visait le milieu du monde.
  const centreFaitRef = useRef(false)
  useEffect(() => {
    if (!dataRef.current) return
    if (!centreFaitRef.current && !userAdjustedRef.current && centreJoueur()) { centreFaitRef.current = true; layout(true) }
    draw()
    // eslint-disable-next-line
  }, [stateData, refreshKey])
  useEffect(() => { if (dataRef.current && marqueurs) poserMarqueurs(marqueurs) /* eslint-disable-next-line */ }, [marqueurs])

  return (
    <div className="relative h-full w-full overflow-hidden"
         style={{ background: `linear-gradient(180deg, #2b4a63 0%, #1c3343 55%, #14222e 100%)` }}>
      <div ref={hostRef} className="h-full w-full" />
      {loading && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-parchment/80">Chargement de la carte…</div>}
      {error && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1c1813]/85 px-6 text-center"><p className="text-lg font-semibold text-terracotta">Carte indisponible</p><p className="max-w-sm text-sm text-parchment/80">{error}</p></div>}
      <MapLegend stateData={stateData} naval={hasNaval()} />
      {apercu && <ApercuProvince info={apercu} stateData={stateData} host={hostRef.current} />}
      {armeeSel && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-gold/60 bg-night/95 py-1.5 pl-4 pr-2 text-sm shadow-xl">
          <span className="text-gold">⚔ {armeeSel.nom}</span>
          <span className="text-parchment/70">force {armeeSel.effectif}</span>
          <span className="text-parchment/55">· cliquez une province fléchée</span>
          <button onClick={annulerSelection} className="pointer-events-auto rounded-full px-2 py-0.5 text-xs text-parchment/60 hover:bg-black/40 hover:text-parchment" title="Annuler (Échap)">✕</button>
        </div>
      )}
      <div className="absolute right-2 top-2 flex flex-col gap-1 rounded-lg border border-bronze-dark/50 bg-night/90 p-1 shadow-lg">
        <button onClick={() => zoomCenter(1.25)} title="Zoomer" className="h-8 w-8 rounded-md text-lg font-bold text-parchment hover:bg-ink-soft">+</button>
        <button onClick={() => zoomCenter(1 / 1.25)} title="Dézoomer" className="h-8 w-8 rounded-md text-lg font-bold text-parchment hover:bg-ink-soft">−</button>
        <button onClick={() => layout(true)} title="Recentrer sur mes terres" className="h-8 w-8 rounded-md text-sm text-parchment hover:bg-ink-soft">⤢</button>
      </div>
    </div>
  )

  function zoomCenter(f) { const host = hostRef.current; if (host) zoomAt(host.clientWidth / 2, host.clientHeight / 2, f) }
}

function MapLegend({ stateData, naval }) {
  const ids = []
  if (stateData && stateData.pays) for (const pid of Object.keys(stateData.pays)) ids.push(pid)
  else ids.push('rome', 'carthage', 'macedoine')
  return (
    <div className="absolute bottom-2 left-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-night/85 px-2.5 py-1.5 text-[11px] text-parchment shadow"
         title={naval ? 'Traversée maritime débloquée' : 'Mer : recherchez « Navigation maritime »'}>
      {ids.map((id) => (
        <span key={id} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-black/40" style={{ backgroundColor: (stateData && stateData.pays && stateData.pays[id] && stateData.pays[id].couleur) || factionColor(id) }} />
          <span>{(stateData && stateData.pays && stateData.pays[id] && stateData.pays[id].nom) || factionLabel(id)}</span>
        </span>
      ))}
      <span className="text-parchment/45">{naval ? '⚓' : '⚓ ✕'}</span>
    </div>
  )
}

function polygonCentroid(poly) {
  if (!Array.isArray(poly) || poly.length === 0) return null
  let x = 0, y = 0; for (const [px, py] of poly) { x += px; y += py }
  return [x / poly.length, y / poly.length]
}

const BAT_COLOR = {
  marche: 0xc9a227, grenier: 0x8a9a3a, aqueduc: 0x3a7bc0, murailles: 0x8a8a82,
  forum: 0xe7dcc0, agora: 0xe7dcc0, port: 0x2e86c1, camp_militaire: 0xb5462f,
}
// Petite « maison » tintée par type de bâtiment (rendu Pixi fiable).
function drawBuildingGlyph(layer, cx, cy, type) {
  const col = BAT_COLOR[type] || 0xcdbb94
  const g = new Graphics()
  g.poly([cx - 4, cy - 2, cx, cy - 7, cx + 4, cy - 2]); g.rect(cx - 3.5, cy - 2, 7, 6)
  g.fill({ color: col, alpha: 1 }); g.stroke({ width: 1, color: 0x14110c, alpha: 0.9 })
  g.eventMode = 'none'; layer.addChild(g)
}
// Étoile (marqueur de capitale).
function drawStar(layer, cx, cy, outer, inner, color) {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
  }
  const g = new Graphics()
  g.poly(pts); g.fill({ color, alpha: 1 }); g.stroke({ width: 1, color: 0x14110c, alpha: 0.9 })
  g.eventMode = 'none'; layer.addChild(g)
}
// Échafaud / grue : signale une construction en cours.
function drawScaffold(layer, cx, cy) {
  const g = new Graphics()
  g.moveTo(cx - 5, cy + 5); g.lineTo(cx - 5, cy - 7); g.lineTo(cx + 6, cy - 7)
  g.moveTo(cx - 8, cy + 5); g.lineTo(cx + 8, cy + 5)
  g.stroke({ width: 1.8, color: 0xe8c267, alpha: 1 })
  g.rect(cx + 3, cy - 2, 4, 4); g.fill({ color: 0xb5462f }); g.stroke({ width: 1, color: 0x14110c })
  g.eventMode = 'none'; layer.addChild(g)
}


const LUXE_NOMS = { vin: 'Vin', grain: 'Grain', epices: 'Épices', ivoire: 'Ivoire', ambre: 'Ambre', pourpre: 'Pourpre', or: "Filon d'or", fer: 'Fer riche', sel: 'Sel', marbre: 'Marbre' }
const LUXE_ICONES = { vin: '🍇', grain: '🌾', epices: '🌶', ivoire: '🐘', ambre: '🟠', pourpre: '🐚', or: '✨', fer: '⛏', sel: '🧂', marbre: '⬜' }
const LUXE_BAT_NOM = { ferme: 'une Ferme', marche: 'un Marché', port: 'un Port', mine: 'une Mine', carriere: 'une Carrière' }

// Fiche de survol : ce que le joueur peut lire d'un coup d'œil sur une province —
// et, si elle appartient à un rival, la PUISSANCE de ce rival, pour juger d'une
// attaque sans devoir ouvrir la diplomatie.
function ApercuProvince({ info, stateData, host }) {
  const pays = (stateData && stateData.pays) || {}
  const joueurId = stateData && stateData.meta && stateData.meta.joueur_pays
  const prop = info.faction ? pays[info.faction] : null

  let ville = null
  for (const p of Object.values(pays)) for (const v of p.villes || []) if (v.territoire === info.terr) ville = v
  const garnison = []
  for (const [pid, p] of Object.entries(pays))
    for (const u of p.unites || []) if (u.territoire === info.terr) garnison.push({ ...u, pid })

  const enGuerre = info.faction && info.faction !== joueurId &&
    (((stateData.diplomatie || {}).guerres_actives) || [])
      .some((g) => new Set([g.a, g.b]).has(info.faction) && new Set([g.a, g.b]).has(joueurId))

  const moi = pays[joueurId] || {}
  // Sans réseau d'espionnage, le moteur ne livre qu'une ESTIMATION des forces
  // des rivaux : on l'affiche comme telle plutôt que de mentir sur sa précision.
  const estime = prop && prop.puissance == null && prop.puissance_estimee != null
  const saPuissance = (prop && (prop.puissance != null ? prop.puissance : prop.puissance_estimee)) || 0
  // Le verdict compare les ARMÉES (pas le trésor) : c'est ce qui décide d'une attaque.
  const monArmee = moi.force_armee || 0
  const sonArmee = (prop && (prop.force_armee != null ? prop.force_armee : prop.force_armee_estimee)) || 0
  const rapport = monArmee > 0 ? sonArmee / monArmee : (sonArmee > 0 ? Infinity : null)
  const verdict = rapport == null ? null
    : rapport > 1.35 ? { t: 'Armée plus forte que la vôtre', c: 'text-red-300' }
    : rapport > 0.75 ? { t: 'Armées comparables', c: 'text-amber-300' }
    : { t: 'Armée plus faible que la vôtre', c: 'text-emerald-300' }

  // Bulle collée au curseur, rabattue si elle sortirait du cadre.
  const L = 226, H = 178
  const w = (host && host.clientWidth) || 900
  const h = (host && host.clientHeight) || 600
  const left = Math.min(Math.max(8, info.x + 16), w - L - 8)
  const top = Math.min(Math.max(8, info.y + 16), h - H - 8)

  return (
    <div className="pointer-events-none absolute z-20 rounded-lg border border-bronze-dark bg-night/97 px-3 py-2 shadow-2xl"
         style={{ left, top, width: L }}>
      <div className="font-display text-sm font-bold text-parchment">{info.nom}</div>
      <div className="text-[11px]" style={{ color: info.faction ? factionColor(info.faction) : '#9c8f74' }}>
        {info.faction ? factionLabel(info.faction, prop && prop.nom) : 'Terre sans maître'}
        {info.faction === joueurId && ' · vos terres'}
        {enGuerre && <span className="ml-1 text-red-300">⚔ en guerre</span>}
      </div>

      {info.gisement && (
        <div className="mt-1.5 text-[11px] text-amber-200">
          {LUXE_ICONES[info.gisement] || '•'} Gisement : {LUXE_NOMS[info.gisement] || info.gisement}
          <span className="text-parchment/50"> · {LUXE_BAT[info.gisement] ? `exploité par ${LUXE_BAT_NOM[LUXE_BAT[info.gisement]]}` : ''}</span>
        </div>
      )}
      {info.merveille && (
        <div className={'mt-1.5 text-[11px] font-semibold ' + (info.merveille.type === 'naturelle' ? 'text-emerald-300' : 'text-gold')}>
          {info.merveille.type === 'naturelle' ? '❋' : '✦'} {info.merveille.nom}
        </div>
      )}
      {ville && (
        <div className="mt-1.5 text-[11px] text-parchment/75">
          🏛 {ville.nom} · {Math.round(ville.population)} hab.
          {(ville.batiments || []).length > 0 && ` · ${ville.batiments.length} bâtiment${ville.batiments.length > 1 ? 's' : ''}`}
          {ville.fortifications > 0 && ` · remparts ${ville.fortifications}`}
        </div>
      )}
      <div className="text-[11px] text-parchment/75">
        {garnison.length > 0
          ? `⚔ ${garnison.length} unité${garnison.length > 1 ? 's' : ''} en garnison`
          : '⚔ Aucune troupe visible'}
      </div>

      {prop && info.faction !== joueurId && (
        <div className="mt-1.5 border-t border-bronze-dark/50 pt-1.5">
          <div className="text-[10px] uppercase tracking-widest text-bronze/80">Forces du rival</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/50" title="Armée du rival rapportée à la vôtre">
              <div className="h-full rounded-full"
                   style={{ width: `${Math.min(100, rapport == null ? 0 : rapport === Infinity ? 100 : (rapport / (rapport + 1)) * 100)}%`,
                            background: factionColor(info.faction) }} />
            </div>
            <span className="text-[11px] text-parchment/70">⚔ {estime ? '≈' : ''}{Math.round(sonArmee)} · ✦ {estime ? '≈' : ''}{Math.round(saPuissance)}</span>
          </div>
          {verdict && (
            <div className={'text-[11px] font-semibold ' + verdict.c}>
              {verdict.t}{estime && <span className="font-normal text-parchment/45"> (estimation)</span>}
            </div>
          )}
          <div className="text-[11px] text-parchment/60">
            {(prop.territoires || []).length} prov. ·
            {' '}{(prop.unites || []).length} unité{(prop.unites || []).length > 1 ? 's' : ''} ·
            {' '}stab. {Math.round(prop.stabilite || 0)}
          </div>
        </div>
      )}
    </div>
  )
}
