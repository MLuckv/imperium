// Glyphes VECTORIELS de la carte (Pixi Graphics) : cités, capitales, armées,
// merveilles, hordes. Dessinés en unités monde, nets à tous les zooms, dans le
// style « encre et lavis » du fond peint.
import { Graphics, Text } from 'pixi.js'

const ENCRE = 0x2b1f12
const CREME = 0xf1e6c8
const TUILE = 0xa7472f
const OR = 0xe8c267

export function hexNum(hex, repli = 0x8a7a5a) {
  if (typeof hex !== 'string') return repli
  return parseInt(hex.replace('#', ''), 16)
}
function assombrir(n, k) {
  const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k)
  return (r << 16) | (g << 8) | b
}

// Petite ville : trois maisons à toit de tuiles, une ombre portée.
export function dessinerCite(layer, x, y, taille = 1) {
  const g = new Graphics(); g.eventMode = 'none'
  const k = taille
  g.ellipse(x, y + 3.2 * k, 8 * k, 2.2 * k); g.fill({ color: 0x000000, alpha: 0.22 })
  const maisons = [[-4.6, 0.8, 4.2, 3.6], [0, -0.4, 5.2, 4.8], [4.4, 1, 3.8, 3.2]]
  for (const [dx, dy, w, h] of maisons) {
    const mx = x + dx * k, my = y + dy * k, ww = w * k, hh = h * k
    g.rect(mx - ww / 2, my - hh / 2 + 1 * k, ww, hh); g.fill({ color: CREME }); g.stroke({ width: 0.55, color: ENCRE })
    g.poly([mx - ww / 2 - 0.6 * k, my - hh / 2 + 1 * k, mx, my - hh / 2 - 2.4 * k, mx + ww / 2 + 0.6 * k, my - hh / 2 + 1 * k])
    g.fill({ color: TUILE }); g.stroke({ width: 0.55, color: ENCRE })
  }
  g.rect(x - 0.7 * k, y + 0.4 * k, 1.4 * k, 1.8 * k); g.fill({ color: ENCRE })
  layer.addChild(g)
  return g
}

// Capitale : enceinte crénelée, deux tours, temple au fronton, oriflamme aux
// couleurs du royaume.
export function dessinerCapitale(layer, x, y, couleur) {
  const g = new Graphics(); g.eventMode = 'none'
  const col = hexNum(couleur)
  g.ellipse(x, y + 5.5, 13, 3); g.fill({ color: 0x000000, alpha: 0.25 })
  // Enceinte
  g.rect(x - 10, y - 1, 20, 6.5); g.fill({ color: 0xe2d3ae }); g.stroke({ width: 0.6, color: ENCRE })
  for (let i = -9; i <= 7; i += 3.2) { g.rect(x + i, y - 2.6, 1.8, 1.8); g.fill({ color: 0xe2d3ae }); g.stroke({ width: 0.45, color: ENCRE }) }
  // Tours
  for (const dx of [-11, 8.4]) {
    g.rect(x + dx, y - 6, 2.8, 11.5); g.fill({ color: 0xd8c79c }); g.stroke({ width: 0.6, color: ENCRE })
    g.poly([x + dx - 0.6, y - 6, x + dx + 1.4, y - 9.2, x + dx + 3.4, y - 6]); g.fill({ color: TUILE }); g.stroke({ width: 0.5, color: ENCRE })
  }
  // Temple central
  g.rect(x - 5.2, y - 6.4, 10.4, 5.6); g.fill({ color: CREME }); g.stroke({ width: 0.55, color: ENCRE })
  for (let i = -3.8; i <= 3.8; i += 1.9) { g.moveTo(x + i, y - 6); g.lineTo(x + i, y - 1.1) }
  g.stroke({ width: 0.4, color: 0x8a7650 })
  g.poly([x - 6.2, y - 6.4, x, y - 9.8, x + 6.2, y - 6.4]); g.fill({ color: CREME }); g.stroke({ width: 0.6, color: ENCRE })
  // Porte
  g.moveTo(x - 1.6, y + 5.5); g.lineTo(x - 1.6, y + 2.6); g.arc(x, y + 2.6, 1.6, Math.PI, 0); g.lineTo(x + 1.6, y + 5.5)
  g.fill({ color: ENCRE })
  // Oriflamme
  g.moveTo(x, y - 9.8); g.lineTo(x, y - 16.5); g.stroke({ width: 0.7, color: ENCRE })
  g.poly([x, y - 16.5, x + 6, y - 15.3, x + 4.6, y - 14, x + 6, y - 12.7, x, y - 13.3]); g.fill({ color: col }); g.stroke({ width: 0.45, color: ENCRE })
  layer.addChild(g)
  return g
}

// Nom de cité : encre sombre auréolée de parchemin (lisible sur tous les lavis).
export function etiquetteCite(layer, x, y, nom, capitale) {
  const t = new Text({
    text: capitale ? nom.toUpperCase() : nom,
    style: {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: capitale ? 11 : 9.5, fontWeight: '700',
      letterSpacing: capitale ? 1.2 : 0.4,
      fill: capitale ? 0x24180c : 0x2e2214, stroke: { color: 0xf3e8cc, width: 3, join: 'round' },
    },
    resolution: 4,
  })
  t.anchor.set(0.5, 0); t.position.set(x, y); t.eventMode = 'none'
  layer.addChild(t)
  return t
}

// Jeton d'armée : écu aux couleurs du royaume, effectif gravé au centre.
export function dessinerBouclier(layer, x, y, couleur, effectif, selection = false, enMarche = false) {
  const g = new Graphics(); g.eventMode = 'none'
  const col = hexNum(couleur)
  const w = 8.5, h = 10.5
  const contour = [x - w, y - h, x + w, y - h, x + w, y - h * 0.15, x, y + h, x - w, y - h * 0.15]
  if (selection) { g.circle(x, y, 15); g.fill({ color: OR, alpha: 0.22 }) }
  g.poly(contour.map((v, i) => (i % 2 ? v + 1.4 : v + 0.9))); g.fill({ color: 0x000000, alpha: 0.35 })   // ombre
  g.poly(contour); g.fill({ color: col })
  g.poly([x - w, y - h, x + w, y - h, x + w, y - h * 0.55, x - w, y - h * 0.55]); g.fill({ color: 0xffffff, alpha: 0.14 })
  g.poly(contour); g.stroke({ width: selection ? 1.8 : 1.1, color: selection ? OR : assombrir(col, 0.45) })
  g.poly([x - w + 1.4, y - h + 1.4, x + w - 1.4, y - h + 1.4, x + w - 1.4, y - h * 0.15, x, y + h - 2.2, x - w + 1.4, y - h * 0.15])
  g.stroke({ width: 0.5, color: OR, alpha: enMarche ? 0.4 : 0.9 })
  layer.addChild(g)
  const t = new Text({
    text: String(effectif),
    style: { fontFamily: 'Cinzel, Georgia, serif', fontSize: 9, fontWeight: '700', fill: 0xfdf6e3, stroke: { color: assombrir(col, 0.35), width: 2.2 } },
    resolution: 4,
  })
  t.anchor.set(0.5); t.position.set(x, y - 1.2); t.eventMode = 'none'
  layer.addChild(t)
  return g
}

// Merveille : petit temple doré (monument), arbre (site naturel), colonnes
// brisées (ruine / site à fouiller).
export function dessinerMerveille(layer, x, y, type, active) {
  const g = new Graphics(); g.eventMode = 'none'
  g.circle(x, y, 6.6); g.fill({ color: 0x1d160d, alpha: 0.72 })
  g.circle(x, y, 6.6); g.stroke({ width: 0.9, color: type === 'naturelle' ? 0x8fd19e : active ? OR : 0x9a8c6a })
  if (type === 'naturelle') {
    g.moveTo(x, y + 3.6); g.lineTo(x, y + 0.6); g.stroke({ width: 0.8, color: 0xcfe7c4 })
    g.circle(x, y - 1, 3.2); g.fill({ color: 0x8fd19e })
  } else if (active) {
    g.poly([x - 4.2, y - 1.2, x, y - 4.2, x + 4.2, y - 1.2]); g.fill({ color: OR })
    for (const dx of [-3, -1, 1, 3]) { g.rect(x + dx - 0.45, y - 0.8, 0.9, 3.6) }
    g.fill({ color: OR })
    g.rect(x - 4.4, y + 2.8, 8.8, 0.9); g.fill({ color: OR })
  } else {
    for (const [dx, hh] of [[-2.6, 4.6], [0, 2.6], [2.6, 3.8]]) { g.rect(x + dx - 0.7, y + 3 - hh, 1.4, hh) }
    g.fill({ color: 0xb8aa88 })
    g.rect(x - 4, y + 3, 8, 0.9); g.fill({ color: 0xb8aa88 })
  }
  layer.addChild(g)
  return g
}

// Horde : étendard déchiré rouge sang.
export function dessinerHorde(layer, x, y) {
  const g = new Graphics(); g.eventMode = 'none'
  g.ellipse(x, y + 5, 7, 2); g.fill({ color: 0x000000, alpha: 0.3 })
  g.moveTo(x - 3, y + 5); g.lineTo(x - 3, y - 10); g.stroke({ width: 1, color: ENCRE })
  g.poly([x - 3, y - 10, x + 7, y - 8.6, x + 4.4, y - 6.6, x + 7.4, y - 4.6, x - 3, y - 4]); g.fill({ color: 0x8e1f16 }); g.stroke({ width: 0.6, color: ENCRE })
  g.circle(x + 1.6, y - 7, 1.3); g.fill({ color: 0xf1e2c4 })
  layer.addChild(g)
  return g
}
