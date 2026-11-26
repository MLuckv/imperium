// ARMÉES SUR LA CARTE — figurines vectorielles (fantassin, cavalier, éléphant,
// trirème) surmontées d'un DRAPEAU D'UNITÉ façon Civilization : écusson aux
// couleurs du royaume, icône du type d'unité, effectif, barre de moral.
// Les figurines s'animent : pas cadencé pendant la marche, balancement de la
// trirème, respiration de l'armée sélectionnée.
import { Container, Graphics, Text } from 'pixi.js'

const ENCRE = 0x24180c
const PEAU = 0xe2b78c
const BRONZE = 0xc0913f
const BOIS = 0x6b4a2a
const OR = 0xe8c267

export function hexNum(hex, repli = 0x8a7a5a) {
  if (typeof hex === 'number') return hex
  if (typeof hex !== 'string') return repli
  return parseInt(hex.replace('#', ''), 16)
}
function nuance(n, k) {
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)))
  return (f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)
}

export function categorie(type) {
  if (type === 'trireme') return 'navire'
  if (type === 'cavalerie' || type === 'chevalier') return 'cavalier'
  if (type === 'elephant') return 'elephant'
  return 'fantassin'
}
const FORCE = { levee: 2, infanterie_legere: 4, legionnaire: 7, hoplite: 7, phalange: 8, cavalerie: 6, elephant: 12, mercenaire: 6, trireme: 5, chevalier: 10 }
// Type dominant d'une pile (le plus fort), pour la figurine et l'icône.
export function typeDominant(types) {
  return [...types].sort((a, b) => (FORCE[b] || 0) - (FORCE[a] || 0))[0] || 'levee'
}

// ---------------------------------------------------------------- figurines
// Origine = pieds ; la figurine regarde vers la droite (sens = -1 : vers la gauche).
function fantassin(g, col, phase, marche, type) {
  const sombre = nuance(col, 0.62)
  const balance = marche ? Math.sin(phase) * 0.55 : 0
  const bob = marche ? -Math.abs(Math.sin(phase)) * 0.6 : 0
  g.ellipse(0, 0.4, 3.6, 1.1); g.fill({ color: 0x000000, alpha: 0.28 })
  // Jambes (en ciseaux pendant la marche).
  for (const k of [1, -1]) {
    const a = balance * k
    g.moveTo(0, -4.6 + bob); g.lineTo(Math.sin(a) * 4.8, -4.6 + bob + Math.cos(a) * 4.8)
  }
  g.stroke({ width: 1.25, color: 0x3b2a1a, cap: 'round' })
  // Tunique et ptéryges.
  g.poly([-1.9, -4.4 + bob, 2.1, -4.4 + bob, 2.3, -9.6 + bob, -2.1, -9.6 + bob]); g.fill({ color: col }); g.stroke({ width: 0.45, color: ENCRE })
  g.rect(-2, -5.2 + bob, 4.2, 0.9); g.fill({ color: nuance(col, 1.25) })
  // Lance (ou sarisse pour la phalange) tenue à droite.
  const long = type === 'phalange' ? 21 : 15
  g.moveTo(3.1, -2 + bob); g.lineTo(3.8, -2 - long + bob); g.stroke({ width: 0.7, color: BOIS })
  g.poly([3.8, -2.6 - long + bob, 3.1, -1 - long + bob, 4.5, -1 - long + bob]); g.fill({ color: 0xd8d0c0 })
  // Bouclier : scutum rectangulaire (légion) ou aspis ronde.
  if (type === 'legionnaire' || type === 'mercenaire') {
    g.roundRect(-3.9, -10.4 + bob, 3.6, 6.6, 0.8); g.fill({ color: sombre }); g.stroke({ width: 0.55, color: OR })
    g.circle(-2.1, -7.1 + bob, 0.6); g.fill({ color: OR })
  } else if (type !== 'levee') {
    g.circle(-1.6, -7.2 + bob, 3.1); g.fill({ color: sombre }); g.stroke({ width: 0.55, color: OR })
    g.circle(-1.6, -7.2 + bob, 0.7); g.fill({ color: OR })
  }
  // Tête, casque et cimier aux couleurs du royaume.
  g.circle(0.3, -11.6 + bob, 1.75); g.fill({ color: PEAU }); g.stroke({ width: 0.4, color: ENCRE })
  if (type !== 'levee') {
    g.arc(0.3, -11.7 + bob, 1.95, Math.PI, 0); g.fill({ color: BRONZE }); g.stroke({ width: 0.4, color: ENCRE })
    g.moveTo(-1.7, -13.5 + bob); g.quadraticCurveTo(0.3, -15.4 + bob, 2.2, -13.2 + bob); g.stroke({ width: 1.1, color: nuance(col, 1.15), cap: 'round' })
  }
}

function cavalier(g, col, phase, marche) {
  const bob = marche ? -Math.abs(Math.sin(phase)) * 0.8 : 0
  g.ellipse(0, 0.5, 6, 1.4); g.fill({ color: 0x000000, alpha: 0.28 })
  // Pattes du cheval (galop alterné).
  const pattes = [[-3.6, 1], [-2.2, -1], [2.6, 1], [3.8, -1]]
  for (const [x, k] of pattes) {
    const a = marche ? Math.sin(phase + (k > 0 ? 0 : Math.PI)) * 0.5 : 0
    g.moveTo(x, -4.2 + bob); g.lineTo(x + Math.sin(a) * 4.3, -4.2 + bob + Math.cos(a) * 4.3)
  }
  g.stroke({ width: 1.1, color: 0x4a3220, cap: 'round' })
  // Corps, encolure, tête, queue.
  g.ellipse(0, -5.6 + bob, 5.2, 2.5); g.fill({ color: 0x8a5a34 }); g.stroke({ width: 0.45, color: ENCRE })
  g.poly([3.6, -6.6 + bob, 5.8, -10.6 + bob, 8.2, -9.8 + bob, 7.6, -8.4 + bob, 5.6, -5.4 + bob]); g.fill({ color: 0x8a5a34 }); g.stroke({ width: 0.45, color: ENCRE })
  g.moveTo(-5, -6.4 + bob); g.quadraticCurveTo(-7.4, -6 + bob, -7.2, -2.8 + bob); g.stroke({ width: 1, color: 0x3a2414, cap: 'round' })
  // Housse aux couleurs du royaume.
  g.poly([-3, -7.6 + bob, 2.6, -7.6 + bob, 2, -4.2 + bob, -2.6, -4.2 + bob]); g.fill({ color: col }); g.stroke({ width: 0.4, color: ENCRE })
  // Cavalier.
  g.poly([-1.3, -7.6 + bob, 1.5, -7.6 + bob, 1.4, -12 + bob, -1.1, -12 + bob]); g.fill({ color: nuance(col, 0.8) }); g.stroke({ width: 0.4, color: ENCRE })
  g.circle(0.2, -13.6 + bob, 1.55); g.fill({ color: PEAU }); g.stroke({ width: 0.4, color: ENCRE })
  g.arc(0.2, -13.7 + bob, 1.75, Math.PI, 0); g.fill({ color: BRONZE })
  g.moveTo(1.6, -9 + bob); g.lineTo(9.5, -15.5 + bob); g.stroke({ width: 0.7, color: BOIS })
  g.poly([9.5, -15.5 + bob, 8.5, -14.2 + bob, 9.9, -14.4 + bob]); g.fill({ color: 0xd8d0c0 })
}

function elephant(g, col, phase, marche) {
  const bob = marche ? -Math.abs(Math.sin(phase)) * 0.5 : 0
  g.ellipse(0, 0.6, 7, 1.6); g.fill({ color: 0x000000, alpha: 0.28 })
  for (const [x, k] of [[-4, 1], [-1.6, -1], [2, 1], [4.2, -1]]) {
    const a = marche ? Math.sin(phase + (k > 0 ? 0 : Math.PI)) * 0.3 : 0
    g.moveTo(x, -4 + bob); g.lineTo(x + Math.sin(a) * 4, -4 + bob + Math.cos(a) * 4)
  }
  g.stroke({ width: 2.1, color: 0x6e6a66, cap: 'round' })
  g.ellipse(0, -7 + bob, 6.4, 4); g.fill({ color: 0x8c8782 }); g.stroke({ width: 0.5, color: ENCRE })
  g.circle(6, -8.4 + bob, 2.6); g.fill({ color: 0x8c8782 }); g.stroke({ width: 0.5, color: ENCRE })
  g.moveTo(8, -7.6 + bob); g.quadraticCurveTo(9.6, -4 + bob, 8.2, -1.6 + bob); g.stroke({ width: 1.3, color: 0x8c8782, cap: 'round' })
  g.moveTo(7.2, -6.8 + bob); g.lineTo(9.4, -6 + bob); g.stroke({ width: 0.7, color: 0xf1e6c8, cap: 'round' })
  g.rect(-3.4, -14 + bob, 6, 4.2); g.fill({ color: col }); g.stroke({ width: 0.5, color: ENCRE })
  g.moveTo(-3.4, -14 + bob); g.lineTo(-3.4, -15 + bob); g.moveTo(2.6, -14 + bob); g.lineTo(2.6, -15 + bob); g.stroke({ width: 0.6, color: ENCRE })
}

function navire(g, col, phase) {
  const roulis = Math.sin(phase * 0.6) * 0.8
  g.ellipse(0, 1, 9, 1.6); g.fill({ color: 0x0b1a22, alpha: 0.25 })
  g.poly([-9, -2 + roulis * 0.2, 8, -2 - roulis * 0.2, 10.5, -4.5, 7.5, 0.6, -7, 0.6]); g.fill({ color: 0x5a3a22 }); g.stroke({ width: 0.5, color: ENCRE })
  for (let i = 0; i < 5; i++) { g.moveTo(-6 + i * 3, -0.6); g.lineTo(-7.2 + i * 3 + Math.sin(phase + i) * 0.6, 2.6) }
  g.stroke({ width: 0.55, color: 0x3a2414 })
  g.moveTo(0, -2); g.lineTo(0, -15); g.stroke({ width: 0.8, color: BOIS })
  g.poly([-5.2, -14, 5, -14, 4.6, -5.4, -4.8, -5.4]); g.fill({ color: col }); g.stroke({ width: 0.45, color: ENCRE })
  g.moveTo(-5.2, -9.7); g.lineTo(5, -9.7); g.stroke({ width: 0.35, color: nuance(col, 1.35) })
}

export function dessinerFigurine(g, type, couleur, phase = 0, marche = false) {
  const col = hexNum(couleur)
  const cat = categorie(type)
  if (cat === 'navire') navire(g, col, phase)
  else if (cat === 'cavalier') cavalier(g, col, phase, marche)
  else if (cat === 'elephant') elephant(g, col, phase, marche)
  else fantassin(g, col, phase, marche, type)
}

// ---------------------------------------------------------------- drapeau d'unité
function iconeType(g, cat, x, y) {
  const B = 0xfdf6e3
  if (cat === 'cavalier') {
    g.poly([x - 3, y + 3.4, x - 2.4, y - 0.4, x - 0.2, y - 2.8, x + 0.6, y - 4.2, x + 1.4, y - 2.6, x + 3.4, y - 1.6, x + 2.8, y - 0.4, x + 1, y - 0.6, x + 0.6, y + 3.4])
    g.fill({ color: B })
  } else if (cat === 'navire') {
    g.poly([x - 4, y + 1.4, x + 4, y + 1.4, x + 2.8, y + 3.4, x - 2.8, y + 3.4]); g.fill({ color: B })
    g.poly([x - 0.2, y - 4, x - 0.2, y + 0.8, x - 3.4, y + 0.8]); g.poly([x + 0.4, y - 3.4, x + 3.4, y + 0.8, x + 0.4, y + 0.8]); g.fill({ color: B })
  } else if (cat === 'elephant') {
    g.ellipse(x - 0.6, y, 3, 2.3); g.fill({ color: B })
    g.moveTo(x + 2, y - 0.4); g.quadraticCurveTo(x + 3.8, y + 1.4, x + 3, y + 3.6); g.stroke({ width: 1, color: B, cap: 'round' })
    g.rect(x - 3, y + 1.4, 1, 2.2); g.rect(x - 0.4, y + 1.4, 1, 2.2); g.fill({ color: B })
  } else {  // fantassin : glaive
    g.poly([x - 0.75, y - 4.2, x + 0.75, y - 4.2, x + 0.75, y + 1.2, x, y + 2.2, x - 0.75, y + 1.2]); g.fill({ color: B })
    g.rect(x - 2.6, y + 1.6, 5.2, 0.9); g.fill({ color: B })
    g.rect(x - 0.5, y + 2.5, 1, 1.6); g.fill({ color: B })
  }
}

export function dessinerDrapeau(g, couleur, effectif, type, moral = 100, selection = false, enRepos = false) {
  const col = hexNum(couleur)
  const y0 = -31
  const W = 16, H = 13
  // Hampe et ombre.
  g.moveTo(0, y0 + H / 2 + 2); g.lineTo(0, -19); g.stroke({ width: 0.6, color: ENCRE, alpha: 0.7 })
  g.roundRect(-W / 2 + 0.8, y0 - H / 2 + 1.2, W, H, 3); g.fill({ color: 0x000000, alpha: 0.35 })
  // Écusson.
  g.roundRect(-W / 2, y0 - H / 2, W, H, 3); g.fill({ color: col })
  g.roundRect(-W / 2, y0 - H / 2, W, H * 0.45, 3); g.fill({ color: 0xffffff, alpha: 0.13 })
  g.roundRect(-W / 2, y0 - H / 2, W, H, 3); g.stroke({ width: selection ? 1.6 : 0.9, color: selection ? OR : nuance(col, 0.45) })
  g.roundRect(-W / 2 + 1.3, y0 - H / 2 + 1.3, W - 2.6, H - 2.6, 2); g.stroke({ width: 0.45, color: OR, alpha: enRepos ? 0.35 : 0.85 })
  g.poly([-2.2, y0 + H / 2, 2.2, y0 + H / 2, 0, y0 + H / 2 + 2.6]); g.fill({ color: col }); g.stroke({ width: 0.6, color: nuance(col, 0.45) })
  iconeType(g, categorie(type), 0, y0 - 0.4)
  // Barre de moral.
  const m = Math.max(0, Math.min(1, moral / 100))
  g.rect(-W / 2, y0 + H / 2 + 3.4, W, 1.6); g.fill({ color: 0x1a120a, alpha: 0.8 })
  g.rect(-W / 2, y0 + H / 2 + 3.4, W * m, 1.6); g.fill({ color: m > 0.6 ? 0x7fc46b : m > 0.3 ? 0xe0b34a : 0xd0543c })
  // Pastille d'effectif.
  g.circle(W / 2, y0 - H / 2, 4.3); g.fill({ color: 0x1d150c }); g.stroke({ width: 0.8, color: OR })
}

export function texteEffectif(effectif) {
  const t = new Text({
    text: String(effectif),
    style: { fontFamily: 'Cinzel, Georgia, serif', fontSize: 6.2, fontWeight: '700', fill: 0xfdf6e3 },
    resolution: 6,
  })
  t.anchor.set(0.5); t.position.set(8, -37.6); t.eventMode = 'none'
  return t
}

// Une ARMÉE complète (figurines en formation + drapeau), dans un Container
// dont l'origine est le point d'ancrage au sol.
export function creerArmee({ couleur, effectif, types, moral, selection, enRepos, phase = 0, marche = false, sens = 1 }) {
  const c = new Container(); c.eventMode = 'none'
  const type = typeDominant(types)
  const nb = categorie(type) === 'navire' ? 1 : effectif >= 5 ? 3 : effectif >= 2 ? 2 : 1
  const places = nb === 1 ? [[0, 0]] : nb === 2 ? [[-3.6, 0.8], [3.4, -0.6]] : [[-5.6, 1.2], [0, -0.8], [5.4, 1]]
  if (selection) {
    const anneau = new Graphics(); anneau.ellipse(0, 0.6, 11, 3.2); anneau.stroke({ width: 1.2, color: OR, alpha: 0.95 })
    anneau.ellipse(0, 0.6, 11, 3.2); anneau.fill({ color: OR, alpha: 0.18 }); c.addChild(anneau)
  }
  places.forEach(([dx, dy], i) => {
    const g = new Graphics()
    dessinerFigurine(g, type, couleur, phase + i * 1.7, marche)
    g.position.set(dx, dy); g.scale.set(sens * 1.3, 1.3)
    c.addChild(g)
  })
  const d = new Graphics(); dessinerDrapeau(d, couleur, effectif, type, moral, selection, enRepos); c.addChild(d)
  c.addChild(texteEffectif(effectif))
  return c
}
