import { useEffect, useState } from 'react'
import { getCatalog } from '../api'
import { factionColor, factionLabel, leaderName, num } from '../lib/format'
import { BuildingIcon, UnitIcon, FactionEmblem, UiIcon, LuxeIcon } from './Icons'

// PANNEAU DE PROVINCE — ce que le joueur voit quand il clique une province, façon
// Civ / AoH : la cité, ses bâtiments, le chantier en cours, la garnison, et les
// actions possibles. Avant, un clic ne produisait qu'un nom dans la barre du bas.

const UNIT_LABELS = {
  levee: 'Levée', infanterie_legere: 'Inf. légère', legionnaire: 'Légionnaire', hoplite: 'Hoplite',
  phalange: 'Phalange', cavalerie: 'Cavalerie', elephant: 'Éléphant', trireme: 'Trirème', mercenaire: 'Mercenaires',
  chevalier: 'Chevalier',
}

export default function ProvincePanel({ prov, state, annexable, conqueteCost, onProduction, onArmee, onAnnex, onDiplo, onClose }) {
  const [catalog, setCatalog] = useState(null)
  useEffect(() => {
    let cancel = false
    getCatalog().then((d) => !cancel && setCatalog(d)).catch(() => {})
    return () => { cancel = true }
  }, [])

  if (!prov) return null
  const pays = (state && state.pays) || {}
  const joueurId = state && state.meta && state.meta.joueur_pays
  const proprio = prov.faction ? pays[prov.faction] : null
  const mienne = prov.faction === joueurId
  const nomBat = (id) => ((catalog && catalog.batiments) || []).find((b) => b.id === id)?.nom || id
  // Merveille abritée par la province (registre + état vivant).
  const merv = prov.merveille && ((catalog && catalog.merveilles) || []).find((m) => m.id === prov.merveille.id)
  const mervEtat = merv && ((state.merveilles || {})[merv.id] || {}).etat
  const MERV_ETAT = { intacte: 'intacte', ruine: 'en ruine — à restaurer', site: 'à fouiller', en_restauration: 'restauration en cours',
                      fouille_en_cours: 'fouilles en cours', restauree: 'restaurée', fouillee: 'fouillée' }
  const BONUS = { or: 'or', nourriture: 'nourriture', eau: 'eau', stabilite: 'stabilité', recherche_pct: 'recherche', attaque_pct: 'attaque', defense_pct: 'défense' }
  const fmtBonus = ([k, v]) => (k.endsWith('_pct') ? `${v > 0 ? '+' : ''}${Math.round(v * 100)} % ${BONUS[k]}` : `${v > 0 ? '+' : ''}${v} ${BONUS[k] || k}`)

  let ville = null
  for (const p of Object.values(pays)) for (const v of p.villes || []) if (v.territoire === prov.id) ville = v
  const garnison = []
  for (const [pid, p] of Object.entries(pays))
    for (const u of p.unites || []) if (u.territoire === prov.id) garnison.push({ ...u, pid })
  const stab = mienne && proprio && proprio.prov_stab ? proprio.prov_stab[prov.id] : null
  const enGuerre = prov.faction && !mienne &&
    (((state.diplomatie || {}).guerres_actives) || []).some((g) => new Set([g.a, g.b]).has(prov.faction) && new Set([g.a, g.b]).has(joueurId))
  const couleur = prov.faction ? factionColor(prov.faction) : '#9c8f74'

  return (
    <div className="panel absolute bottom-12 left-3 z-10 w-72 !p-0">
      {/* En-tête coloré aux couleurs du maître des lieux */}
      <div className="flex items-center gap-2 rounded-t-[0.6rem] border-b border-bronze-dark/50 px-3 py-2"
           style={{ background: `linear-gradient(90deg, ${couleur}33, transparent)` }}>
        {prov.faction && <FactionEmblem faction={prov.faction} size={18} style={{ color: couleur }} />}
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm font-bold text-parchment">{prov.nom}</div>
          <div className="text-[11px]" style={{ color: couleur }}>
            {prov.faction ? factionLabel(prov.faction, proprio && proprio.nom) : 'Terre sans maître'}
            {mienne && ' · vos terres'}
            {enGuerre && <span className="ml-1 text-red-300">⚔ en guerre</span>}
          </div>
        </div>
        <button onClick={onClose} className="text-parchment/50 hover:text-parchment" title="Fermer (Échap)">✕</button>
      </div>

      <div className="space-y-2 px-3 py-2 text-xs">
        {ville ? (
          <>
            <div className="flex items-center justify-between text-parchment/85">
              <span>🏛 <b className="text-parchment">{ville.nom}</b> · {Math.round(ville.population)} hab.</span>
              {stab != null && (
                <span title="Stabilité de la province" className={stab < 30 ? 'text-red-300' : stab < 50 ? 'text-amber-300' : 'text-emerald-300'}>
                  ☼ {Math.round(stab)}
                </span>
              )}
            </div>
            {(ville.batiments || []).length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {ville.batiments.map((b, i) => (
                  <span key={b + i} className="flex items-center gap-1 rounded border border-bronze-dark/40 bg-black/25 px-1.5 py-0.5 text-[11px] text-parchment/80" title={nomBat(b)}>
                    <BuildingIcon id={b} size={12} className="text-bronze" />{nomBat(b)}
                  </span>
                ))}
                {ville.fortifications > 0 && <span className="rounded border border-bronze-dark/40 bg-black/25 px-1.5 py-0.5 text-[11px] text-parchment/80">🛡 Remparts {ville.fortifications}</span>}
              </div>
            ) : mienne && <div className="italic text-parchment/45">Aucun bâtiment : la cité stagne.</div>}
            {ville.construction && (
              <div>
                <div className="flex justify-between text-[11px] text-parchment/70">
                  <span>🏗 {nomBat(ville.construction.batiment)}</span>
                  <span>{ville.construction.duree - ville.construction.tours_restants}/{ville.construction.duree} tours</span>
                </div>
                <div className="progress mt-0.5 !h-1.5"><div className="progress-bar" style={{ width: `${Math.round(100 * (ville.construction.duree - ville.construction.tours_restants) / ville.construction.duree)}%` }} /></div>
              </div>
            )}
          </>
        ) : (
          <div className="italic text-parchment/55">Aucune cité.{mienne && ' Fondez-en une via Production.'}</div>
        )}

        {prov.gisement && (() => {
          const lx = ((catalog && catalog.luxes) || []).find((l) => l.id === prov.gisement)
          const batNom = lx ? nomBat(lx.batiment) : ''
          const exploite = mienne && proprio && (proprio.luxes_actifs || []).includes(prov.gisement) && ville && (ville.batiments || []).includes(lx && lx.batiment)
          const effet = lx ? Object.entries(lx.effet).map(([k, v]) => `+${v} ${k === 'stabilite' ? 'stabilité' : k}`).join(', ') : ''
          return (
            <div className={'rounded border px-2 py-1.5 ' + (exploite ? 'border-amber-300/40 bg-amber-300/5' : 'border-bronze-dark/40 bg-black/20')}>
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-200">
                <LuxeIcon id={prov.gisement} size={14} />{lx ? lx.nom : prov.gisement}
                <span className="ml-auto text-[10px] font-normal text-parchment/55">{exploite ? 'exploité ✓' : 'gisement'}</span>
              </div>
              <div className="mt-0.5 text-[11px] text-parchment/65">
                {effet}{lx && ` — ${exploite ? 'grâce à ' : 'il faut '}${batNom ? batNom.toLowerCase() : lx.batiment} ${exploite ? '' : ville ? 'dans la cité' : '(fondez d\'abord une cité ici)'}`}
              </div>
            </div>
          )
        })()}
        {merv && (
          <div className="rounded border border-gold/30 bg-gold/5 px-2 py-1.5">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-gold">
              <UiIcon id={merv.type === 'naturelle' ? 'nature' : 'merveille'} size={13} />
              {merv.nom}
              <span className="ml-auto text-[10px] font-normal text-parchment/55">{MERV_ETAT[mervEtat] || mervEtat || ''}</span>
            </div>
            {Object.keys(merv.bonus || {}).length > 0 && (
              <div className="mt-0.5 text-[11px] text-emerald-300/90">
                {Object.entries(merv.bonus).map(fmtBonus).join(' · ')}
                {['antique', 'naturelle'].includes(merv.type) ? ' — si vous tenez la province' : merv.type === 'ruine' && mervEtat !== 'restauree' ? ' — une fois restaurée' : ''}
              </div>
            )}
            {merv.type === 'fouille' && mervEtat === 'site' && <div className="mt-0.5 text-[11px] text-parchment/60">Des reliques dorment sous la terre : fouillez (Production).</div>}
          </div>
        )}

        <div className="text-parchment/85">
          {garnison.length === 0 ? <span className="text-parchment/50">⚔ Aucune troupe</span> : (
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-0.5">⚔</span>
              {garnison.map((u) => (
                <span key={u.id} className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]"
                      style={{ borderColor: factionColor(u.pid) + '88', color: u.pid === joueurId ? '#f3e9d2' : factionColor(u.pid) }}
                      title={u.pid === joueurId && u.a_bouge ? 'A déjà marché ce tour' : ''}>
                  <UnitIcon type={u.type} size={11} />{UNIT_LABELS[u.type] || u.type}{u.pid === joueurId && u.a_bouge ? ' ·' : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {mienne && <button onClick={onProduction} className="btn btn-ghost btn-sm"><UiIcon id="production" />Production</button>}
          {mienne && <button onClick={onArmee} className="btn btn-ghost btn-sm"><UiIcon id="armee" />Recruter</button>}
          {!prov.faction && annexable && (
            <button onClick={onAnnex} className="btn btn-primary btn-sm">Annexer ({conqueteCost} or)</button>
          )}
          {!prov.faction && !annexable && <span className="text-[11px] italic text-parchment/45">Envoyez-y une armée pour l'annexer.</span>}
          {prov.faction && !mienne && (
            <button onClick={() => onDiplo(prov.faction)} className="btn btn-ghost btn-sm"><UiIcon id="diplomatie" />Parler à {leaderName(prov.faction)}</button>
          )}
        </div>
      </div>
    </div>
  )
}
