import { useEffect, useRef, useState } from 'react'
import { getConversation, streamDiplomaticMessage } from '../api'
import { factionColor } from '../lib/format'

// Messagerie moderne (style Instagram / app de messagerie) pour le fil privé
// avec une IA. L'IA garde la mémoire du fil côté backend (cohérence).
// Bulles : joueur à droite, dirigeant à gauche. Indicateur « écrit… » pendant
// la génération (la réponse locale peut prendre ~10 s).

// Amorces : le joueur sait rarement QUOI écrire à un souverain. Un clic remplit
// le champ d'un brouillon qu'il peut retoucher avant d'envoyer.
const AMORCES = [
  { label: '🤝 Alliance', texte: 'Nos deux peuples ont tout à gagner à marcher ensemble. Je vous propose une alliance : nos ennemis seront les vôtres, et les vôtres les nôtres.' },
  { label: '⚖ Commerce', texte: 'Ouvrons nos marchés l\'un à l\'autre. Un pacte commercial enrichirait nos deux trésors sans qu\'une goutte de sang ne coule.' },
  { label: '🕊 Paix', texte: 'Cette guerre a assez duré. Je vous propose de déposer les armes et de fixer ensemble les termes d\'une paix honorable.' },
  { label: '⚠ Avertir', texte: 'Que ce soit clair : vos troupes s\'approchent de mes frontières. Reculez, ou je considérerai cela comme une déclaration de guerre.' },
  { label: '🎁 Don', texte: 'En gage d\'amitié, j\'ai fait porter cinquante pièces d\'or à votre cour. Puisse ce geste ouvrir entre nous une ère de confiance.' },
  { label: '❓ Intentions', texte: 'Parlons franchement : que pensez-vous de mon royaume, et quelles sont vos intentions à son égard ?' },
]

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
      // STREAMING : les mots du dirigeant apparaissent au fil de la génération.
      let bulleCreee = false
      await streamDiplomaticMessage(cible, contenu, (texteCumule) => {
        if (!bulleCreee) { bulleCreee = true; setTyping(false) }
        setMessages((m) => {
          const copie = [...m]
          const dernier = copie[copie.length - 1]
          if (dernier && dernier.role === 'ia' && dernier.enCours) {
            copie[copie.length - 1] = { ...dernier, texte: texteCumule }
          } else {
            copie.push({ role: 'ia', auteur: leaderName, texte: texteCumule, enCours: true })
          }
          return copie
        })
      })
      // Fin du flux : resynchronise avec le fil serveur (texte nettoyé/finalisé).
      try {
        const d = await getConversation(cible)
        if (d && Array.isArray(d.messages) && d.messages.length) setMessages(d.messages)
        else setMessages((m) => m.map((x) => (x.enCours ? { ...x, enCours: false } : x)))
      } catch {
        setMessages((m) => m.map((x) => (x.enCours ? { ...x, enCours: false } : x)))
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
          <div className="px-3 py-6 text-center">
            <p className="text-sm text-parchment/50">Aucun message. Entamez la conversation avec {leaderName}.</p>
            <p className="mt-1 text-[11px] text-parchment/40">Les souverains ont leur caractère et leur mémoire : ce que vous dites compte.</p>
          </div>
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

      {/* Amorces (toujours disponibles, discrètes une fois le fil lancé) */}
      <div className="thin-scroll flex gap-1 overflow-x-auto border-t border-bronze-dark/40 pt-2 pb-1">
        {AMORCES.map((a) => (
          <button key={a.label} type="button" onClick={() => setTexte(a.texte)} disabled={typing}
                  className="shrink-0 rounded-full border border-bronze-dark/60 px-2.5 py-0.5 text-[11px] text-parchment/70 transition hover:border-gold hover:text-gold disabled:opacity-40">
            {a.label}
          </button>
        ))}
      </div>

      {/* Saisie */}
      <form onSubmit={envoyer} className="flex items-end gap-2 pt-1">
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
