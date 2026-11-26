// Moteur de RELIEF de la Forge : chaque asset est un empilement de couches
// (silhouettes vectorielles) transformées en carte de hauteur (distance au bord
// → biseau arrondi), puis éclairées comme de vraies matières : or et bronze
// (reflets d'environnement), émail, pierre, ivoire. Occlusion ambiante dans les
// creux, ombre portée, liseré sombre, suréchantillonnage ×2.
import { createCanvas } from '@napi-rs/canvas'
import { fbm } from './bruit.js'

const INF = 1e20

// ---------- outils raster
export function masque(S, dessin) {
  const c = createCanvas(S, S)
  const ctx = c.getContext('2d')
  ctx.scale(S / 100, S / 100)
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  dessin(ctx)
  const d = ctx.getImageData(0, 0, S, S).data
  const m = new Float32Array(S * S)
  for (let i = 0; i < S * S; i++) m[i] = d[i * 4 + 3] / 255
  return m
}

function edt1d(f, n, d, v, z) {
  let k = 0
  v[0] = 0; z[0] = -INF; z[1] = INF
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]) }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]
  }
}

// Distance (px) de chaque pixel intérieur au bord de la silhouette.
export function distanceInterieure(m, S) {
  const g = new Float64Array(S * S)
  for (let i = 0; i < S * S; i++) g[i] = m[i] >= 0.5 ? INF : 0
  const f = new Float64Array(S), d = new Float64Array(S), v = new Int32Array(S), z = new Float64Array(S + 1)
  for (let x = 0; x < S; x++) {
    for (let y = 0; y < S; y++) f[y] = g[y * S + x]
    edt1d(f, S, d, v, z)
    for (let y = 0; y < S; y++) g[y * S + x] = d[y]
  }
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) f[x] = g[y * S + x]
    edt1d(f, S, d, v, z)
    for (let x = 0; x < S; x++) g[y * S + x] = d[x]
  }
  const out = new Float32Array(S * S)
  for (let i = 0; i < S * S; i++) out[i] = m[i] <= 0 ? 0 : Math.max(0, Math.sqrt(g[i]) - 0.5 + m[i])
  return out
}

export function flou(src, S, r, passes = 3) {
  if (r < 0.5) return Float32Array.from(src)
  let a = Float32Array.from(src), b = new Float32Array(S * S)
  const R = Math.max(1, Math.round(r)), w = 2 * R + 1
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < S; y++) {
      let acc = 0
      for (let x = -R; x <= R; x++) acc += a[y * S + Math.min(S - 1, Math.max(0, x))]
      for (let x = 0; x < S; x++) {
        b[y * S + x] = acc / w
        acc += a[y * S + Math.min(S - 1, x + R + 1)] - a[y * S + Math.max(0, x - R)]
      }
    }
    for (let x = 0; x < S; x++) {
      let acc = 0
      for (let y = -R; y <= R; y++) acc += b[Math.min(S - 1, Math.max(0, y)) * S + x]
      for (let y = 0; y < S; y++) {
        a[y * S + x] = acc / w
        acc += b[Math.min(S - 1, y + R + 1) * S + x] - b[Math.max(0, y - R) * S + x]
      }
    }
  }
  return a
}

// ---------- profils de biseau (t ∈ [0,1] → hauteur ∈ [0,1])
const PROFILS = {
  rond: (t) => Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))),
  biseau: (t) => t,
  doux: (t) => t * t * (3 - 2 * t),
  coussin: (t) => 1 - Math.pow(1 - t, 3),
  plat: () => 1,
}

// ---------- matières
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] }
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

export const METAUX = {
  or: { albedo: [1.0, 0.76, 0.34], bas: [0.16, 0.08, 0.02], haut: [1.0, 0.93, 0.72], spec: [1, 0.95, 0.8] },
  orpale: { albedo: [1.0, 0.86, 0.55], bas: [0.2, 0.12, 0.05], haut: [1.0, 0.97, 0.86], spec: [1, 0.98, 0.9] },
  bronze: { albedo: [0.78, 0.5, 0.27], bas: [0.07, 0.035, 0.015], haut: [0.85, 0.68, 0.5], spec: [0.9, 0.72, 0.55] },
  argent: { albedo: [0.9, 0.9, 0.92], bas: [0.1, 0.1, 0.12], haut: [1, 1, 1], spec: [1, 1, 1] },
  acier: { albedo: [0.72, 0.76, 0.82], bas: [0.06, 0.07, 0.09], haut: [0.95, 0.97, 1], spec: [1, 1, 1] },
  fer: { albedo: [0.55, 0.55, 0.56], bas: [0.05, 0.05, 0.05], haut: [0.8, 0.8, 0.82], spec: [0.9, 0.9, 0.9] },
}

const L = (() => { const v = [-0.5, -0.66, 0.56]; const n = Math.hypot(...v); return v.map((x) => x / n) })()
const HH = (() => { const v = [L[0], L[1], L[2] + 1]; const n = Math.hypot(...v); return v.map((x) => x / n) })()

function ombrer(mat, N, ao, x, y, S) {
  const ndl = Math.max(0, N[0] * L[0] + N[1] * L[1] + N[2] * L[2])
  const ndh = Math.max(0, N[0] * HH[0] + N[1] * HH[1] + N[2] * HH[2])
  if (typeof mat === 'string' && METAUX[mat]) {
    const m = METAUX[mat]
    const R = [2 * N[2] * N[0], 2 * N[2] * N[1], 2 * N[2] * N[2] - 1]
    const up = -R[1] * 0.75 + R[2] * 0.35 - R[0] * 0.25
    let env = mix(m.bas, m.haut, sstep(-0.35, 0.75, up))
    const rl = Math.max(0, R[0] * L[0] + R[1] * L[1] + R[2] * L[2])
    const bande = Math.exp(-Math.pow((R[2] - 0.15) / 0.22, 2)) * 0.18
    const k = Math.pow(rl, 24) * 1.6 + Math.pow(rl, 4) * 0.35 + bande
    const c = [m.albedo[0] * env[0] + m.spec[0] * k, m.albedo[1] * env[1] + m.spec[1] * k, m.albedo[2] * env[2] + m.spec[2] * k]
    return c.map((v) => v * (0.35 + 0.65 * ao))
  }
  if (mat && mat.email) {
    const c = hex(mat.email)
    const d = 0.28 + 0.9 * ndl
    const sp = Math.pow(ndh, 70) * 0.55 + Math.pow(ndh, 12) * 0.06
    // léger velouté : la couleur se réchauffe dans les creux
    return [c[0] * d * ao + sp, c[1] * d * ao + sp, c[2] * d * ao + sp]
  }
  if (mat && mat.pierre) {
    const c = hex(mat.pierre)
    const g = fbm(x / S * 22, y / S * 22, 4, 7)
    const v = 0.78 + g * 0.42
    const d = (0.32 + 0.8 * ndl) * v * ao
    return [c[0] * d, c[1] * d, c[2] * d]
  }
  if (mat && mat.mat) { // matière mate colorée (tissu, bois, cuir)
    const c = hex(mat.mat)
    const d = (0.3 + 0.82 * ndl) * ao
    const sp = Math.pow(ndh, 20) * (mat.brillance || 0.05)
    return [c[0] * d + sp, c[1] * d + sp, c[2] * d + sp]
  }
  // ivoire
  const c = hex((mat && mat.ivoire) || '#efe2c6')
  const d = (0.36 + 0.75 * ndl) * ao
  const sp = Math.pow(ndh, 30) * 0.18
  return [c[0] * d + sp, c[1] * d + sp, c[2] * d + sp]
}

/**
 * Peint un relief.
 * couches : [{ forme(ctx), hauteur, biseau, profil, matiere, mode: 'ajoute'|'creuse'|'pose', grain:{echelle,force,graine} }]
 * Coordonnées des formes : repère 100×100.
 */
export function relief({ taille = 256, sur = 2, couches, ombre = true, lisere = true, ao = 1, fond = null }) {
  const S = taille * sur
  const u = S / 100
  const H = new Float32Array(S * S)
  const alpha = new Float32Array(S * S)
  const matIdx = new Int16Array(S * S).fill(-1)
  const mats = []
  for (const c of couches) {
    const m = masque(S, c.forme)
    const d = distanceInterieure(m, S)
    const prof = PROFILS[c.profil || 'rond']
    const b = Math.max(0.01, (c.biseau ?? 3) * u)
    const h = (c.hauteur ?? 3) * u
    const mode = c.mode || 'ajoute'
    const mi = mats.push(c.matiere) - 1
    let dmax = 0
    if (c.profil === 'dome') for (let i = 0; i < S * S; i++) dmax = Math.max(dmax, d[i])
    for (let i = 0; i < S * S; i++) {
      if (m[i] <= 0) continue
      const t = c.profil === 'dome' ? d[i] / dmax : Math.min(1, d[i] / b)
      let hv = (c.profil === 'dome' ? Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))) : prof(t)) * h
      if (c.grain) {
        const x = i % S, y = (i / S) | 0
        hv += (fbm(x / S * c.grain.echelle, y / S * c.grain.echelle, 4, c.grain.graine || 3) - 0.5) * c.grain.force * u * Math.min(1, t * 3)
      }
      const cov = Math.min(1, m[i])
      if (mode === 'creuse') { H[i] -= hv * cov; continue }
      if (mode === 'pose') H[i] = H[i] * (1 - cov) + hv * cov
      else H[i] += hv * cov
      if (cov >= 0.5 || matIdx[i] < 0) matIdx[i] = mi
      alpha[i] = Math.max(alpha[i], cov)
    }
  }
  // Occlusion ambiante : creux plus sombres que leur voisinage.
  const f1 = flou(H, S, 3 * u / 2), f2 = flou(H, S, 8 * u / 2)
  const col = new Float32Array(S * S * 3)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x
      if (alpha[i] <= 0) continue
      const hx = H[y * S + Math.min(S - 1, x + 1)] - H[y * S + Math.max(0, x - 1)]
      const hy = H[Math.min(S - 1, y + 1) * S + x] - H[Math.max(0, y - 1) * S + x]
      const n = [-hx / 2, -hy / 2, 1]
      const nn = Math.hypot(n[0], n[1], n[2])
      const N = [n[0] / nn, n[1] / nn, n[2] / nn]
      const occ = Math.min(1, Math.max(0.25, 1 - ((f1[i] - H[i]) * 0.09 + (f2[i] - H[i]) * 0.035) / u * ao))
      const c = ombrer(mats[matIdx[i]] ?? 'or', N, occ, x, y, S)
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]
    }
  }
  // Composition : fond, ombre portée, liseré, couleur.
  const out = new Float32Array(S * S * 4)
  if (fond) { const f = hex(fond); for (let i = 0; i < S * S; i++) { out[i * 4] = f[0]; out[i * 4 + 1] = f[1]; out[i * 4 + 2] = f[2]; out[i * 4 + 3] = 1 } }
  const over = (i, r, g, b, a) => {
    const da = out[i * 4 + 3], oa = a + da * (1 - a)
    if (oa <= 0) return
    out[i * 4] = (r * a + out[i * 4] * da * (1 - a)) / oa
    out[i * 4 + 1] = (g * a + out[i * 4 + 1] * da * (1 - a)) / oa
    out[i * 4 + 2] = (b * a + out[i * 4 + 2] * da * (1 - a)) / oa
    out[i * 4 + 3] = oa
  }
  if (ombre) {
    const sh = flou(alpha, S, 1.6 * u)
    const dx = Math.round(1.0 * u), dy = Math.round(1.8 * u)
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const sx = x - dx, sy = y - dy
      if (sx < 0 || sy < 0) continue
      const a = sh[sy * S + sx] * 0.6
      if (a > 0.003) over(y * S + x, 0.05, 0.03, 0.01, a)
    }
  }
  if (lisere) {
    const li = flou(alpha, S, 0.55 * u, 2)
    for (let i = 0; i < S * S; i++) { const a = Math.min(1, li[i] * 2.6); if (a > 0.003) over(i, 0.14, 0.08, 0.03, a) }
  }
  for (let i = 0; i < S * S; i++) {
    if (alpha[i] <= 0) continue
    const tm = (v) => 1 - Math.exp(-v * 1.35) // tonemapping doux
    over(i, tm(col[i * 3]) / 0.74, tm(col[i * 3 + 1]) / 0.74, tm(col[i * 3 + 2]) / 0.74, alpha[i])
  }
  return reduire(out, S, sur)
}

// Réduit ×sur (moyenne pondérée par l'alpha) et renvoie un canvas.
export function reduire(out, S, sur) {
  const T = S / sur
  const c = createCanvas(T, T)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(T, T)
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let r = 0, g = 0, b = 0, a = 0
    for (let j = 0; j < sur; j++) for (let i = 0; i < sur; i++) {
      const k = ((y * sur + j) * S + x * sur + i) * 4
      const al = out[k + 3]
      r += out[k] * al; g += out[k + 1] * al; b += out[k + 2] * al; a += al
    }
    const o = (y * T + x) * 4
    const n = sur * sur
    img.data[o] = a > 0 ? Math.min(255, Math.round(r / a * 255)) : 0
    img.data[o + 1] = a > 0 ? Math.min(255, Math.round(g / a * 255)) : 0
    img.data[o + 2] = a > 0 ? Math.min(255, Math.round(b / a * 255)) : 0
    img.data[o + 3] = Math.round(a / n * 255)
  }
  ctx.putImageData(img, 0, 0)
  return c
}
