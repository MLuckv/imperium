// Outils de dessin des silhouettes (repère 100×100) : plumes, feuilles,
// symétrie, retrait (pour les incrustations), traits gravés.
import { Path2D } from '@napi-rs/canvas'

export const P = (d) => new Path2D(d)

// Une plume / feuille effilée : base (x,y), angle (radians), longueur, largeur.
export function plume(x, y, a, long, larg, pointe = 0.25) {
  const c = Math.cos(a), s = Math.sin(a)
  const px = -s, py = c
  const at = (t, w) => [x + c * long * t + px * w, y + s * long * t + py * w]
  const [b1x, b1y] = at(0, larg * 0.45), [b2x, b2y] = at(0, -larg * 0.45)
  const [c1x, c1y] = at(0.35, larg * 1.05), [c2x, c2y] = at(0.8, larg * 0.75)
  const [c3x, c3y] = at(0.8, -larg * 0.75), [c4x, c4y] = at(0.35, -larg * 1.05)
  const [tx, ty] = at(1, 0)
  const [p1x, p1y] = at(1 - pointe * 0.4, larg * 0.25), [p2x, p2y] = at(1 - pointe * 0.4, -larg * 0.25)
  return `M${b1x} ${b1y} C${c1x} ${c1y} ${c2x} ${c2y} ${p1x} ${p1y} Q${tx} ${ty} ${tx} ${ty} Q${tx} ${ty} ${p2x} ${p2y} C${c3x} ${c3y} ${c4x} ${c4y} ${b2x} ${b2y} Z`
}

// Ligne centrale d'une plume (pour la gravure).
export function rachis(x, y, a, long, de = 0.08, a_ = 0.82) {
  const c = Math.cos(a), s = Math.sin(a)
  return `M${x + c * long * de} ${y + s * long * de} L${x + c * long * a_} ${y + s * long * a_}`
}

// Remplit une liste de chemins ; `miroir` duplique en symétrie verticale (x → 100 - x).
export function remplir(ctx, chemins, { miroir = false, retrait = 0 } = {}) {
  const tous = []
  for (const d of chemins) {
    tous.push(typeof d === 'string' ? P(d) : d)
  }
  const dessiner = () => { for (const p of tous) ctx.fill(p) }
  dessiner()
  if (miroir) { ctx.save(); ctx.translate(100, 0); ctx.scale(-1, 1); dessiner(); ctx.restore() }
  if (retrait > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = retrait * 2
    const contour = () => { for (const p of tous) ctx.stroke(p) }
    contour()
    if (miroir) { ctx.translate(100, 0); ctx.scale(-1, 1); contour() }
    ctx.restore()
  }
}

export function evider(ctx, chemins, miroir = false) {
  ctx.save(); ctx.globalCompositeOperation = 'destination-out'
  for (const d of chemins) ctx.fill(typeof d === 'string' ? P(d) : d)
  if (miroir) { ctx.translate(100, 0); ctx.scale(-1, 1); for (const d of chemins) ctx.fill(typeof d === 'string' ? P(d) : d) }
  ctx.restore()
}

export function tracer(ctx, chemins, largeur, miroir = false) {
  ctx.save(); ctx.lineWidth = largeur
  for (const d of chemins) ctx.stroke(typeof d === 'string' ? P(d) : d)
  if (miroir) { ctx.translate(100, 0); ctx.scale(-1, 1); for (const d of chemins) ctx.stroke(typeof d === 'string' ? P(d) : d) }
  ctx.restore()
}

// Applique une transformation (échelle autour du centre, décalage) à un dessin.
export function cadrer(echelle = 1, dx = 0, dy = 0) {
  return (dessin) => (ctx) => {
    ctx.save(); ctx.translate(50 + dx, 50 + dy); ctx.scale(echelle, echelle); ctx.translate(-50, -50)
    dessin(ctx); ctx.restore()
  }
}

// Bande intérieure le long du contour d'une forme, entre les retraits a et b
// (filets d'orfèvrerie, bordures de bouclier…).
export function bordure(ctx, d, a, b) {
  const p = typeof d === 'string' ? P(d) : d
  ctx.save(); ctx.clip(p)
  ctx.lineWidth = b * 2; ctx.stroke(p)
  ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = a * 2; ctx.stroke(p)
  ctx.restore()
}
