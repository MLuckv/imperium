import { useState, useRef, useEffect } from 'react'
import { sendConseillerMessage } from '../api'
import { num } from '../lib/format'
import { Overlay } from './ProductionModal'

// Conseiller du joueur : chat IA (état du royaume, conseils) + DIRECTIVES libres
// (espionnage, garnison secrète…) qui deviennent des « projets » sur la carte.

const CONSEILLERS = {
  rome: 'Cassius, conseiller romain', macedoine: 'Cleitos, Compagnon du roi',
  sparte: "l'Éphore de Sparte", carthage: 'Manéthon, vizir d\'Égypte',
}
const TYPE_ICON = { espionnage: '🕵', garnison: '🛡', sabotage: '🔥', commerce: '⚖', autre: '✦' }
const STATUT = { en_cours: 'En cours', actif: 'Opérationnel ✓', termine: 'Terminé' }

export default function ConseillerModal({ state, onClose, onStateChange }) {
  const joueurId = state && state.meta && state.meta.joueur_pays
  const joueur = (state && state.pays && state.pays[joueurId]) || {}
  const nomConseiller = CONSEILLERS[joueurId] || 'Votre conseiller'
  const [msgs, setMsgs] = useState([
    { role: 'ia', texte: `Je suis ${nomConseiller}. À vos ordres — demandez un état des lieux, un conseil, ou donnez-moi une directive (espions, garnison secrète, sabotage…).` },
  ])
  const [texte, setTexte] = useState('')
  const [busy, setBusy] = useState(false)
  const [projets, setProjets] = useState(joueur.projets || [])
  const scrollRef = useRef(null)

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [msgs, busy])

  async function envoyer() {
    const t = texte.trim()
    if (!t || busy) return
    setMsgs((m) => [...m, { role: 'joueur', texte: t }]); setTexte(''); setBusy(true)
    try {
      const r = await sendConseillerMessage(t)
      setMsgs((m) => [...m, { role: 'ia', texte: r.reponse || '…', projet: r.projet }])
      if (r.projets) setProjets(r.projets)
      if (r.state) onStateChange(r.state)
    } catch (e) {
      setMsgs((m) => [...m, { role: 'ia', texte: 'Pardonnez-moi, mon souverain, le message s\'est perdu.' }])
    } finally { setBusy(false) }
  }

  const or = (joueur.ressources && joueur.ressources.or) || 0

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between border-b border-bronze-dark/60 px-4 py-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-wide text-gold">Conseiller</h2>
          <div className="text-xs text-bronze">{nomConseiller}</div>
        </div>
        <div className="flex items-center gap-3 text-xs text-parchment/70">
          <span>Trésor <b className="text-gold">{num(or)}</b> or</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Fermer</button>
        </div>
      </div>

      <div className="flex max-h-[72vh] min-h-[50vh] flex-col sm:flex-row">
        {/* Chat */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={scrollRef} className="thin-scroll flex-1 space-y-2 overflow-y-auto p-3">
            {msgs.map((m, i) => (
              <div key={i} className={'flex ' + (m.role === 'joueur' ? 'justify-end' : 'justify-start')}>
                <div className={'max-w-[85%] rounded-lg px-3 py-2 text-sm ' +
                  (m.role === 'joueur' ? 'bg-bronze-dark/40 text-parchment' : 'bg-black/30 text-parchment/90 border border-bronze-dark/40')}>
                  {m.texte}
                  {m.projet && (
                    <div className="mt-1.5 rounded border border-gold/40 bg-gold/10 px-2 py-1 text-[11px] text-gold">
                      ✦ Projet lancé : {m.projet.nom} — {m.projet.cout_or} or · {m.projet.duree} tours
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && <div className="text-xs italic text-parchment/50">Le conseiller réfléchit…</div>}
          </div>
          <div className="flex gap-2 border-t border-bronze-dark/60 p-3">
            <input value={texte} onChange={(e) => setTexte(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter') envoyer() }}
                   placeholder="Un ordre, une question, un rapport…" disabled={busy}
                   className="flex-1 rounded border border-bronze-dark/60 bg-night px-3 py-2 text-sm text-parchment placeholder:text-parchment/40" />
            <button onClick={envoyer} disabled={busy || !texte.trim()} className="btn btn-primary btn-sm">Envoyer</button>
          </div>
        </div>

        {/* Projets en cours */}
        <div className="w-full shrink-0 border-t border-bronze-dark/60 bg-black/20 p-3 sm:w-56 sm:border-l sm:border-t-0">
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-bronze/80">Projets secrets</h3>
          {projets.length === 0 ? (
            <div className="text-xs text-parchment/50">Aucun projet en cours. Donnez un ordre au conseiller.</div>
          ) : projets.map((p) => (
            <div key={p.id} className="mb-2 rounded border border-bronze-dark/40 bg-night/40 p-2">
              <div className="text-sm font-semibold text-parchment">{TYPE_ICON[p.type] || '✦'} {p.nom}</div>
              <div className="mt-0.5 text-[11px] text-parchment/60">
                {STATUT[p.statut] || p.statut}
                {p.statut === 'en_cours' && ` · ${p.tours_restants}/${p.duree} tours`}
                {p.cible_faction && ` · cible : ${p.cible_faction}`}
              </div>
              {p.rapport && <div className="mt-0.5 text-[11px] italic text-bronze/80">{p.rapport}</div>}
            </div>
          ))}
        </div>
      </div>
    </Overlay>
  )
}
