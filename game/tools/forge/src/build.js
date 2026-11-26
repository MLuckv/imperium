// La Forge d'Imperium : peint tous les assets et les écrit dans
// frontend/public/art. Lancer : npm run assets [-- emblemes unites …]
// Une planche-contact de chaque famille est écrite dans tools/forge/apercus/.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas } from '@napi-rs/canvas'
import { relief } from './core/relief.js'
import { EMBLEMES } from './art/emblemes.js'
import { UNITES } from './art/unites.js'

const ici = dirname(fileURLToPath(import.meta.url))
const SORTIE = resolve(ici, '../../../frontend/public/art')
const APERCUS = resolve(ici, '../apercus')
const demande = new Set(process.argv.slice(2))
const veut = (f) => demande.size === 0 || demande.has(f)

function ecrire(chemin, canvas, format = 'png') {
  mkdirSync(dirname(chemin), { recursive: true })
  writeFileSync(chemin, canvas.encodeSync(format, format === 'webp' ? 88 : undefined))
}

function planche(nom, images, fond = '#2a2016') {
  const n = images.length, col = Math.min(6, n), lignes = Math.ceil(n / col)
  const T = images[0].width
  const c = createCanvas(col * (T + 16) + 16, lignes * (T + 16) + 16)
  const ctx = c.getContext('2d')
  ctx.fillStyle = fond; ctx.fillRect(0, 0, c.width, c.height)
  images.forEach((im, i) => ctx.drawImage(im, 16 + (i % col) * (T + 16), 16 + Math.floor(i / col) * (T + 16)))
  ecrire(resolve(APERCUS, nom + '.png'), c)
}

const t0 = Date.now()
if (veut('emblemes')) {
  const imgs = []
  for (const [id, art] of Object.entries(EMBLEMES)) {
    const im = relief({ taille: 256, couches: art() })
    ecrire(resolve(SORTIE, `emblemes/${id}.png`), im)
    // silhouette pure (masque CSS pour les usages monochromes)
    const sil = relief({ taille: 128, couches: art().filter((c) => c.mode !== 'creuse'), ombre: false, lisere: false })
    ecrire(resolve(SORTIE, `emblemes/${id}-silhouette.png`), sil)
    imgs.push(im)
    console.log('  armoiries', id)
  }
  planche('emblemes', imgs)
}
if (veut('unites')) {
  const imgs = []
  for (const [id, art] of Object.entries(UNITES)) {
    const im = relief({ taille: 160, couches: art() })
    ecrire(resolve(SORTIE, `unites/${id}.png`), im)
    imgs.push(im)
    console.log('  unité', id)
  }
  planche('unites', imgs)
}
console.log(`Forge terminée en ${((Date.now() - t0) / 1000).toFixed(1)} s`)
