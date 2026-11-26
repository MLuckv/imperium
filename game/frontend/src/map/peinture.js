// PEINTRE DE LA CARTE — rendu « carte ancienne » entièrement procédural.
//
// Deux toiles (Canvas 2D) montées en sprites dans la scène Pixi :
//  • le FOND, peint une fois : mer gravée (lignes de côte concentriques, hauts-fonds,
//    vaguelettes), parchemin texturé, reliefs, forêts, dunes, fleuves, noms des mers
//    et des régions à l'antique, frontières de provinces en pointillés, cadre ;
//  • les ROYAUMES, repeints quand une province change de mains : lavis aquarelle de
//    la couleur du souverain, liseré intérieur le long des seules frontières du
//    royaume (les limites internes restent discrètes), trait de frontière foncé.
// Tout est dessiné en unités « monde » (celles de territories.json) puis
// échantillonné à ECHELLE pixels par unité.

export const ECHELLE_FOND = 2.5
export const ECHELLE_ROYAUMES = 2

// ------------------------------------------------------------------ aléa déterministe
export function aleatoire(graine) {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hacher(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

// ------------------------------------------------------------------ géométrie
function cheminPoly(poly) {
  const p = new Path2D()
  p.moveTo(poly[0][0], poly[0][1])
  for (let i = 1; i < poly.length; i++) p.lineTo(poly[i][0], poly[i][1])
  p.closePath()
  return p
}
function dansPoly(x, y, poly) {
  let dedans = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans
  }
  return dedans
}
function aire(poly) {
  let s = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1])
  return Math.abs(s / 2)
}
function boite(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of poly) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y }
  return { x0, y0, x1, y1 }
}

// ------------------------------------------------------------------ arêtes partagées
// Les polygones sont issus d'un même tracé : deux provinces voisines partagent
// EXACTEMENT leurs sommets communs. On classe chaque arête par son voisin (ou la
// mer, ou le bord du monde) et on la regroupe en « tronçons » continus.
export function indexerAretes(territoires, monde) {
  const W = (monde && monde.largeur) || 1400, H = (monde && monde.hauteur) || 1286
  const cle = (a, b) => {
    const ka = a[0].toFixed(1) + ',' + a[1].toFixed(1), kb = b[0].toFixed(1) + ',' + b[1].toFixed(1)
    return ka < kb ? ka + '|' + kb : kb + '|' + ka
  }
  const parCle = new Map()
  for (const t of territoires) {
    const p = t.polygone; if (!p || p.length < 3) continue
    for (let i = 0; i < p.length; i++) {
      const k = cle(p[i], p[(i + 1) % p.length])
      const l = parCle.get(k); if (l) l.push(t.id); else parCle.set(k, [t.id])
    }
  }
  const surBord = (a) => a[0] <= 0.6 || a[1] <= 0.6 || a[0] >= W - 0.6 || a[1] >= H - 0.6
  const troncons = {}
  for (const t of territoires) {
    const p = t.polygone; if (!p || p.length < 3) continue
    const n = p.length
    const etiquette = new Array(n)
    for (let i = 0; i < n; i++) {
      const a = p[i], b = p[(i + 1) % n]
      const l = parCle.get(cle(a, b)) || []
      const v = l.find((x) => x !== t.id)
      etiquette[i] = v || (surBord(a) && surBord(b) ? '#bord' : '#mer')
    }
    // Démarre sur un changement d'étiquette pour ne pas couper un tronçon en deux.
    let i0 = 0
    for (let i = 0; i < n; i++) if (etiquette[i] !== etiquette[(i - 1 + n) % n]) { i0 = i; break }
    const liste = []
    let cur = null
    for (let k = 0; k < n; k++) {
      const i = (i0 + k) % n
      if (!cur || cur.voisin !== etiquette[i]) {
        cur = { voisin: etiquette[i], pts: [p[i]] }
        liste.push(cur)
      }
      cur.pts.push(p[(i + 1) % n])
    }
    troncons[t.id] = liste
  }
  return troncons
}
function tracer(ctx, pts) {
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
}

// ------------------------------------------------------------------ textures de bruit
function toile(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c }
// Bruit de valeur TUILABLE (plusieurs octaves) → canvas en niveaux de gris.
function bruitTuile(taille, graine, octaves = 4, base = 8) {
  const r = aleatoire(graine)
  const c = toile(taille, taille), ctx = c.getContext('2d')
  const img = ctx.createImageData(taille, taille)
  const champ = new Float32Array(taille * taille)
  let amp = 1, total = 0
  for (let o = 0; o < octaves; o++) {
    const g = base << o
    const grille = new Float32Array(g * g).map(() => r())
    for (let y = 0; y < taille; y++) for (let x = 0; x < taille; x++) {
      const fx = (x / taille) * g, fy = (y / taille) * g
      const ix = Math.floor(fx), iy = Math.floor(fy)
      const tx = fx - ix, ty = fy - iy
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty)
      const v00 = grille[(iy % g) * g + (ix % g)], v10 = grille[(iy % g) * g + ((ix + 1) % g)]
      const v01 = grille[((iy + 1) % g) * g + (ix % g)], v11 = grille[((iy + 1) % g) * g + ((ix + 1) % g)]
      champ[y * taille + x] += amp * ((v00 * (1 - sx) + v10 * sx) * (1 - sy) + (v01 * (1 - sx) + v11 * sx) * sy)
    }
    total += amp; amp *= 0.5
  }
  for (let i = 0; i < champ.length; i++) {
    const v = Math.round((champ[i] / total) * 255)
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return c
}
function grain(taille, graine) {
  const r = aleatoire(graine)
  const c = toile(taille, taille), ctx = c.getContext('2d')
  const img = ctx.createImageData(taille, taille)
  for (let i = 0; i < taille * taille; i++) {
    const v = 200 + Math.round(r() * 55)
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return c
}
// Flou par réductions/agrandissements successifs (rapide, compatible partout).
function flouter(src, etapes) {
  let cur = src
  const pile = []
  for (let i = 0; i < etapes; i++) {
    const c = toile(cur.width / 2, cur.height / 2)
    const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'
    x.drawImage(cur, 0, 0, c.width, c.height)
    pile.push(cur); cur = c
  }
  for (let i = etapes - 1; i >= 0; i--) {
    const c = toile(pile[i].width, pile[i].height)
    const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'
    x.drawImage(cur, 0, 0, c.width, c.height)
    cur = c
  }
  return cur
}
function teinter(masque, couleur) {
  const c = toile(masque.width, masque.height), x = c.getContext('2d')
  x.drawImage(masque, 0, 0)
  x.globalCompositeOperation = 'source-in'; x.fillStyle = couleur; x.fillRect(0, 0, c.width, c.height)
  return c
}

// ------------------------------------------------------------------ décor du relief
// Le champ « terrain » des données est grossier (157 plaines sur 182) : on le
// complète par une géographie dessinée à la main — chaînes de montagnes, grandes
// forêts du nord, steppes, déserts.
const MONTAGNES = new Set(['graubunden', 'bozen', 'tirol', 'turin', 'kocevje', 'kocevje_2', 'zlatiborski', 'niksic', 'pec',
  'shkoder', 'branicevski', 'sofia', 'prilep', 'peloponnisos_2', 'sterea_ellada', 'lerida', 'lerida_2', 'asturias', 'burgos',
  'highland', 'highland_2', 'meknes_tafilalet', 'taza_al_hoceima_taounate', 'marrakech_tensift_al_haouz', 'souss_massa_draa',
  'suceava', 'bihor', 'banskobystricky', 'kayseri', 'sivas', 'beqaa', 'puy_de_dome', 'aveyron', 'tamanghasset', 'tibesti',
  'banja_luka', 'vest_agder', 'konya', 'sanliurfa', 'kriti', 'haute_corse'])
const FORETS = new Set(['niedersachsen', 'nordrhein_westfalen', 'sachsen_anhalt', 'brandenburg', 'mecklenburg_vorpommern',
  'west_pomeranian', 'pomeranian', 'baden_wurttemberg', 'bayern', 'stredocesky', 'jihomoravsky', 'gelderland', 'luxembourg',
  'diekirch', 'rheinland_pfalz', 'maine_et_loire', 'greater_poland', 'masovian', 'lublin', 'odz', 'warmian_masurian',
  'kaliningrad', 'siauliai', 'vilniaus', 'minsk', 'brest', 'mogilev', 'vitebsk', 'gomel', 'smolensk', 'pskov', 'tver',
  'moskovskaya', 'rezeknes', 'ventspils', 'parnu', 'parnu_2', 'gotland', 'vastra_gotaland', 'midtjylland', 'midtjylland_2',
  'devon', 'powys', 'fermanagh', 'galway', 'cork', 'lincolnshire', 'north_yorkshire', 'rivne', 'zhytomyr', 'chernihiv',
  'l_viv', 'niederosterreich', 'marne', 'cote_d_or', 'pas_de_calais', 'borsod_abauj_zemplen'])
const CONIFERES_Y = 140   // au nord de cette latitude, les forêts sont de résineux
const STEPPES = new Set(['odessa', 'zaporizhzhya', 'dnipropetrovs_k', 'kharkiv', 'crimea', 'krasnodar', 'comrat', 'tulcea',
  'kursk', 'bacs_kiskun', 'ankara', 'afyonkarahisar', 'aleppo', 'al_anbar', 'al_hudud_ash_shamaliyah', 'mafraq', 'homs_hims'])
const DESERTS_EXTRA = new Set(['adrar', 'tindouf', 'tiris_zemmour', 'timbuktu', 'adrar179', 'agadez', 'tibesti', 'ghardaia',
  'ouargla', 'el_oued', 'kebili', 'tataouine', 'bechar', 'al_jawf', 'ma_an', 'tabuk', 'al_madinah', 'makkah',
  'al_wadi_at_jadid', 'al_kufrah', 'murzuq', 'western_sahara', 'guelmim_es_semara', 'hadarom'])

const COULEUR_TERRAIN = {
  plaine: '#dcc9a0', foret: '#d3c79c', steppe: '#ddcd98', desert: '#e7cf98', fertile: '#c6c690', montagne: '#d2c29e',
}
function genre(t) {
  if (t.terrain === 'fertile') return 'fertile'
  if (t.terrain === 'desert' || DESERTS_EXTRA.has(t.id)) return 'desert'
  if (MONTAGNES.has(t.id) || t.terrain === 'montagne') return 'montagne'
  if (FORETS.has(t.id)) return 'foret'
  if (STEPPES.has(t.id)) return 'steppe'
  return 'plaine'
}

// Fleuves : tracés approximatifs par les vallées (lissés, rognés à la côte).
const FLEUVES = [
  [[1208, 1290], [1206, 1245], [1186, 1192], [1166, 1142], [1158, 1090], [1166, 1040], [1172, 1000], [1176, 975]],     // Nil
  [[548, 356], [600, 350], [640, 352], [700, 374], [738, 388], [782, 405], [805, 428], [842, 470], [890, 518], [935, 505], [981, 492], [1024, 482], [1050, 476], [1080, 472]], // Danube
  [[533, 420], [545, 385], [548, 352], [520, 322], [505, 300], [516, 270], [484, 246], [456, 230], [436, 214]],      // Rhin
  [[1236, 160], [1188, 180], [1150, 205], [1152, 248], [1162, 280], [1200, 300], [1226, 318], [1238, 375], [1238, 418], [1214, 452], [1190, 474]], // Dniepr
  [[374, 416], [340, 404], [300, 394], [262, 386], [228, 384], [196, 388]],                                         // Loire
  [[462, 470], [455, 505], [446, 540], [440, 575]],                                                                 // Rhône
  [[515, 511], [560, 520], [612, 524], [660, 522], [700, 516]],                                                     // Pô
  [[930, 284], [902, 258], [880, 236], [842, 206], [806, 178], [792, 150]],                                         // Vistule
  [[684, 316], [660, 290], [628, 250], [604, 205], [578, 172]],                                                     // Elbe
  [[227, 594], [262, 606], [292, 618], [340, 630], [380, 648], [410, 660]],                                         // Èbre
  [[1381, 709], [1384, 780], [1390, 850], [1396, 921], [1402, 990]],                                                // Euphrate
]
function lisser(pts, pas = 8) {
  const out = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let s = 0; s < pas; s++) {
      const t = s / pas, t2 = t * t, t3 = t2 * t
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

// Noms à l'antique : mers (placés au large, au point le plus éloigné des côtes de
// leur zone) et grandes régions (lettres espacées, à peine visibles sous les lavis).
const MERS = [
  { nom: 'MARE NOSTRVM', zone: [420, 700, 1160, 1000], taille: 30 },
  { nom: 'OCEANVS', zone: [0, 280, 190, 820], taille: 24 },
  { nom: 'MARE GERMANICVM', zone: [270, 20, 560, 260], taille: 17 },
  { nom: 'MARE SVEBICVM', zone: [680, 0, 1010, 160], taille: 16 },
  { nom: 'PONTVS EVXINVS', zone: [1080, 430, 1360, 620], taille: 19 },
  { nom: 'MARE AEGAEVM', zone: [930, 640, 1070, 820], taille: 12 },
  { nom: 'MARE HADRIATICVM', zone: [705, 470, 800, 610], taille: 10, angle: 0.62 },
]
const REGIONS = [
  ['BRITANNIA', 222, 182, 18], ['HIBERNIA', 86, 186, 13], ['GALLIA', 388, 440, 26], ['HISPANIA', 196, 660, 26],
  ['GERMANIA', 600, 262, 26], ['ITALIA', 640, 560, 16, 0.75], ['DACIA', 950, 440, 17], ['GRAECIA', 905, 680, 13],
  ['ASIA', 1190, 712, 22], ['SARMATIA', 1110, 210, 24], ['SCYTHIA', 1280, 372, 18], ['AEGYPTVS', 1150, 1120, 20],
  ['LIBYA', 870, 1120, 26], ['MAVRETANIA', 210, 1000, 20], ['ARABIA', 1330, 1100, 20], ['SCANDIA', 600, 50, 15],
]

// ------------------------------------------------------------------ glyphes du relief
const ENCRE = '#4a3925'
function glypheMontagne(ctx, x, y, s, r) {
  const g = s * (0.85 + r() * 0.3), dx = (r() - 0.5) * s * 0.25
  const sommet = [x + dx, y - s * 1.05]
  ctx.beginPath(); ctx.moveTo(x - g, y); ctx.lineTo(sommet[0], sommet[1]); ctx.lineTo(x + g, y); ctx.closePath()
  ctx.fillStyle = '#eadcbc'; ctx.fill()
  ctx.beginPath(); ctx.moveTo(sommet[0], sommet[1]); ctx.lineTo(x + g, y); ctx.lineTo(x + s * 0.12, y); ctx.closePath()
  ctx.fillStyle = '#ad9772'; ctx.fill()
  ctx.strokeStyle = ENCRE; ctx.lineWidth = 0.55; ctx.lineJoin = 'round'
  ctx.beginPath(); ctx.moveTo(x - g, y); ctx.lineTo(sommet[0], sommet[1]); ctx.lineTo(x + g, y); ctx.stroke()
  ctx.lineWidth = 0.32
  for (let k = 1; k <= 3; k++) {  // hachures de l'ubac
    const t = k / 4
    const ax = sommet[0] + (x + g - sommet[0]) * t, ay = sommet[1] + (y - sommet[1]) * t
    ctx.beginPath(); ctx.moveTo(ax - s * 0.05, ay + s * 0.06); ctx.lineTo(ax - s * 0.28, ay + s * 0.28); ctx.stroke()
  }
  if (s > 8.5) {  // neiges éternelles
    ctx.beginPath(); ctx.moveTo(sommet[0], sommet[1]); ctx.lineTo(sommet[0] - s * 0.22, sommet[1] + s * 0.26)
    ctx.lineTo(sommet[0] + s * 0.02, sommet[1] + s * 0.2); ctx.lineTo(sommet[0] + s * 0.2, sommet[1] + s * 0.24); ctx.closePath()
    ctx.fillStyle = '#fbf6ea'; ctx.fill()
  }
}
function glypheFeuillu(ctx, x, y, s, r) {
  const rr = s * (0.42 + r() * 0.12)
  ctx.strokeStyle = ENCRE; ctx.lineWidth = 0.4
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - s * 0.45); ctx.stroke()
  ctx.beginPath(); ctx.arc(x, y - s * 0.78, rr, 0, Math.PI * 2)
  ctx.fillStyle = r() < 0.5 ? '#8f9a5d' : '#7e8c52'; ctx.fill()
  ctx.beginPath(); ctx.arc(x + rr * 0.25, y - s * 0.72, rr * 0.7, -0.6, 1.9)
  ctx.fillStyle = 'rgba(70,80,40,0.35)'; ctx.fill()
  ctx.beginPath(); ctx.arc(x, y - s * 0.78, rr, 0, Math.PI * 2); ctx.stroke()
}
function glypheResineux(ctx, x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y - s * 1.2); ctx.lineTo(x + s * 0.38, y - s * 0.1); ctx.lineTo(x - s * 0.38, y - s * 0.1); ctx.closePath()
  ctx.fillStyle = '#6f7d4b'; ctx.fill()
  ctx.strokeStyle = ENCRE; ctx.lineWidth = 0.4; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x, y - s * 0.1); ctx.lineTo(x, y + s * 0.12); ctx.stroke()
}
function glypheDune(ctx, x, y, s) {
  ctx.strokeStyle = 'rgba(150,110,55,0.75)'; ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.moveTo(x - s, y); ctx.quadraticCurveTo(x - s * 0.2, y - s * 0.55, x + s * 0.6, y - s * 0.1); ctx.stroke()
  ctx.strokeStyle = 'rgba(150,110,55,0.4)'
  ctx.beginPath(); ctx.moveTo(x - s * 0.3, y + s * 0.25); ctx.quadraticCurveTo(x + s * 0.2, y - s * 0.05, x + s, y + s * 0.2); ctx.stroke()
}
function glypheHerbe(ctx, x, y, s) {
  ctx.strokeStyle = 'rgba(110,105,55,0.7)'; ctx.lineWidth = 0.4
  ctx.beginPath()
  for (const k of [-1, 0, 1]) { ctx.moveTo(x + k * s * 0.35, y); ctx.lineTo(x + k * s * 0.5, y - s * 0.6) }
  ctx.stroke()
}
function glypheVague(ctx, x, y, s, a) {
  ctx.strokeStyle = `rgba(214,230,226,${a})`; ctx.lineWidth = 0.55
  ctx.beginPath(); ctx.moveTo(x - s, y)
  ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.45, x, y); ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.45, x + s, y)
  ctx.stroke()
}

// Points répartis dans un polygone, à l'écart du centre (la cité) et entre eux.
function semer(poly, centre, densite, espace, graine, garde = 15) {
  const r = aleatoire(graine)
  const b = boite(poly)
  const nb = Math.min(140, Math.round(aire(poly) * densite))
  const pts = []
  const cases = new Map()
  const cle = (x, y) => Math.floor(x / espace) + ',' + Math.floor(y / espace)
  for (let essai = 0; essai < nb * 6 && pts.length < nb; essai++) {
    const x = b.x0 + r() * (b.x1 - b.x0), y = b.y0 + r() * (b.y1 - b.y0)
    if (centre && Math.hypot(x - centre[0], y - centre[1]) < garde) continue
    if (!dansPoly(x, y, poly)) continue
    const cx = Math.floor(x / espace), cy = Math.floor(y / espace)
    let libre = true
    for (let i = -1; i <= 1 && libre; i++) for (let j = -1; j <= 1 && libre; j++) {
      const l = cases.get((cx + i) + ',' + (cy + j))
      if (l) for (const q of l) if (Math.hypot(q[0] - x, q[1] - y) < espace) { libre = false; break }
    }
    if (!libre) continue
    const k = cle(x, y); const l = cases.get(k); if (l) l.push([x, y]); else cases.set(k, [[x, y]])
    pts.push([x, y, r])
  }
  return pts
}

// Texte espacé lettre à lettre (letterSpacing n'est pas partout disponible).
function texteEspace(ctx, txt, x, y, espacement, angle = 0) {
  const largeurs = [...txt].map((c) => ctx.measureText(c).width)
  const total = largeurs.reduce((s, w) => s + w, 0) + espacement * (txt.length - 1)
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle)
  let cx = -total / 2
  ;[...txt].forEach((c, i) => { ctx.fillText(c, cx, 0); cx += largeurs[i] + espacement })
  ctx.restore()
}

// Distance (en cellules) à la terre la plus proche, sur un masque basse résolution.
function distanceMer(masque) {
  const w = masque.width, h = masque.height
  const d = masque.getContext('2d').getImageData(0, 0, w, h).data
  const D = new Float32Array(w * h)
  const INF = 1e9
  for (let i = 0; i < w * h; i++) D[i] = d[i * 4 + 3] > 40 ? 0 : INF
  const a = 1, b = 1.414
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; let v = D[i]
    if (x > 0) v = Math.min(v, D[i - 1] + a)
    if (y > 0) { v = Math.min(v, D[i - w] + a); if (x > 0) v = Math.min(v, D[i - w - 1] + b); if (x < w - 1) v = Math.min(v, D[i - w + 1] + b) }
    D[i] = v
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; let v = D[i]
    if (x < w - 1) v = Math.min(v, D[i + 1] + a)
    if (y < h - 1) { v = Math.min(v, D[i + w] + a); if (x < w - 1) v = Math.min(v, D[i + w + 1] + b); if (x > 0) v = Math.min(v, D[i + w - 1] + b) }
    D[i] = v
  }
  return { D, w, h }
}

// ================================================================== LE FOND
export async function peindreFond(data, troncons) {
  try {
    await Promise.all([
      document.fonts.load('italic 600 40px "EB Garamond"'),
      document.fonts.load('600 40px "Cinzel"'),
    ])
  } catch { /* polices de repli */ }
  const f = ECHELLE_FOND
  const W = (data.monde && data.monde.largeur) || 1400, H = (data.monde && data.monde.hauteur) || 1286
  const terrs = (data.territoires || []).filter((t) => Array.isArray(t.polygone) && t.polygone.length >= 3)
  const c = toile(W * f, H * f), ctx = c.getContext('2d')
  ctx.setTransform(f, 0, 0, f, 0, 0)
  const terre = new Path2D()
  for (const t of terrs) terre.addPath(cheminPoly(t.polygone))

  // ---- 1. Mer : dégradé profond + marbrures
  const g = ctx.createLinearGradient(0, 0, W * 0.3, H)
  g.addColorStop(0, '#3e6873'); g.addColorStop(0.5, '#335b67'); g.addColorStop(1, '#2a4c58')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  const marbre = bruitTuile(128, 7, 3, 4)
  ctx.save(); ctx.globalAlpha = 0.22; ctx.globalCompositeOperation = 'overlay'
  ctx.drawImage(marbre, 0, 0, W, H); ctx.restore()

  // ---- 2. Hauts-fonds : halo clair le long des côtes (masque flouté)
  const q = 0.25
  const masque = toile(W * q, H * q), mx = masque.getContext('2d')
  mx.setTransform(q, 0, 0, q, 0, 0); mx.fillStyle = '#fff'; mx.fill(terre)
  ctx.save()
  ctx.globalAlpha = 0.55; ctx.drawImage(teinter(flouter(masque, 4), '#9cc1bc'), 0, 0, W, H)
  ctx.globalAlpha = 0.6; ctx.drawImage(teinter(flouter(masque, 2), '#a9cbc4'), 0, 0, W, H)
  ctx.restore()

  // ---- 3. Lignes de côte concentriques (gravure)
  const calque = toile(W * f, H * f), cx2 = calque.getContext('2d')
  cx2.setTransform(f, 0, 0, f, 0, 0); cx2.lineJoin = 'round'
  for (const [d, a] of [[3.2, 0.55], [6.8, 0.38], [11, 0.24], [16, 0.14]]) {
    cx2.globalCompositeOperation = 'source-over'
    cx2.strokeStyle = `rgba(222,236,230,${a})`; cx2.lineWidth = d * 2; cx2.stroke(terre)
    cx2.globalCompositeOperation = 'destination-out'
    cx2.lineWidth = d * 2 - 0.9; cx2.stroke(terre)
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(calque, 0, 0); ctx.restore()
  calque.width = calque.height = 1

  // ---- 4. Vaguelettes au large
  const dist = distanceMer(masque)
  const rv = aleatoire(99)
  for (let k = 0; k < 900; k++) {
    const x = rv() * W, y = rv() * H
    const ix = Math.min(dist.w - 1, Math.floor(x * q)), iy = Math.min(dist.h - 1, Math.floor(y * q))
    const dd = dist.D[iy * dist.w + ix] / q
    if (dd < 22 || dd > 1e6) continue
    glypheVague(ctx, x, y, 3.2 + rv() * 2.2, 0.25 + Math.min(0.3, dd / 300))
  }

  // ---- 5. Terres : teinte par terrain
  for (const t of terrs) { ctx.fillStyle = COULEUR_TERRAIN[genre(t)]; ctx.fill(cheminPoly(t.polygone)) }

  // ---- 6. Texture du parchemin (clippée aux terres)
  ctx.save(); ctx.clip(terre)
  const taches = bruitTuile(128, 21, 4, 3)
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.28
  ctx.drawImage(taches, 0, 0, W, H)
  const fibre = bruitTuile(256, 5, 3, 16)
  ctx.globalAlpha = 0.16
  const motif = ctx.createPattern(fibre, 'repeat')
  ctx.fillStyle = motif; ctx.save(); ctx.scale(0.5, 0.5); ctx.fillRect(0, 0, W * 2, H * 2); ctx.restore()
  // Ombre douce le long du rivage, côté terre (la côte « monte » du papier).
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.18
  ctx.strokeStyle = '#6b5232'; ctx.lineWidth = 5; ctx.stroke(terre)
  ctx.restore()

  // ---- 7. Fleuves
  ctx.save(); ctx.clip(terre); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  for (const fl of FLEUVES) {
    const pts = lisser(fl)
    ctx.beginPath(); tracer(ctx, pts); ctx.strokeStyle = 'rgba(64,100,112,0.85)'; ctx.lineWidth = 2.1; ctx.stroke()
    ctx.beginPath(); tracer(ctx, pts); ctx.strokeStyle = '#8fb6bc'; ctx.lineWidth = 1.0; ctx.stroke()
  }
  ctx.restore()

  // ---- 8. Relief : montagnes, forêts, dunes, herbes (dessinés du haut vers le bas)
  const glyphes = []
  for (const t of terrs) {
    const gnr = genre(t), centre = t.centre, gr = hacher(t.id)
    if (gnr === 'montagne') for (const [x, y, r] of semer(t.polygone, centre, 1 / 300, 15, gr)) glyphes.push([y, 'm', x, 7.5 + r() * 5, r])
    else if (gnr === 'foret') for (const [x, y, r] of semer(t.polygone, centre, 1 / 125, 8, gr)) glyphes.push([y, y < CONIFERES_Y ? 'c' : 'f', x, 4 + r() * 1.6, r])
    else if (gnr === 'desert') for (const [x, y, r] of semer(t.polygone, centre, 1 / 180, 12, gr)) glyphes.push([y, 'd', x, 4 + r() * 2.5, r])
    else if (gnr === 'steppe') for (const [x, y, r] of semer(t.polygone, centre, 1 / 160, 10, gr)) glyphes.push([y, 'h', x, 3.5, r])
    else if (gnr === 'fertile') for (const [x, y, r] of semer(t.polygone, centre, 1 / 220, 11, gr)) glyphes.push([y, 'h', x, 3, r])
  }
  glyphes.sort((a, b) => a[0] - b[0])
  for (const [y, k, x, s, r] of glyphes) {
    if (k === 'm') glypheMontagne(ctx, x, y, s, r)
    else if (k === 'f') glypheFeuillu(ctx, x, y, s, r)
    else if (k === 'c') glypheResineux(ctx, x, y, s)
    else if (k === 'd') glypheDune(ctx, x, y, s)
    else glypheHerbe(ctx, x, y, s)
  }

  // ---- 9. Noms des régions (sous tout le reste, à peine visibles)
  ctx.save(); ctx.fillStyle = 'rgba(78,56,32,0.20)'; ctx.textBaseline = 'middle'
  for (const [nom, x, y, taille, angle = 0] of REGIONS) {
    ctx.font = `600 ${taille}px "Cinzel", Georgia, serif`
    texteEspace(ctx, nom, x, y, taille * 0.45, angle)
  }
  ctx.restore()

  // ---- 10. Limites de provinces (pointillés d'encre) et côtes
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  ctx.setLineDash([1.6, 1.9]); ctx.strokeStyle = 'rgba(74,57,37,0.55)'; ctx.lineWidth = 0.55
  ctx.beginPath()
  for (const t of terrs) for (const tr of troncons[t.id] || []) {
    if (tr.voisin.startsWith('#') || tr.voisin < t.id) continue  // chaque limite une seule fois
    tracer(ctx, tr.pts)
  }
  ctx.stroke()
  ctx.setLineDash([]); ctx.strokeStyle = '#3b2c1b'; ctx.lineWidth = 0.9
  ctx.beginPath()
  for (const t of terrs) for (const tr of troncons[t.id] || []) if (tr.voisin === '#mer') tracer(ctx, tr.pts)
  ctx.stroke()
  ctx.restore()

  // ---- 11. Noms des mers
  ctx.save(); ctx.textBaseline = 'middle'
  for (const m of MERS) {
    const [x0, y0, x1, y1] = m.zone
    let best = null
    for (let iy = Math.floor(y0 * q); iy < Math.min(dist.h, y1 * q); iy++)
      for (let ix = Math.floor(x0 * q); ix < Math.min(dist.w, x1 * q); ix++) {
        const v = dist.D[iy * dist.w + ix]
        if (v < 1e6 && (!best || v > best.v)) best = { v, x: ix / q, y: iy / q }
      }
    if (!best || best.v / q < m.taille * 0.6) continue
    ctx.font = `italic 600 ${m.taille}px "EB Garamond", Georgia, serif`
    ctx.fillStyle = 'rgba(224,236,230,0.62)'
    texteEspace(ctx, m.nom, best.x, best.y, m.taille * 0.32, m.angle || 0)
  }
  ctx.restore()

  // ---- 12. Grain du papier sur l'ensemble + cadre
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.5
  ctx.fillStyle = ctx.createPattern(grain(96, 3), 'repeat')
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillRect(0, 0, c.width, c.height); ctx.restore()
  ctx.restore()
  ctx.save(); ctx.strokeStyle = '#2a1f14'; ctx.lineWidth = 3.2; ctx.strokeRect(1.6, 1.6, W - 3.2, H - 3.2)
  ctx.strokeStyle = 'rgba(42,31,20,0.7)'; ctx.lineWidth = 0.7; ctx.strokeRect(6, 6, W - 12, H - 12)
  ctx.restore()
  return c
}

// ================================================================== LES ROYAUMES
function assombrir(hex, k) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k)
  return `rgb(${r},${g},${b})`
}
// `proprio(id)` → faction ou null ; `couleur(faction)` → '#rrggbb'.
export function peindreRoyaumes(cible, data, troncons, proprio, couleur) {
  const f = ECHELLE_ROYAUMES
  const W = (data.monde && data.monde.largeur) || 1400, H = (data.monde && data.monde.hauteur) || 1286
  const c = cible || toile(W * f, H * f)
  if (c.width !== Math.round(W * f)) { c.width = Math.round(W * f); c.height = Math.round(H * f) }
  const ctx = c.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height)
  ctx.setTransform(f, 0, 0, f, 0, 0); ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  const terrs = (data.territoires || []).filter((t) => Array.isArray(t.polygone) && t.polygone.length >= 3)
  const frontieres = (t, fid) => (troncons[t.id] || []).filter((tr) =>
    tr.voisin === '#bord' ? false : tr.voisin === '#mer' ? true : proprio(tr.voisin) !== fid)

  // Lavis + liseré intérieur le long des frontières du royaume.
  for (const t of terrs) {
    const fid = proprio(t.id); if (!fid) continue
    const col = couleur(fid), chemin = cheminPoly(t.polygone)
    ctx.globalAlpha = 0.5; ctx.fillStyle = col; ctx.fill(chemin)
    const fr = frontieres(t, fid)
    if (!fr.length) continue
    ctx.save(); ctx.clip(chemin)
    ctx.beginPath(); for (const tr of fr) tracer(ctx, tr.pts)
    ctx.strokeStyle = col; ctx.globalAlpha = 0.35; ctx.lineWidth = 11; ctx.stroke()
    ctx.globalAlpha = 0.55; ctx.lineWidth = 4.5; ctx.stroke()
    ctx.restore()
  }
  // Trait de frontière, par-dessus tous les lavis.
  ctx.globalAlpha = 1
  for (const t of terrs) {
    const fid = proprio(t.id); if (!fid) continue
    const fr = frontieres(t, fid).filter((tr) => tr.voisin !== '#mer')
    if (!fr.length) continue
    ctx.beginPath(); for (const tr of fr) tracer(ctx, tr.pts)
    ctx.strokeStyle = assombrir(couleur(fid), 0.55); ctx.lineWidth = 1.4; ctx.stroke()
  }
  ctx.globalAlpha = 1
  return c
}
