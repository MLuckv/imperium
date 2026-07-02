import { useEffect, useMemo, useState } from 'react'
import { getCatalog, postAction } from '../api'
import { num } from '../lib/format'
import { Overlay } from './ProductionModal'
import { UnitIcon } from './Icons'

// Modale de RECRUTEMENT. On recrute AUTANT QUE L'ON VEUT tant qu'on a assez d'or
// ET de population. Chaque clic lève une unité sur la région choisie.

const UNIT_LABELS = {
  levee: 'Levée paysanne', infanterie_legere: 'Infanterie légère',
  legionnaire: 'Légionnaire', hoplite: 'Hoplite', phalange: 'Phalange',
  cavalerie: 'Cavalerie', elephant: 'Éléphant de guerre', trireme: 'Trirème',
  mercenaire: 'Mercenaires (or pur, 0 pop)',
}

export default function RecruitmentModal({ state, forcedTerr, onClose, onStateChange }) {
  const [catalog, setCatalog] = useState(null)
  const [busy, setBusy] = useState(null)
  const [flash, setFlash] = useState(null)

  const joueurId = state && state.meta && state.meta.joueur_pays
  const joueur = (state && state.pays && state.pays[joueurId]) || {}
  const territoires = joueur.territoires || []
  const ress = joueur.ressources || {}
  const or = ress.or || 0
  const pop = ress.population || 0
  const techs = useMemo(() => new Set(joueur.technologies || []), [joueur])

  const defReg = (forcedTerr && territoires.includes(forcedTerr)) ? forcedTerr : territoires[0]
  const [region, setRegion] = useState(defReg)
  if (territoires.length > 0 && !territoires.includes(region)) setRegion(defReg)

  useEffect(() => {
    let cancel = false
    getCatalog().then((d) => !cancel && setCatalog(d)).catch(() => !cancel && setCatalog({ unites: [] }))
    return () => { cancel = true }
  }, [])

  async function recruit(u) {
    setBusy(u.id); setFlash(null)
    try {
      const r = await postAction({ type: 'recruter', params: { type: u.id, quantite: 1, region } })
      setFlash({ ok: !!(r && r.valide), text: (r && r.raison) || 'Traité.' })
      if (r && r.valide && r.state) onStateChange(r.state)
    } catch (e) { setFlash({ ok: false, text: e.message || 'Échec' }) }
    finally { setBusy(null) }
  }

  const unites = (catalog && catalog.unites) || []

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between border-b border-bronze-dark/60 px-4 py-3">
        <h2 className="font-display text-lg font-bold tracking-wide text-gold">Recrutement</h2>
        <div className="flex items-center gap-3 text-xs text-parchment/70">
          <span>Or <b className="text-gold">{num(or)}</b></span>
          <span>Population <b className="text-parchment">{num(pop)}</b></span>
          {territoires.length > 0 && (
            <select value={region} onChange={(e) => setRegion(e.target.value)} title="Région de levée"
                    className="max-w-[150px] rounded border border-bronze-dark/60 bg-night px-1.5 py-0.5 text-parchment">
              {territoires.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <button onClick={onClose} className="btn btn-ghost btn-sm">Fermer</button>
        </div>
      </div>

      {flash && <div className={'px-4 py-1.5 text-sm ' + (flash.ok ? 'bg-emerald-950/40 text-emerald-100' : 'bg-red-950/40 text-red-100')}>{flash.text}</div>}

      <div className="thin-scroll max-h-[70vh] overflow-y-auto p-4">
        <p className="mb-3 text-xs text-parchment/50">Recrutez autant d'unités que vos réserves d'or et votre population le permettent. Chaque unité est levée sur la région choisie.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {unites.map((u) => {
            const techOk = !u.tech_requise || techs.has(u.tech_requise)
            const coutRes = u.cout_res || {}
            const resOk = Object.entries(coutRes).every(([rr, v]) => (ress[rr] || 0) >= v)
            const ok = techOk && or >= u.cout && pop >= (u.cout_pop || 1) && resOk
            const resTxt = Object.entries(coutRes).map(([rr, v]) => `${v} ${rr}`).join(', ')
            return (
              <button key={u.id} disabled={!ok || !!busy}
                      onClick={() => recruit(u)}
                      title={techOk ? `Force ${u.force}` : `Requiert : ${u.tech_requise}`}
                      className={'card flex items-center gap-2.5 text-left ' + (ok ? '' : 'card-disabled')}>
                <UnitIcon type={u.id} className="shrink-0 text-bronze" size={26} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{UNIT_LABELS[u.id] || u.id} {!techOk && '🔒'}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-parchment/60">
                    <span className="text-gold">{u.cout} or</span>
                    <span>· {u.cout_pop || 1} pop</span>
                    {resTxt && <span className={resOk ? '' : 'text-red-300'}>· {resTxt}</span>}
                    <span>· force {u.force}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </Overlay>
  )
}
