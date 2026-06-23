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

export default function Map({ stateData, onSelectFaction, onMoveStack, onSelectProvince, refreshKey }) {
  const hostRef = useRef(null)
  const appRef = useRef(null)
  const worldRef = useRef(null)
  const labelLayerRef = useRef(null)
  const unitLayerRef = useRef(null)
  const arrowLayerRef = useRef(null)
  const dataRef = useRef(null)
  const stateRef = useRef(stateData)
  const hoveredRef = useRef(null)
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

  function resolveFaction(t) {
    const st = stateRef.current
    if (st && st.pays) {
      for (const [pid, p] of Object.entries(st.pays)) {
        if (Array.isArray(p.territoires) && p.territoires.includes(t.id)) return pid
      }
    }
    return t.faction || null
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
        if (pos) out.push({ nom: v.nom || v.id, pos, batiments: v.batiments || [], construction: v.construction, capitale: caps.has(v.territoire) })
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
      g.on('pointerover', () => { hoveredRef.current = t.id; paint(g, t, factionId, true, reach) })
      g.on('pointerout', () => { if (hoveredRef.current === t.id) hoveredRef.current = null; paint(g, t, factionId, false, reach) })
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

    // Repères des merveilles sur la carte (✦ doré = active/intacte, grisé = ruine/site).
    const mervEtats = (stateRef.current && stateRef.current.merveilles) || {}
    for (const t of data.territoires || []) {
      if (!t.merveille) continue
      const c = t.centre || polygonCentroid(t.polygone)
      if (!c) continue
      const etat = (mervEtats[t.merveille.id] || {}).etat
      const actif = ['intacte', 'restauree', 'construite'].includes(etat)
      const col = actif ? 0xe8c267 : 0x9a8c6a
      const bg = new Graphics(); bg.circle(c[0], c[1] - 2, 8.5)
      bg.fill({ color: 0x14110c, alpha: 0.6 }); bg.stroke({ width: 1.3, color: col, alpha: 0.95 })
      bg.eventMode = 'none'; labels.addChild(bg)
      const star = new Text({ text: '✦', style: { fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: '700', fill: col, stroke: { color: 0x14110c, width: 2 } } })
      star.anchor.set(0.5, 0.5); star.position.set(c[0], c[1] - 2); star.eventMode = 'none'; labels.addChild(star)
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

    for (const a of collectArmies()) {
      const [x, y] = a.pos; const mine = a.faction === joueurId()
      const col = hexToNumber(factionColor(a.faction)); const sel = mine && selUnitTerrRef.current === a.territoire
      const badge = new Graphics(); badge.roundRect(x - 13, y - 30, 26, 18, 5)
      badge.fill({ color: col, alpha: 0.97 }); badge.stroke({ width: sel ? 2.5 : 1.4, color: sel ? ARROW_LAND : 0x14110c })
      badge.eventMode = mine ? 'static' : 'none'; badge.cursor = mine ? 'pointer' : 'default'
      if (mine) badge.on('pointertap', (e) => { e.stopPropagation && e.stopPropagation(); onArmyTap(a) })
      units.addChild(badge)
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
    g.clear(); g.poly(flat)
    g.fill({ color: fillFor(factionId), alpha: hover ? 1 : factionId ? 0.96 : 0.88 })
    g.stroke({ width: hover || isReach ? 2.4 : 0.8, color: hover ? HOVER_LINE : isReach ? ARROW_LAND : BORDER_COLOR, alpha: hover || isReach ? 1 : 0.9 })
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

  function onProvinceTap(t, factionId) {
    selProvRef.current = t.id
    const armyTerr = selUnitTerrRef.current
    if (armyTerr && t.id !== armyTerr) {
      const r = reachable(armyTerr)
      if (r.all.has(t.id)) {
        const grp = collectArmies().find((a) => a.territoire === armyTerr && a.faction === joueurId())
        selUnitTerrRef.current = null
        if (grp && grp.idsLibres.length && typeof onMoveStack === 'function') onMoveStack(grp.idsLibres, t.id)
        draw(); return
      }
    }
    selUnitTerrRef.current = null
    if (typeof onSelectProvince === 'function') onSelectProvince({ id: t.id, faction: factionId, nom: t.nom })
    if (factionId && factionId !== joueurId() && typeof onSelectFaction === 'function') onSelectFaction(factionId)
    draw()
  }

  function onArmyTap(a) {
    selUnitTerrRef.current = selUnitTerrRef.current === a.territoire ? null : a.territoire
    selProvRef.current = a.territoire
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

  function applyTransform() {
    const { scale, x, y } = viewRef.current
    for (const l of [worldRef.current, labelLayerRef.current, unitLayerRef.current, arrowLayerRef.current])
      if (l) { l.scale.set(scale); l.position.set(x, y) }
  }
  function layout(resetView = true) {
    const app = appRef.current, data = dataRef.current, host = hostRef.current
    if (!app || !data || !host) return
    const W = host.clientWidth || 800, H = host.clientHeight || 560
    app.renderer.resize(W, H)
    const bb = contentBBox()
    const cw = bb.maxX - bb.minX, ch = bb.maxY - bb.minY
    // « cover » = échelle minimale qui remplit l'écran (jamais de marge de mer).
    const cover = Math.max(W / cw, H / ch)
    fitRef.current = { scale: cover, bb }
    if (resetView) {
      // Démarre PLUS zoomé, centré sur la Méditerranée centrale.
      const scale = cover * 1.5
      const cx = bb.minX + cw * 0.5, cy = bb.minY + ch * 0.6
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
    const minX = W - bb.maxX * v.scale, maxX = -bb.minX * v.scale
    const minY = H - bb.maxY * v.scale, maxY = -bb.minY * v.scale
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
    if (host) { host.addEventListener('wheel', onWheel, { passive: false }); host.addEventListener('pointerdown', onDown) }
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp)
    return () => {
      destroyed = true; ro.disconnect()
      if (host) { host.removeEventListener('wheel', onWheel); host.removeEventListener('pointerdown', onDown) }
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp)
      if (appRef.current) appRef.current.destroy(true, { children: true, texture: true })
      appRef.current = null; worldRef.current = null; labelLayerRef.current = null; unitLayerRef.current = null; arrowLayerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { if (dataRef.current) draw() /* eslint-disable-next-line */ }, [stateData, refreshKey])

  return (
    <div className="relative h-full w-full overflow-hidden"
         style={{ background: `linear-gradient(180deg, #2b4a63 0%, #1c3343 55%, #14222e 100%)` }}>
      <div ref={hostRef} className="h-full w-full" />
      {loading && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-parchment/80">Chargement de la carte…</div>}
      {error && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1c1813]/85 px-6 text-center"><p className="text-lg font-semibold text-terracotta">Carte indisponible</p><p className="max-w-sm text-sm text-parchment/80">{error}</p></div>}
      <MapLegend stateData={stateData} naval={hasNaval()} />
      <div className="absolute bottom-2 right-2 flex flex-col gap-1">
        <button onClick={() => zoomCenter(1.25)} className="h-8 w-8 rounded-md bg-night/85 text-lg font-bold text-parchment shadow hover:bg-ink-soft">+</button>
        <button onClick={() => zoomCenter(1 / 1.25)} className="h-8 w-8 rounded-md bg-night/85 text-lg font-bold text-parchment shadow hover:bg-ink-soft">−</button>
        <button onClick={() => layout(true)} title="Recentrer" className="h-8 w-8 rounded-md bg-night/85 text-sm text-parchment shadow hover:bg-ink-soft">⤢</button>
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
    <div className="absolute bottom-2 left-2 flex flex-col gap-1 rounded-md bg-night/85 px-3 py-2 text-xs text-parchment shadow">
      {ids.map((id) => (
        <div key={id} className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm border border-black/40" style={{ backgroundColor: (stateData && stateData.pays && stateData.pays[id] && stateData.pays[id].couleur) || factionColor(id) }} />
          <span>{(stateData && stateData.pays && stateData.pays[id] && stateData.pays[id].nom) || factionLabel(id)}</span>
        </div>
      ))}
      <div className="mt-1 border-t border-bronze-dark/40 pt-1 text-[10px] text-parchment/60">
        {naval ? '⚓ Traversée maritime débloquée' : 'Mer : recherchez « Navigation maritime »'}
      </div>
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
