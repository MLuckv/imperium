import { LuxeIcon } from './Icons'
import {
  RESOURCE_META,
  LUXURY_META,
  num,
  prodSuffix,
  formatTourDate,
} from '../lib/format'

// Barre supérieure : ressources de la faction joueur + tour/date + stabilité.
// Tout vient de l'API : on itère sur les clés présentes dans l'état.

const RESOURCE_ORDER = ['or', 'nourriture', 'eau', 'pierre', 'bois', 'fer', 'population']

export default function ResourceBar({ meta, joueur }) {
  const ressources = (joueur && joueur.ressources) || {}
  const production = (joueur && joueur.production) || {}
  const detail = (joueur && joueur.production_detail) || {}
  const luxe = (joueur && joueur.ressources_luxe) || {}
  const stabilite = joueur && joueur.stabilite
  const cibleStab = joueur && joueur.stabilite_cible
  const facteursStab = (joueur && joueur.stabilite_facteurs) || []
  const bassesStab = (joueur && joueur.stabilite_basses) || []
  const age = joueur && joueur.age
  const ageRestant = (joueur && joueur.age_restant) || 0
  const elan = joueur && joueur.elan
  const elanFacteurs = (joueur && joueur.elan_facteurs) || []
  const prestige = joueur && joueur.prestige
  const tourisme = (joueur && joueur.tourisme) || 0
  const corruption = (joueur && joueur.corruption) || 0
  const inflation = (joueur && joueur.inflation) || 0

  // Ordonne les ressources connues d'abord, puis toute clé supplémentaire de l'API.
  const keys = [
    ...RESOURCE_ORDER.filter((k) => k in ressources),
    ...Object.keys(ressources).filter((k) => !RESOURCE_ORDER.includes(k)),
  ]

  const luxeKeys = Object.entries(luxe).filter(([, v]) => v && v > 0)
  // Gisements de luxe EXPLOITÉS (revenus tant qu'on tient la province + le bâtiment).
  const luxesActifs = (joueur && joueur.luxes_actifs) || []
  const luxeCount = luxesActifs.reduce((m, l) => { m[l] = (m[l] || 0) + 1; return m }, {})

  return (
    <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-bronze-dark/70 bg-gradient-to-b from-[#2b2419] to-[#211b12] px-4 py-2 text-parchment shadow">
      {/* Identité joueur + date */}
      <div className="flex items-center gap-3 pr-3">
        <span
          className="inline-block h-5 w-5 rounded-sm border border-black/50"
          style={{ backgroundColor: (joueur && joueur.couleur) || '#b03a2e' }}
        />
        <div className="leading-tight">
          <div className="text-base font-semibold tracking-wide">
            {(joueur && joueur.nom) || 'Faction'}
          </div>
          <div className="text-xs text-bronze">{formatTourDate(meta)}</div>
        </div>
      </div>

      {/* Ressources de base */}
      {/* Largeur plancher : sinon le bloc Stabilité (âge, élan, corruption…) écrasait
          les ressources en une colonne verticale sur les écrans étroits. */}
      <div className="flex min-w-[22rem] flex-1 flex-wrap items-center gap-x-4 gap-y-1">
        {keys.map((key) => {
          const meta2 = RESOURCE_META[key] || { label: key, icon: '•', tint: '#caa53d' }
          const value = ressources[key]
          const prod = production[key]
          const lignes = detail[key] || []
          return (
            <div key={key} className="group relative flex items-baseline gap-1.5 whitespace-nowrap">
              <span style={{ color: meta2.tint }} className="text-sm">{meta2.icon}</span>
              <span className="hidden text-xs text-parchment/70 lg:inline">{meta2.label}</span>
              <span className="font-semibold tabular-nums" title={meta2.label}>{num(value)}</span>
              {prod != null && (
                <span className={'text-xs tabular-nums ' + (prod > 0 ? 'text-emerald-300' : prod < 0 ? 'text-red-300' : 'text-parchment/50')}>
                  {prodSuffix(prod)}
                </span>
              )}
              {/* Infobulle : ventilation des sources de production/perte */}
              <div className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-52 rounded-md border border-bronze-dark/70 bg-night p-2 text-left text-xs shadow-2xl group-hover:block">
                <div className="mb-1 font-semibold text-bronze">{meta2.label} · par tour</div>
                {lignes.length === 0 ? (
                  <div className="text-parchment/50">Aucune source.</div>
                ) : (
                  lignes.map((l, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <span className="text-parchment/70">{l.source}</span>
                      <span className={'tabular-nums ' + (l.val >= 0 ? 'text-emerald-300' : 'text-red-300')}>{l.val > 0 ? '+' : ''}{l.val}</span>
                    </div>
                  ))
                )}
                {prod != null && (
                  <div className="mt-1 flex justify-between gap-2 border-t border-bronze-dark/40 pt-1 font-semibold">
                    <span>Net</span>
                    <span className={'tabular-nums ' + (prod >= 0 ? 'text-emerald-300' : 'text-red-300')}>{prod > 0 ? '+' : ''}{num(prod)}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Luxe : stock de marbre (merveilles) + gisements exploités */}
      {(luxeKeys.length > 0 || Object.keys(luxeCount).length > 0) && (
        <div className="flex items-center gap-2 border-l border-bronze-dark/60 pl-3 text-xs text-amber-200">
          {luxeKeys.map(([k, v]) => (
            <span key={k} className="flex items-center gap-1" title={((LUXURY_META[k] && LUXURY_META[k].label) || k) + ' en réserve (merveilles)'}>
              <LuxeIcon id={k} size={13} />{(LUXURY_META[k] && LUXURY_META[k].label) || k} {num(v)}
            </span>
          ))}
          {Object.entries(luxeCount).map(([k, nb]) => (
            <span key={'g' + k} className="flex items-center gap-0.5 rounded-full border border-amber-300/40 bg-amber-300/10 px-1.5 py-0.5 text-[11px]"
                  title={`Gisement exploité : ${(LUXURY_META[k] && LUXURY_META[k].label) || k}${nb > 1 ? ` ×${nb}` : ''}`}>
              <LuxeIcon id={k} size={13} />{nb > 1 ? ` ×${nb}` : ''}
            </span>
          ))}
        </div>
      )}

      {/* Stabilité (avec cible + ventilation au survol) */}
      {stabilite != null && (
        <div className="group relative flex items-center gap-2 border-l border-bronze-dark/60 pl-3">
          <span className="text-xs text-parchment/70">Stabilité</span>
          <div className="relative h-2 w-24 overflow-hidden rounded-full bg-black/40">
            <div className="h-full rounded-full"
                 style={{ width: `${Math.max(0, Math.min(100, stabilite))}%`,
                          backgroundColor: stabilite < 25 ? '#c0392b' : stabilite < 55 ? '#caa53d' : '#27ae60' }} />
            {cibleStab != null && (
              <div className="absolute top-0 h-full w-0.5 bg-parchment/80" style={{ left: `${Math.max(0, Math.min(100, cibleStab))}%` }} title="Tendance" />
            )}
          </div>
          <span className="text-xs font-semibold tabular-nums">{num(stabilite)}</span>
          {cibleStab != null && (
            <span className="text-[10px] text-parchment/50">→ {num(cibleStab)}</span>
          )}
          {age === 'or' && <span className="ml-1 rounded px-1 text-[10px] font-semibold text-amber-300" style={{ backgroundColor: 'rgba(202,165,61,0.2)' }} title="Âge d'or : +18 % de production. Il ne dure qu'un temps.">☀ Âge d'or{ageRestant ? ` · ${ageRestant} mois` : ''}</span>}
          {age === 'sombre' && <span className="ml-1 rounded px-1 text-[10px] font-semibold text-red-300" style={{ backgroundColor: 'rgba(192,57,43,0.2)' }} title="Âge sombre : −18 % de production. Redressez le royaume pour en sortir.">☾ Âge sombre</span>}
          {elan != null && (
            <span className="group relative ml-2 cursor-help text-xs text-sky-200"
                  title="Élan de la civilisation — c'est lui qui mène aux âges d'or (94) ou sombres (58).">
              ✧ {Math.round(elan)}
              {elanFacteurs.length > 0 && (
                <span className="pointer-events-none absolute left-0 top-5 z-50 hidden w-56 rounded border border-bronze-dark bg-night p-2 text-[11px] shadow-xl group-hover:block">
                  <b className="text-sky-200">Élan {Math.round(elan)}</b>
                  <span className="mt-1 block text-parchment/60">Âge d'or à 94 · âge sombre à 58</span>
                  {elanFacteurs.map((f, i) => (
                    <span key={i} className="mt-0.5 flex justify-between gap-2">
                      <span className="text-parchment/80">{f.source}</span>
                      <span className={f.val >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                        {f.val >= 0 ? '+' : ''}{f.val}
                      </span>
                    </span>
                  ))}
                </span>
              )}
            </span>
          )}
          {prestige ? <span className="ml-2 text-xs text-amber-200" title="Prestige (merveilles)">✦ {num(prestige)}</span> : null}
          {tourisme > 0 ? <span className="ml-1 text-xs text-sky-300" title="Points de tourisme — vos merveilles attirent le monde (victoire à 1200)">🏺 {num(Math.round(tourisme))}</span> : null}
          {corruption > 0 ? <span className="ml-2 text-xs text-orange-300" title="Corruption : réduit le revenu d'or (gouverneurs, forum/agora et droit la font baisser)">☣ {num(corruption)}%</span> : null}
          {inflation > 5 ? <span className="ml-1 text-xs text-fuchsia-300" title="Inflation : l'or thésaurisé se déprécie et tout coûte plus cher — dépensez !">↗ {num(inflation)}%</span> : null}
          <div className="pointer-events-none absolute right-0 top-full z-30 mt-1 hidden w-56 rounded-md border border-bronze-dark/70 bg-night p-2 text-left text-xs shadow-2xl group-hover:block">
            <div className="mb-1 font-semibold text-bronze">Stabilité · tend vers {num(cibleStab)}</div>
            {facteursStab.length === 0 ? (
              <div className="text-parchment/50">—</div>
            ) : facteursStab.map((f, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="text-parchment/70">{f.source}</span>
                <span className={'tabular-nums ' + (f.val >= 0 ? 'text-emerald-300' : 'text-red-300')}>{f.val > 0 ? '+' : ''}{f.val}</span>
              </div>
            ))}
            {bassesStab.length > 0 && (
              <div className="mt-1 border-t border-bronze-dark/40 pt-1">
                <div className="text-[10px] font-semibold text-red-300">Provinces instables</div>
                {bassesStab.map((b, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span className="text-parchment/70">{b.nom}</span>
                    <span className="tabular-nums text-red-300">{b.stab}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-1 border-t border-bronze-dark/40 pt-1 text-[10px] text-parchment/45">Moyenne des provinces. Une province &lt; 25 risque la sécession.</div>
          </div>
        </div>
      )}
    </header>
  )
}
