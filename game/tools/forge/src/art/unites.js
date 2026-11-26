// Portraits d'unités : l'objet emblématique de chaque troupe, en relief peint.
import { P, plume, remplir, evider, tracer, cadrer, bordure } from '../core/formes.js'

const deg = (d) => (d * Math.PI) / 180
const cercle = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill() }
const rivets = (pts, r = 1.1) => (ctx) => { for (const [x, y] of pts) cercle(ctx, x, y, r) }

const BOIS = { mat: '#7a4b26', brillance: 0.06 }
const BOIS_CLAIR = { mat: '#9a6a3a', brillance: 0.06 }
const CUIR = { mat: '#6b3f1f', brillance: 0.1 }
const CRIN_ROUGE = { mat: '#a8261c', brillance: 0.04 }
const TOILE = { mat: '#e4d6b4', brillance: 0.02 }
const GRAIN_BOIS = { echelle: 14, force: 0.5, graine: 4 }

// Lance (hampe + fer) d'un point à un autre ; renvoie deux couches.
function lance(x0, y0, x1, y1, larg = 2.4, fer = 13) {
  const a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0)
  const c = Math.cos(a), s = Math.sin(a)
  const hampe = (ctx) => tracer(ctx, [`M${x0} ${y0} L${x0 + c * (L - fer * 0.8)} ${y0 + s * (L - fer * 0.8)}`], larg)
  const pointe = (ctx) => remplir(ctx, [plume(x0 + c * (L - fer), y0 + s * (L - fer), a, fer, larg * 1.35, 0.15)])
  return [
    { forme: hampe, hauteur: 2.6, biseau: 1.3, profil: 'rond', matiere: BOIS, mode: 'pose' },
    { forme: pointe, hauteur: 3, biseau: 1.6, profil: 'biseau', matiere: 'acier', mode: 'pose' },
  ]
}

// ------------------------------------------------ Légionnaire : casque gaulois impérial
function legionnaire() {
  return [
    { forme: (ctx) => remplir(ctx, ['M30 21 C34 9.5 46 4 58 5.5 C68 7 74.5 13.5 76.5 22 C70.5 18 62.5 15.8 54 15.8 C44.5 15.8 36.5 17.8 30 21 Z']), hauteur: 5, biseau: 3, profil: 'rond', matiere: CRIN_ROUGE, grain: { echelle: 50, force: 0.6, graine: 3 } },
    { forme: (ctx) => tracer(ctx, Array.from({ length: 12 }, (_, i) => { const u = i / 11; const x = 33 + u * 41; return `M${x} ${18.5 - Math.sin(u * Math.PI) * 3} L${x - 2 + u * 4} ${9 + Math.abs(u - 0.5) * 6}` }), 0.6), hauteur: 1, biseau: 0.5, profil: 'rond', mode: 'creuse' },
    { forme: (ctx) => remplir(ctx, ['M26.5 47.5 C22 49.5 16 53 12.5 57.5 C11.6 59.2 12.8 60.8 14.8 60.4 C21 59 29 57.4 37 56.6 L38.2 50.8 Z']), hauteur: 5, biseau: 3, profil: 'rond', matiere: 'acier', mode: 'pose' },
    { forme: (ctx) => remplir(ctx, ['M70.5 47 C71.5 31 61.5 19.5 47.5 19.5 C34 19.5 25.5 29.5 25.5 43 L26 51.5 L39 53 L70.5 49.5 Z']), hauteur: 8.5, biseau: 14, profil: 'rond', matiere: 'acier', mode: 'pose' },
    { forme: (ctx) => remplir(ctx, ['M68.6 44 C71.6 44.8 74.4 46.2 75.8 48.2 C76.2 49.6 75.4 50.6 74 50.4 L68.4 49.6 Z', 'M27 50 L70 48 L70.4 51 L27.4 53.4 Z']), hauteur: 8, biseau: 1.6, profil: 'rond', matiere: 'bronze', mode: 'pose' },
    { forme: (ctx) => { remplir(ctx, ['M52.5 50.5 L68.5 50 C69 58 67.6 66 62.6 74 C60 77.2 56 77.2 54 74 C52 68 51.6 60 52.5 50.5 Z']); }, hauteur: 6.5, biseau: 3, profil: 'rond', matiere: 'acier', mode: 'pose' },
    { forme: (ctx) => bordure(ctx, 'M52.5 50.5 L68.5 50 C69 58 67.6 66 62.6 74 C60 77.2 56 77.2 54 74 C52 68 51.6 60 52.5 50.5 Z', 0.4, 1.7), hauteur: 1.2, biseau: 0.8, profil: 'rond', matiere: 'bronze', mode: 'ajoute' },
    { forme: rivets([[60, 56], [60, 66], [31, 56.5], [22, 57.5], [40, 50.5], [55, 49.8]], 1.2), hauteur: 1.4, biseau: 1.2, profil: 'rond', matiere: 'bronze', mode: 'ajoute' },
    { forme: (ctx) => tracer(ctx, ['M56 30 C60 27 65 28.5 67.5 33', 'M46 26.5 C50 24 55 24.6 57.5 27.5', 'M32 38 C40 41 50 42 60 41'], 0.9), hauteur: 1.2, biseau: 0.8, profil: 'rond', mode: 'creuse' },
  ]
}

// ------------------------------------------------ Hoplite : casque corinthien
function hoplite() {
  const casque = 'M68.5 40 C68.5 27 59.5 18 46.5 18 C32.5 18 23.5 28 23.5 42 C23.5 54 22.5 64 19.5 73.5 C25.5 76.5 33.5 77.5 40.5 75.5 C42.5 70.5 44.5 66.5 48.5 64.5 C52.5 66.5 55.5 71.5 57.5 78.5 C63.5 78.5 68.5 76.5 72.5 72.5 C70.5 64.5 70.5 56.5 71.5 50.5 L74 46 Z'
  return [
    { forme: (ctx) => remplir(ctx, ['M26 23 C30 9 44 3 58 5 C66 6 70.5 10 72.5 15 C68 13 62 12 56 13 C46 15 38 21 34 29 C30.5 35 28.5 41 27 47 C22.5 41 22.5 31 26 23 Z']), hauteur: 5, biseau: 3, profil: 'rond', matiere: CRIN_ROUGE, grain: { echelle: 50, force: 0.6, graine: 8 } },
    { forme: (ctx) => tracer(ctx, Array.from({ length: 11 }, (_, i) => { const u = i / 10; return `M${30 + u * 38} ${20 - Math.sin(u * Math.PI) * 6 + u * 2} L${28 + u * 36} ${10 + Math.abs(u - 0.4) * 8}` }), 0.6), hauteur: 1, biseau: 0.5, profil: 'rond', mode: 'creuse' },
    { forme: (ctx) => { remplir(ctx, [casque]); evider(ctx, ['M58 40 C62 38 67 38.4 74 40.6 C70 44 65 45.2 60.4 44.2 Z', 'M68 44 L74 44 L73 70 L69 70 Z']) }, hauteur: 9, biseau: 14, profil: 'rond', matiere: 'bronze', mode: 'pose', grain: { echelle: 24, force: 0.35, graine: 2 } },
    { forme: (ctx) => { bordure(ctx, casque, 1.6, 3.2); evider(ctx, ['M58 40 C62 38 67 38.4 74 40.6 C70 44 65 45.2 60.4 44.2 Z', 'M68 44 L74 44 L73 70 L69 70 Z']) }, hauteur: 1.2, biseau: 0.8, profil: 'rond', matiere: 'or', mode: 'ajoute' },
    { forme: (ctx) => tracer(ctx, ['M27 47 C36 51 50 51.5 64 47.5', 'M50 22 C56 24 62 29 64 36'], 0.9), hauteur: 1.2, biseau: 0.8, profil: 'rond', mode: 'creuse' },
  ]
}

// ------------------------------------------------ Phalange : sarisses et bouclier macédonien
function phalange() {
  const couches = []
  for (const [x0, y0, x1, y1] of [[14, 96, 86, 6], [30, 98, 92, 14], [6, 84, 74, 2]]) couches.push(...lance(x0, y0, x1, y1, 2.2, 12))
  couches.push({ forme: (ctx) => cercle(ctx, 46, 60, 30), hauteur: 6, biseau: 3, profil: 'rond', matiere: 'bronze', mode: 'pose' })
  couches.push({ forme: (ctx) => cercle(ctx, 46, 60, 25.5), hauteur: 8, biseau: 26, profil: 'dome', matiere: { email: '#8c1d18' }, mode: 'pose' })
  const rayons = []
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2; rayons.push(plume(46 + Math.cos(a) * 4, 60 + Math.sin(a) * 4, a, 15, 2.6, 0.5)) }
  couches.push({ forme: (ctx) => { remplir(ctx, rayons); cercle(ctx, 46, 60, 5) }, hauteur: 2.2, biseau: 1.4, profil: 'rond', matiere: 'or', mode: 'ajoute' })
  couches.push({ forme: (ctx) => { for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; cercle(ctx, 46 + Math.cos(a) * 27.8, 60 + Math.sin(a) * 27.8, 2.2) } }, hauteur: 1.6, biseau: 1.6, profil: 'rond', matiere: 'or', mode: 'ajoute' })
  return couches
}

// ------------------------------------------------ Levée : lance et bouclier de planches
function levee() {
  const couches = [...lance(18, 96, 84, 6, 2.8, 16)]
  couches.push({ forme: (ctx) => cercle(ctx, 44, 60, 29), hauteur: 6, biseau: 3, profil: 'rond', matiere: 'fer', mode: 'pose' })
  couches.push({ forme: (ctx) => cercle(ctx, 44, 60, 26), hauteur: 6.5, biseau: 6, profil: 'coussin', matiere: BOIS_CLAIR, mode: 'pose', grain: GRAIN_BOIS })
  couches.push({ forme: (ctx) => tracer(ctx, [-15, -5, 5, 15].map((d) => `M${44 + d} 35 L${44 + d} 85`), 0.9), hauteur: 1.4, biseau: 0.7, profil: 'rond', mode: 'creuse' })
  couches.push({ forme: (ctx) => cercle(ctx, 44, 60, 8), hauteur: 6, biseau: 8, profil: 'dome', matiere: 'fer', mode: 'ajoute' })
  couches.push({ forme: rivets([[44, 36], [44, 84], [20, 60], [68, 60], [27, 43], [61, 43], [27, 77], [61, 77]], 1.3), hauteur: 1.4, biseau: 1.3, profil: 'rond', matiere: 'fer', mode: 'ajoute' })
  return couches
}

// ------------------------------------------------ Infanterie légère : javelots et pelte
function infanterieLegere() {
  const couches = []
  for (const [x0, y0, x1, y1] of [[28, 96, 40, 6], [40, 98, 60, 6], [52, 96, 82, 10]]) couches.push(...lance(x0, y0, x1, y1, 2, 11))
  const pelte = 'M14 50 C22 46 32 46 40 52 C44 48 48 46 50 46 C52 46 56 48 60 52 C68 46 78 46 86 50 C86 70 72 88 50 90 C28 88 14 70 14 50 Z'
  couches.push({ forme: (ctx) => remplir(ctx, [pelte]), hauteur: 6, biseau: 3, profil: 'rond', matiere: 'bronze', mode: 'pose' })
  couches.push({ forme: (ctx) => remplir(ctx, [pelte], { retrait: 3 }), hauteur: 7, biseau: 10, profil: 'coussin', matiere: CUIR, mode: 'pose', grain: { echelle: 30, force: 0.4, graine: 5 } })
  couches.push({ forme: (ctx) => { cercle(ctx, 50, 66, 6); tracer(ctx, ['M26 58 C34 72 42 78 50 80 C58 78 66 72 74 58'], 1.4) }, hauteur: 2, biseau: 2, profil: 'rond', matiere: 'bronze', mode: 'ajoute' })
  return couches
}

// ------------------------------------------------ Cavalerie : tête de cheval bridée
function cavalerie() {
  const tete = 'M28 94 C26 80 28 66 32 56 C34 46 38 36 44 28 L42.5 14 C46.5 15.5 49.5 19.5 50.5 24 L55 17.5 C57.4 21.5 57.6 26 56.6 30 C63.6 34 71.6 42 79.6 52 C83.6 57 85.6 62 83.6 66.5 C81.6 70.5 75.6 70.5 71.6 68.5 C65.6 66.5 59.6 64.5 55.6 66.5 C53.6 74.5 53.6 84.5 55.6 94 Z'
  const criniere = 'M30 70 C26 58 28 44 36 34 C40 28 44 24 46 22 C46 28 42 34 41 40 C40 48 40 56 41 64 C42 74 42 84 44 94 L30 94 C29 86 29 78 30 70 Z'
  return [
    { forme: (ctx) => remplir(ctx, [tete]), hauteur: 9, biseau: 16, profil: 'rond', matiere: { mat: '#7b4a26', brillance: 0.12 }, grain: { echelle: 60, force: 0.25, graine: 6 } },
    { forme: (ctx) => remplir(ctx, [criniere]), hauteur: 10.5, biseau: 5, profil: 'rond', matiere: { mat: '#2c1a10', brillance: 0.08 }, mode: 'pose', grain: { echelle: 40, force: 0.8, graine: 7 } },
    { forme: (ctx) => tracer(ctx, Array.from({ length: 9 }, (_, i) => { const y = 34 + i * 6.6; return `M${43 - i * 0.6} ${y - 6} C${38 - i * 0.4} ${y} ${36} ${y + 4} ${33 - i * 0.2} ${y + 9}` }), 0.7), hauteur: 1.2, biseau: 0.6, profil: 'rond', mode: 'creuse' },
    { forme: (ctx) => tracer(ctx, ['M50 31 L60 33', 'M55 33 L66 57', 'M68 50 C71 56 74 62 75.5 67.5', 'M57 59 C62 62 68 64 74 66'], 2.4), hauteur: 10.5, biseau: 1.2, profil: 'rond', matiere: CUIR, mode: 'pose' },
    { forme: (ctx) => { cercle(ctx, 66, 57.5, 2.6); cercle(ctx, 60, 33, 2) }, hauteur: 11.5, biseau: 2.4, profil: 'rond', matiere: 'bronze', mode: 'pose' },
    { forme: (ctx) => { remplir(ctx, ['M54 37.5 C56 35.6 59 35.4 61.2 37 C59.4 39.4 56.4 39.8 54 37.5 Z']); tracer(ctx, ['M78.5 59.5 C80 60.5 80.6 62 80.2 63.4', 'M76 67 C79 67.6 81.4 66.6 82.6 65'], 0.9) }, hauteur: 2, biseau: 1, profil: 'rond', mode: 'creuse' },
  ]
}

// ------------------------------------------------ Éléphant de guerre
function elephant() {
  const corps = 'M18 90 C14 72 16 50 24 38 C32 26 46 20 58 21.5 C68 23 75 31 77.5 41 C79.5 50 78 58 76 65 C74 73 74 81 78.5 89 C80.5 92.5 77.5 95 74 94 C68 92 65.5 86 65.5 79.5 C65.5 74 65.5 70 63.5 66 C59.5 70 55.5 72 51.5 72 L49.5 90 Z'
  const oreille = 'M28.5 39 C22 45.5 19.5 58 24 68.5 C28 75 37 75.5 43.5 70.5 C46 60 46 48 41.5 40 C37.5 35 32.5 35 28.5 39 Z'
  return [
    { forme: (ctx) => remplir(ctx, [corps]), hauteur: 9, biseau: 18, profil: 'rond', matiere: { mat: '#8b8780', brillance: 0.06 }, grain: { echelle: 36, force: 0.7, graine: 12 } },
    { forme: (ctx) => remplir(ctx, [oreille]), hauteur: 11, biseau: 8, profil: 'coussin', matiere: { mat: '#7e7a73', brillance: 0.05 }, mode: 'pose', grain: { echelle: 36, force: 0.7, graine: 13 } },
    { forme: (ctx) => remplir(ctx, ['M45 22.5 C53 19 63 20 70 25 L67 36 C60 33 52 33 45 35 Z']), hauteur: 10.5, biseau: 2.2, profil: 'rond', matiere: { mat: '#9e2219', brillance: 0.06 }, mode: 'pose' },
    { forme: (ctx) => { for (let i = 0; i < 6; i++) cercle(ctx, 46.5 + i * 4.2, 35.2 - i * 0.3, 1.5) }, hauteur: 11.5, biseau: 1.5, profil: 'rond', matiere: 'or', mode: 'pose' },
    { forme: (ctx) => remplir(ctx, ['M62.5 62 C68.5 66.5 75.5 66.5 83 61.5 C81 67.5 74.5 70.6 66 68.6 Z']), hauteur: 11, biseau: 2.6, profil: 'rond', matiere: { ivoire: '#f1e6cc' }, mode: 'pose' },
    { forme: (ctx) => { remplir(ctx, ['M57 40.5 C59 38.6 62 38.4 64 40 C62.2 42.4 59.4 42.8 57 40.5 Z']); tracer(ctx, [0, 1, 2, 3, 4, 5].map((i) => `M${68 + i * 0.4} ${70 + i * 3.8} C${71.5 + i * 0.3} ${69 + i * 3.8} ${74 + i * 0.2} ${69.5 + i * 3.8} ${76.5 - i * 0.1} ${71 + i * 3.6}`), 0.7); tracer(ctx, ['M33 44 C30 52 30 60 34 67'], 0.8) }, hauteur: 1.4, biseau: 0.7, profil: 'rond', mode: 'creuse' },
  ]
}

// ------------------------------------------------ Trirème
function trireme() {
  const coque = 'M12 56 L84 56 C87 56 89 57.5 90 59.5 L96 62 L88 63.5 C86.5 68 81 71 74 71 L24 71 C18 71 14 68 12.5 64 Z'
  return [
    { forme: (ctx) => tracer(ctx, ['M50 56 L50 12', 'M30 18 L70 18'], 2.2), hauteur: 3, biseau: 1.2, profil: 'rond', matiere: BOIS },
    { forme: (ctx) => remplir(ctx, ['M31 18 L69 18 C70 30 69.5 42 68 52 L32 52 C30.5 42 30 30 31 18 Z']), hauteur: 5, biseau: 10, profil: 'coussin', matiere: TOILE, mode: 'pose', grain: { echelle: 40, force: 0.3, graine: 14 } },
    { forme: (ctx) => remplir(ctx, ['M43 18 L57 18 L56.6 52 L43.4 52 Z']), hauteur: 5.2, biseau: 2, profil: 'coussin', matiere: { mat: '#a3261c' }, mode: 'pose' },
    { forme: (ctx) => remplir(ctx, ['M12 57 C7 50 6.5 40 12 33.5 C12.5 41 14.5 49 18.5 55.5 Z']), hauteur: 5, biseau: 2.4, profil: 'rond', matiere: BOIS, mode: 'pose' },
    { forme: (ctx) => tracer(ctx, Array.from({ length: 9 }, (_, i) => `M${22 + i * 7} 66 L${16 + i * 7} 86`), 1.5), hauteur: 3, biseau: 1, profil: 'rond', matiere: BOIS_CLAIR, mode: 'pose' },
    { forme: (ctx) => remplir(ctx, [coque]), hauteur: 7, biseau: 5, profil: 'coussin', matiere: { mat: '#4a2c16', brillance: 0.08 }, mode: 'pose', grain: GRAIN_BOIS },
    { forme: (ctx) => remplir(ctx, ['M13 58.5 L86 58.5 L86 62 L13 62 Z']), hauteur: 7.6, biseau: 1, profil: 'rond', matiere: { mat: '#a3261c' }, mode: 'pose' },
    { forme: (ctx) => remplir(ctx, ['M86 62.5 L98 64.5 L86 67.5 Z']), hauteur: 7.5, biseau: 1.6, profil: 'biseau', matiere: 'bronze', mode: 'pose' },
    { forme: (ctx) => { remplir(ctx, ['M78 63.5 C80 62 83 62 84.6 63.5 C83 65.4 80.2 65.6 78 63.5 Z']) }, hauteur: 8.2, biseau: 0.8, profil: 'rond', matiere: { ivoire: '#f4ecd8' }, mode: 'pose' },
    { forme: (ctx) => remplir(ctx, ['M4 84 C12 80 20 80 28 84 C36 80 44 80 52 84 C60 80 68 80 76 84 C84 80 92 80 98 84 L98 96 L4 96 Z']), hauteur: 4, biseau: 4, profil: 'coussin', matiere: { email: '#2b6a7c' }, mode: 'pose' },
    { forme: (ctx) => tracer(ctx, ['M10 88 C16 86 22 86 28 88', 'M40 89 C46 87 52 87 58 89', 'M70 88 C76 86 82 86 88 88'], 0.9), hauteur: 4.5, biseau: 0.5, profil: 'rond', matiere: { email: '#cfe6e4' }, mode: 'pose' },
  ]
}

// ------------------------------------------------ Mercenaire : falcatas croisées et bourse
function mercenaire() {
  const falcata = (miroir) => (ctx) => {
    ctx.save(); if (miroir) { ctx.translate(100, 0); ctx.scale(-1, 1) }
    remplir(ctx, ['M24 86 L30 80 C40 64 52 46 66 30 C71 24 76 18 82 14 C80 22 76 30 70 37 C60 50 48 64 36 78 L32 84 Z']); ctx.restore()
  }
  const garde = (miroir) => (ctx) => {
    ctx.save(); if (miroir) { ctx.translate(100, 0); ctx.scale(-1, 1) }
    remplir(ctx, ['M21 78 L33 88 L30.5 90.5 L18.5 80.5 Z']); tracer(ctx, ['M24 86 C20 90 16 92 12 92'], 3.4); ctx.restore()
  }
  return [
    { forme: falcata(false), hauteur: 3.6, biseau: 3.4, profil: 'biseau', matiere: 'acier' },
    { forme: garde(false), hauteur: 4.5, biseau: 1.8, profil: 'rond', matiere: 'bronze', mode: 'pose' },
    { forme: falcata(true), hauteur: 3.6, biseau: 3.4, profil: 'biseau', matiere: 'acier', mode: 'pose' },
    { forme: garde(true), hauteur: 4.5, biseau: 1.8, profil: 'rond', matiere: 'bronze', mode: 'pose' },
    { forme: (ctx) => remplir(ctx, ['M38 60 C36 50 42 44 50 44 C58 44 64 50 62 60 C68 66 70 76 66 84 C62 90 38 90 34 84 C30 76 32 66 38 60 Z']), hauteur: 9, biseau: 12, profil: 'coussin', matiere: CUIR, mode: 'pose', grain: { echelle: 30, force: 0.6, graine: 9 } },
    { forme: (ctx) => tracer(ctx, ['M39 59 C45 62 55 62 61 59'], 2.2), hauteur: 9.5, biseau: 1, profil: 'rond', matiere: { mat: '#c8a050' }, mode: 'pose' },
    { forme: (ctx) => { cercle(ctx, 44, 74, 4.5); cercle(ctx, 55, 77, 4.5) }, hauteur: 11, biseau: 4.5, profil: 'dome', matiere: 'or', mode: 'pose' },
  ]
}

// ------------------------------------------------ Chevalier : heaume
function chevalier() {
  const heaume = 'M27 30 C27 21 37 16 50 16 C63 16 73 21 73 30 L74.5 74 C74.5 81 67 86 50 87.5 C33 86 25.5 81 25.5 74 Z'
  return [
    { forme: (ctx) => remplir(ctx, ['M50 16 C44 10 40 6 34 4 C40 3 46 4 50 7 C54 4 60 3 66 4 C60 6 56 10 50 16 Z', 'M44 14 C40 6 42 1 50 0 C58 1 60 6 56 14 Z']), hauteur: 5, biseau: 3, profil: 'rond', matiere: CRIN_ROUGE },
    { forme: (ctx) => { remplir(ctx, [heaume]); evider(ctx, ['M30 43 L47.5 43 L47.5 47.6 L30 47.6 Z', 'M52.5 43 L70 43 L70 47.6 L52.5 47.6 Z']) }, hauteur: 9, biseau: 20, profil: 'rond', matiere: 'acier', mode: 'pose', grain: { echelle: 30, force: 0.25, graine: 15 } },
    { forme: (ctx) => remplir(ctx, ['M47.6 18 L52.4 18 L52.4 84 L47.6 84 Z', 'M27 50.5 L73 50.5 L73 54.5 L27 54.5 Z']), hauteur: 1.6, biseau: 1.2, profil: 'rond', matiere: 'or', mode: 'ajoute' },
    { forme: (ctx) => { for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) { cercle(ctx, 57 + k * 3.6, 62 + r * 4.6, 1.05); cercle(ctx, 43 - k * 3.6, 62 + r * 4.6, 1.05) } }, hauteur: 2, biseau: 1, profil: 'rond', mode: 'creuse' },
    { forme: rivets([[30, 24], [70, 24], [28, 74], [72, 74], [38, 82], [62, 82]], 1.3), hauteur: 1.4, biseau: 1.3, profil: 'rond', matiere: 'or', mode: 'ajoute' },
  ]
}

export const UNITES = {
  levee, infanterie_legere: infanterieLegere, legionnaire, hoplite, phalange,
  cavalerie, elephant, trireme, mercenaire, chevalier,
}
