import { useMemo, useState } from 'react'

// PREMIERS PAS — le joueur démarre avec une seule province et aucun repère. Ce panneau
// déduit de l'état ce qui reste à faire et s'efface de lui-même une fois tout accompli.

export default function Objectifs({ state, onAction }) {
  const [replie, setReplie] = useState(false)
  const [ferme, setFerme] = useState(false)

  const objectifs = useMemo(() => {
    const id = state && state.meta && state.meta.joueur_pays
    const p = (state && state.pays && state.pays[id]) || {}
    const villes = p.villes || []
    const batiments = villes.reduce((n, v) => n + ((v.batiments || []).length), 0)
    const chantier = villes.some((v) => v.construction)
    const terrs = new Set(p.territoires || [])
    const dehors = (p.unites || []).some((u) => !terrs.has(u.territoire))
    return [
      { id: 'bat', fait: batiments > 0 || chantier, action: 'production',
        titre: 'Lancez un premier chantier',
        aide: 'Une ferme ou un marché : sans bâtiments, votre province stagne.' },
      { id: 'mine', fait: villes.some((v) => (v.batiments || []).includes('mine')), action: 'production',
        titre: 'Ouvrez une mine',
        aide: 'Sans fer, vous ne lèverez que des paysans et des mercenaires. Une mine demande du bois : bâtissez d\'abord une scierie.' },
      { id: 'tech', fait: (p.technologies || []).length >= 2, action: 'tech',
        titre: 'Achevez une recherche',
        aide: 'Les technologies débloquent bâtiments, unités et bonus durables.' },
      { id: 'armee', fait: (p.unites || []).length >= 2, action: 'recrutement',
        titre: 'Levez une seconde armée',
        aide: 'Une seule armée ne peut ni tenir vos terres ni en prendre.' },
      { id: 'marche', fait: dehors || terrs.size >= 2, action: null,
        titre: 'Marchez sur une province voisine',
        aide: 'Cliquez votre armée, puis la province visée : elle avancera.' },
      { id: 'annex', fait: terrs.size >= 2, action: null,
        titre: 'Annexez votre première conquête',
        aide: "Une fois l'armée sur place, le bouton « Annexer » apparaît en bas à gauche." },
      { id: 'diplo', action: 'civs',
        fait: Object.entries((state && state.conversations) || {})
                    .some(([f, msgs]) => f !== '_conseiller'
                          && (msgs || []).some((m) => m.role === 'joueur')),
        titre: 'Prenez langue avec un rival',
        aide: 'Parlez-leur : les souverains ont leur caractère et leur mémoire.' },
    ]
  }, [state])

  const restants = objectifs.filter((o) => !o.fait)
  if (ferme || restants.length === 0) return null
  const courant = restants[0]

  return (
    <div className="panel absolute left-3 top-3 z-10 w-64">
      <div className="flex items-center justify-between">
        <h2 className="panel-title !mb-0 !border-0 !pb-0">Premiers pas</h2>
        <div className="flex items-center gap-2 text-parchment/60">
          <span className="text-[11px]">{objectifs.length - restants.length}/{objectifs.length}</span>
          <button onClick={() => setReplie((v) => !v)} className="hover:text-parchment" title={replie ? 'Déplier' : 'Replier'}>
            {replie ? '▸' : '▾'}
          </button>
          <button onClick={() => setFerme(true)} className="hover:text-parchment" title="Masquer définitivement">✕</button>
        </div>
      </div>

      {replie ? (
        <div className="mt-2 text-xs text-parchment/80">➤ {courant.titre}</div>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {objectifs.map((o) => (
            <li key={o.id} className={'text-xs ' + (o.fait ? 'text-parchment/35 line-through' : 'text-parchment/90')}>
              <div className="flex items-start gap-1.5">
                <span className={o.fait ? 'text-emerald-500' : 'text-bronze'}>{o.fait ? '✓' : '○'}</span>
                <span className="flex-1">
                  {o.titre}
                  {!o.fait && o.id === courant.id && (
                    <span className="mt-0.5 block text-[11px] italic text-parchment/55">{o.aide}</span>
                  )}
                  {!o.fait && o.id === courant.id && o.action && (
                    <button onClick={() => onAction(o.action)} className="btn btn-primary btn-sm mt-1">Y aller</button>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
