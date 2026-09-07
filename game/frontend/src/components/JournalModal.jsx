import { useMemo, useState } from 'react'
import { Overlay } from './ProductionModal'

// JOURNAL DU RÈGNE — mémoire consultable de la partie. Le moteur consigne à chaque
// tour les faits marquants, et une fois l'an la chronique rédigée : ici le joueur
// peut relire tout ce qui s'est passé au lieu de le voir disparaître.

const FILTRES = [
  { id: 'tout', label: 'Tout' },
  { id: 'chroniques', label: 'Chroniques' },
  { id: 'guerre', label: 'Guerre', mots: ['⚔', 'guerre', 'bataille', 'annexe', 'assiège', 'barbare', 'écrase', 'repousse'] },
  { id: 'crises', label: 'Crises', mots: ['séisme', 'incendie', 'éruption', 'émeute', 'révolte', 'peste', 'famine', 'rébellion', 'dévaste'] },
  { id: 'diplo', label: 'Diplomatie', mots: ['✉', 'paix', 'traité', 'alliance', 'coalition', 'accord', 'ambassade'] },
]

export default function JournalModal({ state, onClose }) {
  const [filtre, setFiltre] = useState('tout')
  const [recherche, setRecherche] = useState('')
  const journal = (state && state.journal) || []

  const entrees = useMemo(() => {
    const f = FILTRES.find((x) => x.id === filtre)
    const q = recherche.trim().toLowerCase()
    const sortie = []
    // Ordre anti-chronologique : le plus récent en tête, comme un fil d'actualité.
    for (let i = journal.length - 1; i >= 0; i--) {
      const e = journal[i]
      if (e.chronique) {
        if (filtre !== 'tout' && filtre !== 'chroniques') continue
        if (q && !e.chronique.toLowerCase().includes(q)) continue
        sortie.push({ ...e, i })
      } else {
        if (filtre === 'chroniques') continue
        let faits = e.faits || []
        if (f && f.mots) faits = faits.filter((t) => f.mots.some((m) => t.toLowerCase().includes(m)))
        if (q) faits = faits.filter((t) => t.toLowerCase().includes(q))
        if (faits.length) sortie.push({ ...e, faits, i })
      }
    }
    return sortie
  }, [journal, filtre, recherche])

  const nbChroniques = journal.filter((e) => e.chronique).length

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between border-b border-bronze-dark/60 px-4 py-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-wide text-gold">Journal du règne</h2>
          <div className="text-xs text-bronze">
            {journal.length} entrée{journal.length > 1 ? 's' : ''}
            {nbChroniques > 0 && ` · ${nbChroniques} chronique${nbChroniques > 1 ? 's' : ''} annuelle${nbChroniques > 1 ? 's' : ''}`}
          </div>
        </div>
        <button onClick={onClose} className="btn btn-ghost btn-sm">Fermer</button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-bronze-dark/40 px-4 py-2">
        {FILTRES.map((f) => (
          <button key={f.id} onClick={() => setFiltre(f.id)}
                  className={'rounded-full border px-2.5 py-0.5 text-[11px] transition ' +
                    (filtre === f.id ? 'border-gold bg-gold/15 text-gold'
                                     : 'border-bronze-dark/60 text-parchment/60 hover:border-bronze')}>
            {f.label}
          </button>
        ))}
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
               placeholder="Rechercher un nom, un lieu…"
               className="ml-auto w-44 rounded border border-bronze-dark/60 bg-night px-2 py-1 text-xs text-parchment placeholder:text-parchment/40" />
      </div>

      <div className="thin-scroll max-h-[64vh] min-h-[40vh] space-y-3 overflow-y-auto p-4">
        {entrees.length === 0 ? (
          <p className="py-10 text-center text-sm italic text-parchment/50">
            {journal.length === 0 ? 'Votre règne commence : rien à consigner encore.' : 'Rien ne correspond à ce filtre.'}
          </p>
        ) : entrees.map((e) => (
          <div key={e.i} className="border-l-2 border-bronze-dark/60 pl-3">
            <div className="text-[11px] uppercase tracking-widest text-bronze/80">
              Tour {e.tour} · {e.date}
            </div>
            {e.chronique ? (
              <p className="mt-1 whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-gold/90">{e.chronique}</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-sm text-parchment/85">
                {e.faits.map((t, k) => <li key={k}>• {t}</li>)}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Overlay>
  )
}
