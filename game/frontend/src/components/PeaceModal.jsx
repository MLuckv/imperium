import { useEffect, useMemo, useState } from 'react'
import { getWarOffers, makePeace } from '../api'
import { factionColor, factionLabel, num } from '../lib/format'
import { Overlay } from './ProductionModal'

// Traité de paix façon Age of History 2 : un SCORE DE GUERRE se dépense pour
// réclamer des provinces (chacune vaut des ÉTOILES) et de l'or. Ce qu'on ne peut
// pas payer, on ne peut pas l'exiger.

function Etoiles({ n }) {
  return (
    <span className="tracking-tight text-gold" title={`${n} étoile${n > 1 ? 's' : ''}`}>
      {'★'.repeat(n)}<span className="text-parchment/25">{'★'.repeat(5 - n)}</span>
    </span>
  )
}

export default function PeaceModal({ cible, state, onClose, onStateChange }) {
  const [offres, setOffres] = useState(null)
  const [choix, setChoix] = useState([])       // provinces réclamées
  const [orExige, setOrExige] = useState(0)
  const [erreur, setErreur] = useState(null)
  const [busy, setBusy] = useState(false)
  const accent = factionColor(cible)
  const nomCible = factionLabel(cible, state && state.pays && state.pays[cible] && state.pays[cible].nom)

  useEffect(() => {
    let annule = false
    getWarOffers(cible)
      .then((o) => { if (!annule) setOffres(o) })
      .catch((e) => { if (!annule) setErreur(e.message || 'Impossible de charger les termes') })
    return () => { annule = true }
  }, [cible])

  const coutProvinces = useMemo(() => {
    if (!offres) return 0
    return offres.provinces.filter((p) => choix.includes(p.id))
                           .reduce((s, p) => s + p.cout, 0)
  }, [offres, choix])

  const score = offres ? offres.score : 0
  const OR_PAR_POINT = 12
  const restant = Math.max(0, score - coutProvinces - orExige / OR_PAR_POINT)
  const orMaxPossible = offres
    ? Math.min(offres.or_max, Math.floor(Math.max(0, score - coutProvinces) * OR_PAR_POINT))
    : 0

  function basculer(p) {
    setErreur(null)
    if (choix.includes(p.id)) { setChoix(choix.filter((x) => x !== p.id)); return }
    if (coutProvinces + p.cout + orExige / OR_PAR_POINT > score + 0.01) {
      setErreur(`Votre score de guerre ne suffit pas pour ${p.nom}.`); return
    }
    setChoix([...choix, p.id])
  }

  async function conclure() {
    setBusy(true); setErreur(null)
    try {
      const r = await makePeace(cible, choix, orExige)
      if (r && r.ok) { if (r.state) onStateChange(r.state); onClose(r.raison) }
      else setErreur((r && r.raison) || 'Traité refusé')
    } catch (e) { setErreur(e.message || 'Échec du traité') }
    finally { setBusy(false) }
  }

  return (
    <Overlay onClose={() => onClose(null)}>
      <div className="flex items-center justify-between border-b border-bronze-dark/60 px-4 py-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-wide text-gold">Traité de paix</h2>
          <div className="text-xs text-bronze">Vos exigences envers <span style={{ color: accent }}>{nomCible}</span></div>
        </div>
        <button onClick={() => onClose(null)} className="btn btn-ghost btn-sm">Fermer</button>
      </div>

      {!offres && !erreur && <div className="p-6 text-center text-sm text-parchment/60">Consultation des hérauts…</div>}
      {offres && (
        <div className="max-h-[70vh] overflow-y-auto p-4">
          {/* Jauge de score de guerre */}
          <div className="mb-4">
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="uppercase tracking-widest text-bronze">Score de guerre</span>
              <span className="font-semibold text-parchment">
                {restant.toFixed(0)} <span className="text-parchment/50">/ {score.toFixed(0)} pts restants</span>
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-black/40">
              <div className="h-full rounded-full transition-all"
                   style={{ width: `${score ? (restant / score) * 100 : 0}%`, backgroundColor: '#caa53d' }} />
            </div>
            {score < 10 && (
              <p className="mt-1 text-[11px] italic text-parchment/50">
                Vos victoires sont trop maigres pour exiger quoi que ce soit. Remportez des batailles,
                prenez des provinces — le score monte avec les faits d'armes.
              </p>
            )}
          </div>

          {/* Provinces réclamables */}
          <div className="mb-2 text-xs uppercase tracking-widest text-bronze">Provinces à réclamer</div>
          <div className="space-y-1">
            {offres.provinces.map((p) => {
              const pris = choix.includes(p.id)
              const hors = !pris && (coutProvinces + p.cout + orExige / OR_PAR_POINT > score + 0.01)
              return (
                <button key={p.id} onClick={() => basculer(p)} disabled={hors}
                        className={'flex w-full items-center justify-between rounded border px-3 py-2 text-left transition ' +
                          (pris ? 'border-gold bg-gold/15'
                                : hors ? 'cursor-not-allowed border-bronze-dark/30 opacity-40'
                                       : 'border-bronze-dark/50 hover:border-bronze')}>
                  <span className="flex items-center gap-2">
                    <span className={'text-sm ' + (pris ? 'font-semibold text-gold' : 'text-parchment')}>{p.nom}</span>
                    {p.capitale && <span className="rounded bg-red-900/50 px-1 text-[10px] text-red-200">capitale</span>}
                  </span>
                  <span className="flex items-center gap-3 text-xs">
                    <Etoiles n={p.etoiles} />
                    <span className={pris ? 'text-gold' : 'text-parchment/60'}>{p.cout.toFixed(0)} pts</span>
                  </span>
                </button>
              )
            })}
            {offres.provinces.length === 0 && (
              <div className="text-sm text-parchment/50">Cette puissance n'a plus une seule province.</div>
            )}
          </div>

          {/* Tribut en or */}
          <div className="mt-4">
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="uppercase tracking-widest text-bronze">Tribut de guerre</span>
              <span className="text-gold">{num(orExige)} or</span>
            </div>
            <input type="range" min={0} max={orMaxPossible} step={10} value={Math.min(orExige, orMaxPossible)}
                   onChange={(e) => { setOrExige(Number(e.target.value)); setErreur(null) }}
                   className="w-full accent-[#caa53d]" disabled={orMaxPossible <= 0} />
            <div className="text-[11px] text-parchment/50">
              {orMaxPossible > 0 ? `Jusqu'à ${num(orMaxPossible)} or (leur trésor et votre score le permettent).`
                                 : 'Leurs caisses sont vides, ou votre score est épuisé.'}
            </div>
          </div>

          {erreur && <p className="mt-3 rounded border border-red-800/50 bg-red-950/30 px-2 py-1 text-xs text-red-300">{erreur}</p>}

          <div className="mt-4 flex items-center justify-between gap-2">
            <button onClick={() => { setChoix([]); setOrExige(0); setErreur(null) }}
                    className="btn btn-ghost btn-sm">Tout annuler</button>
            <button onClick={conclure} disabled={busy} className="btn btn-primary">
              {busy ? 'Les hérauts scellent…'
                    : (choix.length || orExige) ? 'Imposer ces termes' : 'Paix blanche'}
            </button>
          </div>
        </div>
      )}
      {erreur && !offres && <div className="p-4 text-sm text-red-300">{erreur}</div>}
    </Overlay>
  )
}
