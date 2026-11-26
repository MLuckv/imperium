import { useEffect, useMemo, useState } from 'react'
import { getCatalog, postAction } from '../api'
import { num } from '../lib/format'
import { Overlay } from './ProductionModal'
import { UnitIcon, UiIcon, ResIcon } from './Icons'

// Modale de RECRUTEMENT. On recrute AUTANT QUE L'ON VEUT tant qu'on a assez d'or
// ET de population. Chaque clic lève une unité sur la région choisie.

const UNIT_LABELS = {
  levee: 'Levée paysanne', infanterie_legere: 'Infanterie légère',
  legionnaire: 'Légionnaire', hoplite: 'Hoplite', phalange: 'Phalange',
  cavalerie: 'Cavalerie', elephant: 'Éléphant de guerre', trireme: 'Trirème',
  mercenaire: 'Mercenaires', chevalier: 'Chevalier de la Table Ronde',
}
const TECH_NOMS = { tactique_elephants: 'Tactique des éléphants', navigation_maritime: 'Navigation maritime',
                    legion_tactique: 'Tactique de la légion', marine_guerre: 'Marine de guerre' }
const RES_LABEL = { fer: 'fer', bois: 'bois', pierre: 'pierre', or: 'or', nourriture: 'nourriture' }
// Où trouver la ressource qui manque : évite au joueur de chercher pourquoi il ne
// peut lever que des paysans après vingt tours.
const RES_SOURCE = { fer: 'Mine', bois: 'Scierie', pierre: 'Carrière', nourriture: 'Ferme' }

export default function RecruitmentModal({ state, forcedTerr, provNames = {}, onClose, onStateChange }) {
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
  const speciaux = new Set((joueur.merveilles_effet && joueur.merveilles_effet.speciaux) || [])

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

  // Catégories d'unités (comme les onglets de production de Civilization).
  const CATS = [
    ['Infanterie', ['levee', 'infanterie_legere', 'legionnaire', 'hoplite', 'phalange', 'mercenaire']],
    ['Cavalerie et bêtes de guerre', ['cavalerie', 'chevalier', 'elephant']],
    ['Marine', ['trireme']],
  ]
  const groupes = CATS.map(([nom, ids]) => ({ nom, items: unites.filter((u) => ids.includes(u.id)) }))
    .concat([{ nom: 'Autres', items: unites.filter((u) => !CATS.some(([, ids]) => ids.includes(u.id))) }])
    .filter((g) => g.items.length)

  return (
    <Overlay onClose={onClose} large>
      <div className="flex items-center gap-3 border-b border-bronze-dark/60 px-5 py-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-gold/70 bg-[radial-gradient(circle_at_40%_35%,#5a2a20,#1e0e0a)] text-gold">
          <UiIcon id="armee" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold tracking-wide text-gold">Recrutement</h2>
          <div className="text-xs text-parchment/60">Les unités sont levées dans la région choisie.</div>
        </div>
        {territoires.length > 0 && (
          <select value={region} onChange={(e) => setRegion(e.target.value)} title="Région de levée"
                  className="max-w-[170px] rounded-md border border-bronze-dark/70 bg-black/40 px-2 py-1 text-sm text-parchment">
            {territoires.map((t) => <option key={t} value={t}>{provNames[t] || t}</option>)}
          </select>
        )}
        <span className="flex items-center gap-1 text-sm"><ResIcon id="or" size={15} style={{ color: '#e0b23e' }} /><b className="text-gold">{num(or)}</b></span>
        <span className="flex items-center gap-1 text-sm"><ResIcon id="population" size={15} style={{ color: '#c49ac4' }} /><b className="text-parchment">{num(pop)}</b></span>
        <button onClick={onClose} className="btn btn-ghost btn-sm">Fermer</button>
      </div>

      {flash && <div className={'px-5 py-1.5 text-sm ' + (flash.ok ? 'bg-emerald-950/50 text-emerald-100' : 'bg-red-950/50 text-red-100')}>{flash.text}</div>}

      <div className="thin-scroll max-h-[68vh] space-y-4 overflow-y-auto p-4">
        {groupes.map((g) => (
          <div key={g.nom}>
            <h3 className="mb-1.5 font-display text-[11px] uppercase tracking-[0.22em] text-bronze/80">{g.nom}</h3>
            <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
              {g.items.map((u) => {
                const mervOk = !u.merveille_requise || speciaux.has(u.merveille_requise)
                const techOk = (!u.tech_requise || techs.has(u.tech_requise)) && mervOk
                const coutRes = u.cout_res || {}
                const resOk = Object.entries(coutRes).every(([rr, v]) => (ress[rr] || 0) >= v)
                const ok = techOk && or >= u.cout && pop >= (u.cout_pop || 1) && resOk
                const manques = []
                if (!mervOk) manques.push('requiert la Salle de la Table Ronde')
                else if (!techOk) manques.push(`requiert ${TECH_NOMS[u.tech_requise] || u.tech_requise}`)
                for (const [rr, v] of Object.entries(coutRes)) if ((ress[rr] || 0) < v && RES_SOURCE[rr]) manques.push(`${RES_LABEL[rr] || rr} : bâtissez ${RES_SOURCE[rr]}`)
                return (
                  <button key={u.id} disabled={!ok || !!busy} onClick={() => recruit(u)}
                          title={ok ? `Recruter (force ${u.force})` : manques.join(' · ') || 'Ressources insuffisantes'}
                          className={'ligne-prod ' + (ok ? '' : 'ligne-prod-off')}>
                    <span className="medaillon-prod" style={{ borderColor: techOk ? undefined : '#6a6a6a' }}><UnitIcon type={u.id} size={24} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 truncate font-display text-[13px] font-semibold tracking-wide text-parchment">
                        {UNIT_LABELS[u.id] || u.id}{!techOk && <UiIcon id="lock" size={12} className="text-red-300/80" />}
                      </span>
                      <span className="flex items-center gap-1.5 text-[11.5px]">
                        <span className="rounded bg-black/40 px-1.5 text-red-200/90" title="Force au combat">⚔ {u.force}</span>
                        {manques.length > 0 && <span className="truncate text-red-300/90">{manques[0]}</span>}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5 text-[11px]">
                      <span className="flex items-center gap-2">
                        <span className={'flex items-center gap-0.5 ' + (or >= u.cout ? 'text-gold' : 'text-red-300')}><ResIcon id="or" size={12} style={{ color: '#e0b23e' }} />{u.cout}</span>
                        {Object.entries(coutRes).map(([rr, v]) => (
                          <span key={rr} className={'flex items-center gap-0.5 ' + ((ress[rr] || 0) >= v ? 'text-parchment/75' : 'text-red-300')}><ResIcon id={rr} size={12} />{v}</span>
                        ))}
                      </span>
                      <span className={'flex items-center gap-0.5 ' + (pop >= (u.cout_pop || 1) ? 'text-parchment/55' : 'text-red-300')}><ResIcon id="population" size={11} />{u.cout_pop || 0}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Overlay>
  )
}
