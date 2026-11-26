// Armoiries des civilisations. Les images sont peintes par la Forge
// (tools/forge, `npm run assets`) en relief d'orfèvrerie : aigle d'or (Rome),
// ankh d'or et lapis (Égypte), épée dans le rocher (Bretons), soleil de
// Vergina (Macédoine), bouclier au lambda (Sparte), fleur de lys (Francs).
//
// variante 'or'    : l'objet en relief, avec ses matières (défaut des décors)
// variante 'plein' : silhouette unie dans la couleur courante (petits usages,
//                    filigranes, pastilles colorées)

const BASE = '/art/emblemes/'
const CONNUES = new Set(['rome', 'carthage', 'macedoine', 'sparte', 'francs', 'bretons'])

export default function Embleme({ faction, taille = 32, variante = 'plein', className = '', style, x, y }) {
  const id = CONNUES.has(faction) ? faction : 'rome'
  // Dans un <svg> (bannières) : élément <image>.
  if (x != null || y != null) {
    return <image href={`${BASE}${id}.png`} x={x} y={y} width={taille} height={taille} className={className} style={style} preserveAspectRatio="xMidYMid meet" />
  }
  if (variante === 'or') {
    return <img src={`${BASE}${id}.png`} width={taille} height={taille} alt="" draggable={false} className={className}
                style={{ display: 'inline-block', objectFit: 'contain', ...style }} />
  }
  const m = `url(${BASE}${id}-silhouette.png) center / contain no-repeat`
  return <span aria-hidden="true" className={className}
               style={{ display: 'inline-block', width: taille, height: taille, background: 'currentColor', WebkitMask: m, mask: m, ...style }} />
}
