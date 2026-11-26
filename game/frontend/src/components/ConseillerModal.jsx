import { useState, useRef, useEffect } from 'react'
import { streamConseillerMessage, getState } from '../api'
import { num, factionLabel } from '../lib/format'
import { IconeAmorce } from './MessageThread'
import Camee from './Camee'

// Conseiller du joueur : chat IA (état du royaume, conseils) + DIRECTIVES libres
// (espionnage, garnison secrète…) qui deviennent des « projets » sur la carte.
// Présentation façon Civilization : camée du conseiller et dossiers secrets à
// gauche, entretien à droite.

const CONSEILLERS = {
  rome: ['Cassius', 'Sénateur et conseiller de César'], macedoine: ['Cleitos le Noir', 'Compagnon du roi'],
  sparte: ["L'Éphore", 'Magistrat de Sparte'], carthage: ['Manéthon', "Vizir d'Égypte"],
  francs: ['Frère Ambroise', 'Confesseur de la Pucelle'], bretons: ['Merlin', 'Enchanteur et conseiller du roi'],
}
const TYPE_ICON = { espionnage: 'intentions', garnison: 'bouclier', sabotage: 'flamme', commerce: 'commerce', autre: 'etoile' }
const STATUT = { en_cours: 'En préparation', actif: 'Opérationnel', termine: 'Terminé' }
const QUESTIONS = [
  { icone: 'couronne', label: 'État du royaume', texte: 'Faites-moi un état des lieux du royaume : trésor, armées, et ce qui doit m’inquiéter.' },
  { icone: 'marteau', label: 'Que bâtir ?', texte: 'Que devrais-je construire ou rechercher en priorité, et pourquoi ?' },
  { icone: 'avertir', label: 'Menaces', texte: 'Quels voisins représentent une menace, et comment m’en prémunir ?' },
  { icone: 'intentions', label: 'Espionner', texte: 'Envoyez des espions chez notre rival le plus dangereux.' },
  { icone: 'bouclier', label: 'Garnison secrète', texte: 'Postez une garnison secrète dans notre province frontalière la plus exposée.' },
]

export default function ConseillerModal({ state, onClose, onStateChange }) {
  const joueurId = state && state.meta && state.meta.joueur_pays
  const joueur = (state && state.pays && state.pays[joueurId]) || {}
  const [nom, role] = CONSEILLERS[joueurId] || ['Votre conseiller', 'Conseiller du trône']
  const [msgs, setMsgs] = useState([
    { role: 'ia', texte: `Je suis ${nom}. À vos ordres — demandez un état des lieux, un conseil, ou donnez-moi une directive : espions, garnison secrète, sabotage…` },
  ])
  const [texte, setTexte] = useState('')
  const [busy, setBusy] = useState(false)
  const [projets, setProjets] = useState(joueur.projets || [])
  const scrollRef = useRef(null)

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [msgs, busy])

  async function envoyer(contenu) {
    const t = (contenu != null ? contenu : texte).trim()
    if (!t || busy) return
    setMsgs((m) => [...m, { role: 'joueur', texte: t }]); setTexte(''); setBusy(true)
    try {
      // STREAMING : la parole du conseiller s'affiche au fil de sa réflexion.
      let bulleCreee = false
      const r = await streamConseillerMessage(t, (parole) => {
        if (!bulleCreee) { bulleCreee = true; setBusy(false) }
        setMsgs((m) => {
          const copie = [...m]
          const dernier = copie[copie.length - 1]
          if (dernier && dernier.role === 'ia' && dernier.enCours) {
            copie[copie.length - 1] = { ...dernier, texte: parole }
          } else {
            copie.push({ role: 'ia', texte: parole, enCours: true })
          }
          return copie
        })
      })
      setMsgs((m) => m.map((x) => (x.enCours ? { ...x, texte: r.texte || x.texte, enCours: false, projet: r.projet } : x)))
      if (r.projets) setProjets(r.projets)
      // Le projet a pu modifier le trésor : on rafraîchit l'état.
      try {
        const s = await getState()
        if (s && s.pays) onStateChange(s)
      } catch { /* le prochain tour resynchronisera */ }
    } catch (e) {
      setMsgs((m) => [...m.filter((x) => !x.enCours), { role: 'ia', texte: 'Pardonnez-moi, mon souverain, le message s\'est perdu.' }])
    } finally { setBusy(false) }
  }

  const or = (joueur.ressources && joueur.ressources.or) || 0

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div className="fenetre grid h-[82vh] w-full max-w-5xl grid-cols-[260px_1fr] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* ---- Le conseiller et ses dossiers */}
        <aside className="audience-portrait flex min-h-0 flex-col" style={{ '--c': '#7a4a1e' }}>
          <div className="flex flex-col items-center px-5 pt-6 text-center">
            <div className="audience-aureole"><Camee faction={joueurId} taille={128} className="drop-shadow-[0_8px_14px_rgba(0,0,0,0.7)]" /></div>
            <div className="mt-3 font-display text-xl font-bold tracking-wide text-parchment">{nom}</div>
            <div className="mt-0.5 font-serif text-[13px] italic text-parchment/65">{role}</div>
            <div className="mt-2 pastille-stat text-[11px]">Trésor <b className="text-gold">{num(or)}</b> or</div>
          </div>
          <div className="mx-5 mt-5 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-parchment/50">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-bronze/50" />Dossiers secrets<span className="h-px flex-1 bg-gradient-to-l from-transparent to-bronze/50" />
          </div>
          <div className="thin-scroll mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
            {projets.length === 0 ? (
              <p className="px-1 text-center font-serif text-[13px] italic text-parchment/45">Aucune opération en cours. Donnez un ordre à {nom}.</p>
            ) : projets.map((p) => (
              <div key={p.id} className="dossier">
                <span className="hud-ico !h-7 !w-7 shrink-0"><IconeAmorce id={TYPE_ICON[p.type] || 'etoile'} size={14} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold leading-tight text-parchment">{p.nom}</div>
                  <div className="mt-0.5 text-[11px] text-parchment/55">
                    <span className={p.statut === 'actif' ? 'text-emerald-300' : p.statut === 'termine' ? 'text-parchment/45' : 'text-amber-200'}>{STATUT[p.statut] || p.statut}</span>
                    {p.cible_faction && ` · ${factionLabel(p.cible_faction)}`}
                  </div>
                  {p.statut === 'en_cours' && p.duree > 0 && (
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/40">
                      <div className="h-full rounded-full bg-gradient-to-r from-bronze to-gold" style={{ width: `${100 * (1 - (p.tours_restants || 0) / p.duree)}%` }} />
                    </div>
                  )}
                  {p.rapport && <div className="mt-1 font-serif text-[12px] italic leading-snug text-bronze/90">{p.rapport}</div>}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* ---- L'entretien */}
        <section className="flex min-h-0 flex-col">
          <div className="flex items-end gap-1 border-b border-bronze-dark/50 px-4 pt-3">
            <span className="onglet-civ onglet-civ-actif">Entretien privé</span>
            <span className="flex-1" />
            <button onClick={onClose} className="btn btn-ghost btn-sm mb-2">Fermer</button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-1">
            <div ref={scrollRef} className="thin-scroll flex-1 space-y-3 overflow-y-auto px-1 py-3">
              {msgs.map((m, i) => {
                const mine = m.role === 'joueur'
                return (
                  <div key={i} className={'flex items-end gap-2.5 ' + (mine ? 'flex-row-reverse' : '')}>
                    {!mine && <Camee faction={joueurId} taille={30} className="shrink-0" />}
                    <div className={'max-w-[80%] ' + (mine ? 'text-right' : '')}>
                      <div className={'bulle ' + (mine ? 'bulle-joueur' : 'bulle-souverain') + (m.enCours ? ' bulle-encours' : '')}>
                        {m.texte}
                        {m.projet && (
                          <div className="mt-2 flex items-center gap-2 rounded border border-[#8a6420]/50 bg-[#8a6420]/12 px-2 py-1 font-sans text-[11px] font-semibold text-[#6e4b14]">
                            <IconeAmorce id={TYPE_ICON[m.projet.type] || 'etoile'} size={12} />
                            Opération lancée : {m.projet.nom} — {m.projet.cout_or} or · {m.projet.duree} tours
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {busy && (
                <div className="flex items-end gap-2.5">
                  <Camee faction={joueurId} taille={30} className="shrink-0" />
                  <div className="bulle bulle-souverain !py-1.5"><span className="typing-dots font-serif italic text-ink/60">{nom} réfléchit</span></div>
                </div>
              )}
            </div>
            <div className="thin-scroll flex gap-1.5 overflow-x-auto border-t border-bronze-dark/40 pt-2.5 pb-1.5">
              {QUESTIONS.map((q) => (
                <button key={q.label} type="button" onClick={() => envoyer(q.texte)} disabled={busy} className="amorce">
                  <IconeAmorce id={q.icone} size={13} />{q.label}
                </button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); envoyer() }} className="saisie-audience">
              <input value={texte} onChange={(e) => setTexte(e.target.value)} disabled={busy}
                     placeholder="Un ordre, une question, un rapport…"
                     className="flex-1 bg-transparent px-3 py-2 font-serif text-[15px] text-ink placeholder:italic placeholder:text-ink/45 focus:outline-none" />
              <button type="submit" disabled={busy || !texte.trim()} className="btn-fin-tour !rounded-md !px-4 !py-2 !text-[12px] disabled:cursor-not-allowed disabled:opacity-50">Envoyer</button>
            </form>
          </div>
        </section>
      </div>
    </div>
  )
}
