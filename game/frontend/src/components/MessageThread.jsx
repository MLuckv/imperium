import { useEffect, useRef, useState } from 'react'
import { getConversation, sendDiplomaticMessage } from '../api'
import { factionColor } from '../lib/format'

// Messagerie moderne (style Instagram / app de messagerie) pour le fil privé
// avec une IA. L'IA garde la mémoire du fil côté backend (cohérence).
// Bulles : joueur à droite, dirigeant à gauche. Indicateur « écrit… » pendant
// la génération (la réponse locale peut prendre ~10 s).

export default function MessageThread({ cible, leaderName, joueurName }) {
  const [messages, setMessages] = useState([])
  const [texte, setTexte] = useState('')
  const [typing, setTyping] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef(null)
  const accent = factionColor(cible)

  // (Re)charge le fil quand la cible change.
  useEffect(() => {
    let cancel = false
    setLoading(true)
    getConversation(cible)
      .then((d) => {
        if (!cancel) setMessages(d.messages || [])
      })
      .catch(() => {
        if (!cancel) setMessages([])
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [cible])

  // Auto-scroll en bas à chaque nouveau message / état de frappe.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, typing])

  async function envoyer(e) {
    e.preventDefault()
    const contenu = texte.trim()
    if (!contenu || typing) return
    setErreur(null)
    setTexte('')
    // Ajout optimiste du message joueur.
    setMessages((m) => [
      ...m,
      { role: 'joueur', auteur: joueurName, texte: contenu, optimiste: true },
    ])
    setTyping(true)
    try {
      const r = await sendDiplomaticMessage(cible, contenu)
      // Le backend renvoie tout le fil à jour : on l'utilise comme source de vérité.
      if (r && Array.isArray(r.conversation)) {
        setMessages(r.conversation)
      } else if (r) {
        setMessages((m) => [...m, { role: 'ia', auteur: r.auteur, texte: r.reponse }])
      }
    } catch (err) {
      setErreur(err.message || 'Échec de l’envoi')
    } finally {
      setTyping(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Fil */}
      <div ref={scrollRef} className="thin-scroll flex-1 space-y-2 overflow-y-auto px-1 py-2">
        {loading && <p className="text-center text-xs text-parchment/50">Chargement du fil…</p>}
        {!loading && messages.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-parchment/50">
            Aucun message. Entamez la conversation avec {leaderName}.
          </p>
        )}
        {messages.map((m, i) => {
          const mine = m.role === 'joueur'
          return (
            <div key={i} className={'flex ' + (mine ? 'justify-end' : 'justify-start')}>
              <div className={'max-w-[80%] ' + (mine ? 'items-end' : 'items-start')}>
                {!mine && (
                  <div className="mb-0.5 pl-1 text-[10px] font-semibold" style={{ color: accent }}>
                    {m.auteur || leaderName}
                  </div>
                )}
                <div
                  className={
                    'whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow ' +
                    (mine
                      ? 'rounded-br-sm bg-bronze text-ink'
                      : 'rounded-bl-sm bg-[#2c2519] text-parchment')
                  }
                >
                  {m.texte}
                </div>
              </div>
            </div>
          )
        })}
        {typing && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-[#2c2519] px-3 py-2">
              <span className="typing-dots text-parchment/70">{leaderName} écrit</span>
            </div>
          </div>
        )}
      </div>

      {erreur && <p className="px-2 pb-1 text-xs text-red-300">{erreur}</p>}

      {/* Saisie */}
      <form onSubmit={envoyer} className="flex items-end gap-2 border-t border-bronze-dark/40 pt-2">
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              envoyer(e)
            }
          }}
          rows={1}
          placeholder={`Écrire à ${leaderName}…`}
          className="thin-scroll max-h-24 flex-1 resize-none rounded-2xl border border-bronze-dark/60 bg-parchment px-3 py-2 text-sm text-ink placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-bronze"
        />
        <button
          type="submit"
          disabled={typing || !texte.trim()}
          className="shrink-0 rounded-full bg-bronze px-4 py-2 text-sm font-semibold text-ink shadow disabled:cursor-not-allowed disabled:opacity-50 hover:bg-bronze-dark hover:text-parchment"
        >
          {typing ? '…' : 'Envoyer'}
        </button>
      </form>
    </div>
  )
}
