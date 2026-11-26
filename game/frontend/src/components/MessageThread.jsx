import { useEffect, useRef, useState } from 'react'
import { getConversation, streamDiplomaticMessage } from '../api'
import { factionColor } from '../lib/format'
import Medaillon from './Medaillon'

// Petites icônes gravées (24×24) pour les amorces et les traités.
const AMORCE_SVG = {
  alliance: <><circle cx="9" cy="12" r="5.2" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="15" cy="12" r="5.2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 7.6a5.2 5.2 0 0 1 0 8.8" fill="none" stroke="#1a130c" strokeWidth="3.4" /><path d="M12 7.6a5.2 5.2 0 0 1 0 8.8" fill="none" stroke="currentColor" strokeWidth="2" /></>,
  commerce: <><path d="M12 3v17M7 20h10M4 7h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M6 7l-3 6h6zM18 7l-3 6h6z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M3 13a3 2 0 0 0 6 0zM15 13a3 2 0 0 0 6 0z" fill="currentColor" /><circle cx="12" cy="3.5" r="1.5" fill="currentColor" /></>,
  paix: <><path d="M5 20C9 14 13 9 20 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />{[[8, 15, -30], [11, 11.5, -40], [14.5, 8, -45], [17.5, 5.5, -50], [10, 17, 50], [13, 13.5, 45], [16, 10.5, 40]].map(([x, y, a], i) => <ellipse key={i} cx={x} cy={y} rx="2.9" ry="1.2" transform={`rotate(${a} ${x} ${y})`} fill="currentColor" />)}</>,
  drapeau: <><path d="M6 21V3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M6 4c3-1.5 6 1.5 9 0s3-1 4 0v8c-1-1-2-1.5-4 0s-6-1.5-9 0z" fill="currentColor" /></>,
  avertir: <><path d="M12 2.5l2 2v10.5h-4V4.5z" fill="currentColor" /><path d="M7 15h10v1.8H7z" fill="currentColor" /><path d="M11 17h2v3.5h-2z" fill="currentColor" /><circle cx="12" cy="21.3" r="1.3" fill="currentColor" /><path d="M12 5v9" stroke="#1a130c" strokeWidth=".8" opacity=".55" /></>,
  don: <><ellipse cx="12" cy="17.5" rx="7" ry="2.4" fill="currentColor" /><path d="M5 17.5v-3c0 1.3 3.1 2.4 7 2.4s7-1.1 7-2.4v3" fill="currentColor" opacity=".75" /><ellipse cx="12" cy="14.5" rx="7" ry="2.4" fill="currentColor" /><path d="M5 14.5v-3c0 1.3 3.1 2.4 7 2.4s7-1.1 7-2.4v3" fill="currentColor" opacity=".75" /><ellipse cx="12" cy="11.5" rx="7" ry="2.4" fill="currentColor" /><ellipse cx="12" cy="11.5" rx="3.6" ry="1.1" fill="none" stroke="#1a130c" strokeWidth=".8" opacity=".5" /><path d="M16 4l1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2L13 6.3l2-.3z" fill="currentColor" /></>,
  bouclier: <><path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" fill="currentColor" /><path d="M12 5.5v13.5M7 10h10" stroke="#1a130c" strokeWidth="1.2" opacity=".5" /></>,
  flamme: <><path d="M12 22c-4.4 0-7-2.8-7-6.4 0-3.6 2.6-5.6 3.6-8.6.6 1.8 1.4 2.8 2.4 3.2-.2-3.4 1-6.4 4-8.2-.4 3.2.8 5.2 2.4 7.2 1.4 1.8 1.6 3.6 1.6 5.2 0 4-2.8 7.6-7 7.6z" fill="currentColor" /><path d="M12 21c-1.8 0-3-1.2-3-2.8 0-1.8 1.4-2.6 2-4.2.8 1.2 1.6 1.4 2.2 1.4.6 1 .8 1.6.8 2.6 0 1.6-.8 3-2 3z" fill="#1a130c" opacity=".45" /></>,
  etoile: <path d="M12 2l2.6 6.6L21.5 9l-5.3 4.5 1.7 6.9L12 16.7l-5.9 3.7 1.7-6.9L2.5 9l6.9-.4z" fill="currentColor" />,
  couronne: <><path d="M3 18l-1-10 5.5 4L12 4l4.5 8L22 8l-1 10z" fill="currentColor" /><rect x="3" y="18.6" width="18" height="2.6" rx=".6" fill="currentColor" /><circle cx="12" cy="14" r="1.6" fill="#1a130c" opacity=".5" /></>,
  marteau: <><path d="M4 7.5l5-5 3 3-5 5z" fill="currentColor" /><path d="M9.5 8l11 11-2 2-11-11z" fill="currentColor" opacity=".8" /><path d="M2 9.5l2-2 4.5 4.5-2 2z" fill="currentColor" /></>,
  intentions: <><path d="M2 12c3-5 7-7 10-7s7 2 10 7c-3 5-7 7-10 7s-7-2-10-7z" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="3.8" fill="currentColor" /><circle cx="13.3" cy="10.7" r="1.2" fill="#1a130c" opacity=".6" /></>,
}
export function IconeAmorce({ id, size = 14 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">{AMORCE_SVG[id] || AMORCE_SVG.intentions}</svg>
}

// Messagerie moderne (style Instagram / app de messagerie) pour le fil privé
// avec une IA. L'IA garde la mémoire du fil côté backend (cohérence).
// Bulles : joueur à droite, dirigeant à gauche. Indicateur « écrit… » pendant
// la génération (la réponse locale peut prendre ~10 s).

// Amorces : le joueur sait rarement QUOI écrire à un souverain. Un clic remplit
// le champ d'un brouillon qu'il peut retoucher avant d'envoyer.
const AMORCES = [
  { icone: 'alliance', label: 'Alliance', texte: 'Nos deux peuples ont tout à gagner à marcher ensemble. Je vous propose une alliance : nos ennemis seront les vôtres, et les vôtres les nôtres.' },
  { icone: 'commerce', label: 'Commerce', texte: 'Ouvrons une route commerciale entre nos royaumes : nos caravanes et nos navires enrichiraient nos deux trésors sans qu\'une goutte de sang ne coule. Acceptez-vous ?' },
  { icone: 'paix', label: 'Non-agression', texte: 'Je vous propose un pacte de non-agression : ni l\'un ni l\'autre ne portera le fer chez son voisin pendant trois ans. Le jurez-vous ?' },
  { icone: 'drapeau', label: 'Paix', texte: 'Cette guerre a assez duré. Je vous propose de déposer les armes et de fixer ensemble les termes d\'une paix honorable.' },
  { icone: 'avertir', label: 'Avertir', texte: 'Que ce soit clair : vos troupes s\'approchent de mes frontières. Reculez, ou je considérerai cela comme une déclaration de guerre.' },
  { icone: 'don', label: 'Don', texte: 'En gage d\'amitié, j\'ai fait porter cinquante pièces d\'or à votre cour. Puisse ce geste ouvrir entre nous une ère de confiance.' },
  { icone: 'intentions', label: 'Intentions', texte: 'Parlons franchement : que pensez-vous de mon royaume, et quelles sont vos intentions à son égard ?' },
]

export default function MessageThread({ cible, leaderName, joueurName, joueurId }) {
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
      <div ref={scrollRef} className="thin-scroll flex-1 space-y-3 overflow-y-auto px-1 py-3">
        {loading && <p className="text-center text-xs text-parchment/50">Chargement du fil…</p>}
        {!loading && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
            <Medaillon faction={cible} taille={64} className="opacity-70" />
            <p className="mt-4 font-display text-sm tracking-wide text-parchment/70">{leaderName} vous accorde audience.</p>
            <p className="mt-1 max-w-sm font-serif text-[13px] italic text-parchment/45">Les souverains ont leur caractère et leur mémoire : ce que vous dites compte. Choisissez une amorce ci-dessous ou écrivez librement.</p>
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.role === 'joueur'
          const suite = i > 0 && messages[i - 1].role === m.role
          return (
            <div key={i} className={'flex items-end gap-2.5 ' + (mine ? 'flex-row-reverse' : '') + (suite ? ' !mt-1' : '')}>
              <span className="w-9 shrink-0">
                {!suite && <Medaillon faction={mine ? joueurId : cible} taille={36} className="drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]" />}
              </span>
              <div className={'max-w-[78%] ' + (mine ? 'text-right' : '')}>
                {!suite && (
                  <div className={'mb-1 font-display text-[11px] font-bold tracking-wider ' + (mine ? 'pr-1 text-gold/80' : 'pl-1')}
                       style={mine ? undefined : { color: accent, filter: 'brightness(1.55) saturate(.8)' }}>
                    {mine ? (joueurName || 'Vous') : (m.auteur || leaderName)}
                  </div>
                )}
                <div className={'bulle ' + (mine ? 'bulle-joueur' : 'bulle-souverain') + (m.enCours ? ' bulle-encours' : '')}>
                  {m.texte}
                </div>
              </div>
            </div>
          )
        })}
        {typing && (
          <div className="flex items-end gap-2.5">
            <span className="w-9 shrink-0"><Medaillon faction={cible} taille={36} /></span>
            <div className="bulle bulle-souverain !py-1.5">
              <span className="typing-dots font-serif italic text-ink/60">{leaderName} prend la plume</span>
            </div>
          </div>
        )}
      </div>

      {erreur && <p className="px-2 pb-1 text-xs text-red-300">{erreur}</p>}

      {/* Amorces (toujours disponibles, discrètes une fois le fil lancé) */}
      <div className="thin-scroll flex gap-1.5 overflow-x-auto border-t border-bronze-dark/40 pt-2.5 pb-1.5">
        {AMORCES.map((a) => (
          <button key={a.label} type="button" onClick={() => setTexte(a.texte)} disabled={typing} className="amorce">
            <IconeAmorce id={a.icone} size={13} />{a.label}
          </button>
        ))}
      </div>

      {/* Saisie */}
      <form onSubmit={envoyer} className="saisie-audience">
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
          placeholder={`Votre message à ${leaderName}…`}
          className="thin-scroll max-h-24 flex-1 resize-none bg-transparent px-3 py-2 font-serif text-[15px] text-ink placeholder:italic placeholder:text-ink/45 focus:outline-none"
        />
        <button type="submit" disabled={typing || !texte.trim()} className="btn-fin-tour !rounded-md !px-4 !py-2 !text-[12px] disabled:cursor-not-allowed disabled:opacity-50">
          {typing ? '…' : 'Envoyer'}
        </button>
      </form>
    </div>
  )
}
