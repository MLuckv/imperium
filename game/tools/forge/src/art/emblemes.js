// Armoiries des six civilisations, en relief d'orfèvrerie.
import { P, plume, rachis, remplir, evider, tracer, cadrer } from '../core/formes.js'

const deg = (d) => (d * Math.PI) / 180

// ---------------------------------------------------------------- Rome : l'aigle
function aigle() {
  const c = cadrer(0.86, 0, 2)
  // Aile éployée : un bras qui monte de l'épaule au poignet, d'où pend un
  // rideau de rémiges parallèles, plus longues vers l'extérieur.
  const S = [57, 47], W = [81, 15]
  const N = 9
  const remiges = Array.from({ length: N }, (_, i) => {
    const u = i / (N - 1)
    return [S[0] + (W[0] - S[0]) * u, S[1] + (W[1] - S[1]) * u, 92 - u * 48, 12 + u * 17 + Math.sin(u * Math.PI) * 2]
  })
  const couvertures = Array.from({ length: N - 1 }, (_, i) => {
    const u = (i + 0.5) / (N - 1)
    return [S[0] + (W[0] - S[0]) * u - 0.5, S[1] + (W[1] - S[1]) * u - 1, 88 - u * 44, 7 + u * 5]
  })
  const queue = [[50, 69, 72, 15], [50, 69, 81, 16.5], [50, 69, 90, 17.5], [50, 69, 99, 16.5], [50, 69, 108, 15]]
  const couches = []
  const or = 'or'
  for (const [x, y, a, l] of remiges) couches.push({ forme: c((ctx) => remplir(ctx, [plume(x, y, deg(a), l, 4.3, 0.35)], { miroir: true })), hauteur: 3.4, biseau: 2.2, profil: 'rond', matiere: or, mode: 'pose' })
  for (const [x, y, a, l] of queue) couches.push({ forme: c((ctx) => remplir(ctx, [plume(x, y, deg(a), l, 3.6)])), hauteur: 3.4, biseau: 2.2, profil: 'rond', matiere: or, mode: 'pose' })
  for (const [x, y, a, l] of couvertures) couches.push({ forme: c((ctx) => remplir(ctx, [plume(x, y, deg(a), l, 4.2, 0.6)], { miroir: true })), hauteur: 4.6, biseau: 2.2, profil: 'rond', matiere: or, mode: 'pose' })
  // bras de l'aile (petites couvertures)
  couches.push({ forme: c((ctx) => remplir(ctx, ['M53.5 50 C58 41 66 30 76.5 18.5 C80 15 85.5 13.5 86 17.5 C86.3 21 83 24.5 79.5 28 C73 34.5 66 42 60.5 49 C59 51 57.5 53 56.5 55 Z'], { miroir: true })), hauteur: 5.6, biseau: 3, profil: 'rond', matiere: or, mode: 'pose' })
  // pattes et serres sur la barre
  couches.push({ forme: c((ctx) => { remplir(ctx, ['M42.5 63 C40.5 69 41 75 43.5 80.5 L48 80.5 C47.2 75 47.2 70 47.5 65 Z'], { miroir: true }); tracer(ctx, ['M43.5 80 C40.5 81.5 40 84.5 41.8 86.2', 'M46.5 80.5 C46.3 83.5 47 85.6 48.6 86.4'], 2.1, true) }), hauteur: 4.5, biseau: 2, profil: 'rond', matiere: or, mode: 'pose' })
  couches.push({ forme: c((ctx) => remplir(ctx, ['M31 84.5 C31 83.3 32 82.8 33 82.8 L67 82.8 C68 82.8 69 83.3 69 84.5 L69 87.5 C69 88.7 68 89.2 67 89.2 L33 89.2 C32 89.2 31 88.7 31 87.5 Z', 'M29 86 m-3.8 0 a3.8 3.8 0 1 0 7.6 0 a3.8 3.8 0 1 0 -7.6 0', 'M71 86 m-3.8 0 a3.8 3.8 0 1 0 7.6 0 a3.8 3.8 0 1 0 -7.6 0'])), hauteur: 4.5, biseau: 2.6, profil: 'rond', matiere: or, mode: 'pose' })
  // corps
  couches.push({ forme: c((ctx) => remplir(ctx, ['M50 33 C58 33 62.5 43 61.5 55 C60.5 65 55.5 71 50 73 C44.5 71 39.5 65 38.5 55 C37.5 43 42 33 50 33 Z'])), hauteur: 7.5, biseau: 7, profil: 'rond', matiere: or, mode: 'pose' })
  // tête de profil, tournée à dextre
  couches.push({ forme: c((ctx) => remplir(ctx, ['M55.5 37 C56.5 30 56.5 24 54.5 20 C52.5 16 47.5 14.8 44.3 16.6 C41.3 18.2 38.3 19.4 35.6 21.8 C33.9 23.4 33.8 26 35.4 27.8 C36.2 26.3 37.3 25.6 38.7 25.9 C40.5 26.4 42.4 27.6 44.2 28.8 C45.3 31.5 45.2 34.5 44.8 37 Z'])), hauteur: 8.5, biseau: 4.5, profil: 'rond', matiere: or, mode: 'pose' })
  // gravures : rachis, écailles du poitrail, œil, bec, plis des pattes
  couches.push({ forme: c((ctx) => {
    const r = []
    for (const [x, y, a, l] of remiges) r.push(rachis(x, y, deg(a), l, 0.45, 0.88))
    for (const [x, y, a, l] of queue) r.push(rachis(x, y, deg(a), l, 0.25, 0.85))
    tracer(ctx, r, 0.7, true)
    const ecailles = []
    for (let rang = 0; rang < 5; rang++) {
      const y = 42 + rang * 5.5, n = rang < 1 ? 2 : 3
      for (let k = 0; k < n; k++) { const x = 50 + (k - (n - 1) / 2) * 6.2; ecailles.push(`M${x - 2.6} ${y} C${x - 2} ${y + 3} ${x + 2} ${y + 3} ${x + 2.6} ${y}`) }
    }
    tracer(ctx, ecailles, 0.8)
    tracer(ctx, ['M38.7 25.9 C41 24.2 43.6 23.6 46.2 24.6', 'M55 30 C52 30.5 49 30 46.5 28.6'], 0.75)
    tracer(ctx, ['M57.5 48 C62 42 67 36 74 28', 'M60 51 C64.5 45.5 69.5 39.5 76.5 31.5'], 0.6, true)
    ctx.beginPath(); ctx.arc(47, 21, 1.35, 0, Math.PI * 2); ctx.fill()
  }), hauteur: 1.1, biseau: 0.7, profil: 'rond', mode: 'creuse' })
  return couches
}

// ---------------------------------------------------------------- Égypte : l'ankh
function ankh() {
  const contour = ['M50 9 C62 9 68 20 67 30 C66 39 58 44 54.5 47 L45.5 47 C42 44 34 39 33 30 C32 20 38 9 50 9 Z',
    'M19.5 44.5 C26 45.8 38 46.4 46 46 L54 46 C62 46.4 74 45.8 80.5 44.5 C81.6 47.8 81.6 52.2 80.5 55.5 C74 54.2 62 53.6 54 54 L46 54 C38 53.6 26 54.2 19.5 55.5 C18.4 52.2 18.4 47.8 19.5 44.5 Z',
    'M45.3 53 L54.7 53 C55.2 66 57.2 80 60.5 92 C54 93.2 46 93.2 39.5 92 C42.8 80 44.8 66 45.3 53 Z']
  const trou = ['M50 17.5 C56.5 17.5 59.8 24 59.3 30 C58.8 35.8 54.2 39.8 50 42 C45.8 39.8 41.2 35.8 40.7 30 C40.2 24 43.5 17.5 50 17.5 Z']
  const forme = (ctx) => { remplir(ctx, contour); evider(ctx, trou) }
  return [
    { forme, hauteur: 7, biseau: 4, profil: 'rond', matiere: 'or' },
    // incrustation de lapis-lazuli, en retrait dans la monture d'or
    { forme: (ctx) => { remplir(ctx, contour, { retrait: 2.6 }); ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 5.2; for (const d of trou) ctx.stroke(P(d)); for (const d of trou) ctx.fill(P(d)); ctx.restore() },
      hauteur: 5.2, biseau: 1.6, profil: 'coussin', matiere: { email: '#1d4f9e' }, mode: 'pose', grain: { echelle: 30, force: 0.35, graine: 11 } },
    // filets d'or séparant les parties (cloisonné)
    { forme: (ctx) => tracer(ctx, ['M38 46.5 L38 53.5', 'M62 46.5 L62 53.5', 'M45 50 L55 50'], 1.1), hauteur: 7, biseau: 0.6, profil: 'rond', matiere: 'or', mode: 'pose' },
  ]
}

// ---------------------------------------------------------------- Bretons : l'épée dans le rocher
function epeeRocher() {
  return [
    { forme: (ctx) => remplir(ctx, ['M45.6 34 L54.4 34 L54 70 L46 70 Z']), hauteur: 3.6, biseau: 3.2, profil: 'biseau', matiere: 'acier' },
    { forme: (ctx) => tracer(ctx, ['M50 36.5 L50 66'], 1.6), hauteur: 1.2, biseau: 0.8, profil: 'rond', mode: 'creuse' },
    { forme: (ctx) => remplir(ctx, ['M46.6 15 L53.4 15 L53.8 31 L46.2 31 Z']), hauteur: 4.5, biseau: 3, profil: 'rond', matiere: { mat: '#5b3418', brillance: 0.08 } },
    { forme: (ctx) => tracer(ctx, [16.5, 19.5, 22.5, 25.5, 28.5].map((y) => `M46.4 ${y + 1.6} L53.6 ${y - 0.4}`), 0.8), hauteur: 1, biseau: 0.6, profil: 'rond', mode: 'creuse' },
    { forme: (ctx) => remplir(ctx, ['M27 29.6 C33 31.2 40 31.8 46 31.4 L54 31.4 C60 31.8 67 31.2 73 29.6 C74.8 29.2 76.2 30.8 75.7 32.6 C75.2 34.4 73.6 35.2 71.8 35 C65 34.3 59 35 54 35.6 L46 35.6 C41 35 35 34.3 28.2 35 C26.4 35.2 24.8 34.4 24.3 32.6 C23.8 30.8 25.2 29.2 27 29.6 Z']), hauteur: 5, biseau: 2.2, profil: 'rond', matiere: 'or', mode: 'pose' },
    { forme: (ctx) => { ctx.beginPath(); ctx.arc(50, 33.5, 3.6, 0, Math.PI * 2); ctx.fill() }, hauteur: 6, biseau: 2, profil: 'rond', matiere: 'or', mode: 'pose' },
    { forme: (ctx) => { ctx.beginPath(); ctx.arc(50, 33.5, 2.1, 0, Math.PI * 2); ctx.fill() }, hauteur: 6.6, biseau: 2, profil: 'dome', matiere: { email: '#b3141c' }, mode: 'pose' },
    { forme: (ctx) => { ctx.beginPath(); ctx.arc(50, 11, 4.8, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(48, 13, 4, 3) }, hauteur: 6, biseau: 3.6, profil: 'rond', matiere: 'or', mode: 'pose' },
    { forme: (ctx) => { ctx.beginPath(); ctx.arc(50, 11, 2.2, 0, Math.PI * 2); ctx.fill() }, hauteur: 6.8, biseau: 2, profil: 'dome', matiere: { email: '#1f5fb8' }, mode: 'pose' },
    // le rocher, devant la lame
    { forme: (ctx) => remplir(ctx, ['M12 93 C10 85 14 77 20.5 73 C24.5 66.5 32.5 62 41.5 63 C45.5 60 54 59.6 58.5 61.8 C66.5 60.6 75 63.6 80 69.6 C86.4 73.8 89.6 82.4 88 93 Z']),
      hauteur: 11, biseau: 12, profil: 'coussin', matiere: { pierre: '#8e8778' }, mode: 'pose', grain: { echelle: 9, force: 2.2, graine: 5 } },
    { forme: (ctx) => remplir(ctx, ['M46 61.5 L54 61.5 L54 64.4 L46 64.4 Z']), hauteur: 3, biseau: 1, profil: 'rond', mode: 'creuse' },
    { forme: (ctx) => tracer(ctx, ['M30 70 C33 75 32 80 35 85', 'M66 68 C64 74 67 79 65 86', 'M52 76 C55 80 53 85 56 90', 'M20 82 C24 83 26 86 25 90'], 0.9), hauteur: 1.6, biseau: 0.9, profil: 'rond', mode: 'creuse' },
    // mousse au pied de la pierre
    { forme: (ctx) => remplir(ctx, ['M14 92 C18 88 24 89 28 91 C33 88 40 89 44 92 Z', 'M60 92 C64 88.5 71 88.5 75 91 C79 88.6 84 89.4 87 92 Z']), hauteur: 12.5, biseau: 2, profil: 'coussin', matiere: { mat: '#4d6a2c' }, mode: 'pose', grain: { echelle: 40, force: 0.8, graine: 9 } },
  ]
}

// ---------------------------------------------------------------- Macédoine : le soleil de Vergina
function vergina() {
  const rayons = []
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2
    const R = i % 2 ? 37 : 46, b = 4.2
    const c = Math.cos(a), s = Math.sin(a), px = -s, py = c
    const x0 = 50 + c * 11, y0 = 50 + s * 11
    rayons.push(`M${x0 + px * b} ${y0 + py * b} Q${50 + c * (R * 0.6) + px * b * 0.55} ${50 + s * (R * 0.6) + py * b * 0.55} ${50 + c * R} ${50 + s * R} Q${50 + c * (R * 0.6) - px * b * 0.55} ${50 + s * (R * 0.6) - py * b * 0.55} ${x0 - px * b} ${y0 - py * b} Z`)
  }
  const petales = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    petales.push(plume(50, 50, a, 9.5, 2.6, 0.6))
  }
  return [
    { forme: (ctx) => remplir(ctx, rayons), hauteur: 4.2, biseau: 2.6, profil: 'biseau', matiere: 'or' },
    { forme: (ctx) => tracer(ctx, rayons.map((_, i) => { const a = (i / 16) * Math.PI * 2 - Math.PI / 2, R = i % 2 ? 37 : 46; return `M${50 + Math.cos(a) * 14} ${50 + Math.sin(a) * 14} L${50 + Math.cos(a) * (R - 3)} ${50 + Math.sin(a) * (R - 3)}` }), 0.7), hauteur: 4.2, biseau: 0.5, profil: 'rond', matiere: 'orpale', mode: 'ajoute' },
    { forme: (ctx) => { ctx.beginPath(); ctx.arc(50, 50, 13.5, 0, Math.PI * 2); ctx.fill() }, hauteur: 7, biseau: 13, profil: 'rond', matiere: 'or', mode: 'pose' },
    { forme: (ctx) => remplir(ctx, petales), hauteur: 1.6, biseau: 1.2, profil: 'rond', matiere: 'orpale', mode: 'ajoute' },
    { forme: (ctx) => { ctx.beginPath(); ctx.arc(50, 50, 2.6, 0, Math.PI * 2); ctx.fill() }, hauteur: 2.4, biseau: 2.6, profil: 'rond', matiere: 'or', mode: 'ajoute' },
  ]
}

// ---------------------------------------------------------------- Sparte : bouclier au lambda
function aspis() {
  const lambda = 'M50 26 C51.5 26 52.5 27 53.2 28.6 L68 70 C68.6 71.8 67.6 73.2 65.8 73.2 L60.6 73.2 C59.2 73.2 58.2 72.4 57.8 71 L50 46 L42.2 71 C41.8 72.4 40.8 73.2 39.4 73.2 L34.2 73.2 C32.4 73.2 31.4 71.8 32 70 L46.8 28.6 C47.5 27 48.5 26 50 26 Z'
  return [
    { forme: (ctx) => { ctx.beginPath(); ctx.arc(50, 50, 45, 0, Math.PI * 2); ctx.fill() }, hauteur: 6, biseau: 4, profil: 'rond', matiere: 'or' },
    { forme: (ctx) => { ctx.beginPath(); ctx.arc(50, 50, 38.5, 0, Math.PI * 2); ctx.fill() }, hauteur: 6, biseau: 40, profil: 'dome', matiere: 'bronze', mode: 'pose', grain: { echelle: 26, force: 0.9, graine: 21 } },
    { forme: (ctx) => remplir(ctx, [lambda]), hauteur: 3.2, biseau: 1.8, profil: 'rond', matiere: { email: '#a3201a' }, mode: 'ajoute' },
    { forme: (ctx) => { for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; ctx.beginPath(); ctx.arc(50 + Math.cos(a) * 41.8, 50 + Math.sin(a) * 41.8, 1.2, 0, Math.PI * 2); ctx.fill() } }, hauteur: 1.6, biseau: 1.2, profil: 'rond', matiere: 'orpale', mode: 'ajoute' },
  ]
}

// ---------------------------------------------------------------- Francs : la fleur de lys
function lys() {
  const centre = 'M50 7 C56.5 15 61 26 60 38 C59.4 46 55.6 52 52.4 56.5 L47.6 56.5 C44.4 52 40.6 46 40 38 C39 26 43.5 15 50 7 Z'
  const cote = 'M53 58 C56 47.5 64.5 37.5 74.5 35.8 C83.6 34.4 89.6 41.2 87.6 49.2 C86.1 55.2 80.4 58.4 76.2 55.4 C79.8 53.2 80.8 48.2 77.8 46 C73.4 43.4 66.4 48 62.2 55 C60.2 58.2 58.4 61.4 57.2 63.6 Z'
  const bande = 'M35 58.4 C35 56.8 36 56 37.6 56 L62.4 56 C64 56 65 56.8 65 58.4 L65 62.4 C65 64 64 64.8 62.4 64.8 L37.6 64.8 C36 64.8 35 64 35 62.4 Z'
  const piedC = 'M46.2 64.8 L53.8 64.8 C53.8 71 52.8 77 50 81.5 C47.2 77 46.2 71 46.2 64.8 Z'
  const piedL = 'M54 64.8 C58 66.6 62.4 70 66.4 72.2 C70.4 74.4 72.4 78.4 70.2 81.6 C67.2 78.6 62.8 76.6 58.2 74.6 C56 71.6 54.6 68.4 54 64.8 Z'
  return [
    { forme: (ctx) => remplir(ctx, [cote, piedL], { miroir: true }), hauteur: 5.5, biseau: 3.4, profil: 'rond', matiere: 'or' },
    { forme: (ctx) => remplir(ctx, [piedC]), hauteur: 5.5, biseau: 3, profil: 'rond', matiere: 'or', mode: 'pose' },
    { forme: (ctx) => remplir(ctx, [centre]), hauteur: 7, biseau: 5.5, profil: 'rond', matiere: 'or', mode: 'pose' },
    { forme: (ctx) => remplir(ctx, [bande]), hauteur: 7.5, biseau: 2.2, profil: 'rond', matiere: 'or', mode: 'pose' },
    { forme: (ctx) => { tracer(ctx, ['M50 13 C52.5 22 53 34 50.5 50'], 0.8); tracer(ctx, ['M57 59 L57 62', 'M43 59 L43 62'], 0.8); tracer(ctx, ['M56.5 58 C60 49 66.5 42 74.5 40'], 0.7, true) }, hauteur: 1.1, biseau: 0.6, profil: 'rond', mode: 'creuse' },
  ]
}

export const EMBLEMES = { rome: aigle, carthage: ankh, bretons: epeeRocher, macedoine: vergina, sparte: aspis, francs: lys }
