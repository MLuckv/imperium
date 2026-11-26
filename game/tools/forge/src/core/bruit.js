// Bruit de valeur et fBm, déterministes (graine), pour les grains de matière.

export function hash2(x, y, graine = 0) {
  let h = (x * 374761393 + y * 668265263 + graine * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

const lisse = (t) => t * t * (3 - 2 * t)

export function bruit(x, y, graine = 0) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const a = hash2(xi, yi, graine), b = hash2(xi + 1, yi, graine)
  const c = hash2(xi, yi + 1, graine), d = hash2(xi + 1, yi + 1, graine)
  const u = lisse(xf), v = lisse(yf)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

export function fbm(x, y, octaves = 4, graine = 0) {
  let s = 0, amp = 0.5, f = 1, norme = 0
  for (let i = 0; i < octaves; i++) {
    s += amp * bruit(x * f, y * f, graine + i * 17)
    norme += amp; amp *= 0.5; f *= 2.03
  }
  return s / norme
}

// Générateur pseudo-aléatoire (mulberry32).
export function alea(graine) {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
