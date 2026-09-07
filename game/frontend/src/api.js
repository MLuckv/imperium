// Module API unique réutilisé partout. Toute requête au backend passe par ici.
// Base URL conforme à ARCHITECTURE.md §4/§6 (http://localhost:8000), surchargeable
// via la variable d'environnement Vite VITE_API_BASE.

export const API_BASE =
  (import.meta.env && import.meta.env.VITE_API_BASE) || 'http://localhost:8000'

// Erreur enrichie : porte le status HTTP (utile pour distinguer 404 "pas de partie"
// du vrai "backend indisponible").
export class ApiError extends Error {
  constructor(message, { status = 0, body = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body != null ? { 'Content-Type': 'application/json' } : undefined,
      body: body != null ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (err) {
    // fetch rejette uniquement sur erreur réseau (backend down, CORS, DNS...).
    if (err && err.name === 'AbortError') throw err
    throw new ApiError(
      `Backend injoignable (${API_BASE}). Vérifie qu'il tourne sur le port 8000.`,
      { status: 0 },
    )
  }

  let data = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const detail =
      (data && (data.detail || data.message)) ||
      (typeof data === 'string' ? data : '') ||
      res.statusText
    throw new ApiError(`Erreur ${res.status} : ${detail}`, {
      status: res.status,
      body: data,
    })
  }

  return data
}

// ---- Endpoints (cf. tableau ARCHITECTURE.md §4) ----

export const getHealth = (opts) => request('/api/health', opts)
export const getMap = (opts) => request('/api/map', opts)
export const getTechTree = (opts) => request('/api/tech-tree', opts)
export const getDogmeTree = (opts) => request('/api/dogme-tree', opts)
export const getCatalog = (opts) => request('/api/catalog', opts)
export const getState = (opts) => request('/api/state', opts)

export const getConversation = (cible, opts) =>
  request(`/api/diplomatie/conversation?cible=${encodeURIComponent(cible)}`, opts)

export const newGame = (joueurPays = 'rome', nbIa = null, opts) =>
  request('/api/new-game', {
    method: 'POST',
    body: nbIa == null ? { joueur_pays: joueurPays } : { joueur_pays: joueurPays, nb_ia: nbIa },
    ...opts,
  })

export const endTurn = (tours = 1, opts) =>
  request(`/api/end-turn?tours=${tours}`, { method: 'POST', ...opts })

export const postAction = (action, opts) =>
  request('/api/action', { method: 'POST', body: action, ...opts })

export const sendDiplomaticMessage = (cible, texte, opts) =>
  request('/api/diplomatie/message', {
    method: 'POST',
    body: { cible, texte },
    ...opts,
  })

export const sendConseillerMessage = (texte, opts) =>
  request('/api/conseiller/message', { method: 'POST', body: { texte }, ...opts })

// Conseiller en STREAMING : sa parole arrive au fil de l'eau ; le flux se termine par
// une ligne JSON (après le séparateur \x1e) décrivant le projet éventuellement lancé.
export async function streamConseillerMessage(texte, onChunk) {
  const res = await fetch(`${API_BASE}/api/conseiller/message/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texte }),
  })
  if (!res.ok || !res.body) throw new ApiError('Échec du flux', { status: res.status })
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let parole = ''
  let meta = null
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    const morceau = dec.decode(value, { stream: true })
    if (meta !== null) { meta += morceau; continue }
    const sep = morceau.indexOf('\x1e')
    if (sep >= 0) {
      parole += morceau.slice(0, sep)
      meta = morceau.slice(sep + 1)
    } else {
      parole += morceau
    }
    if (onChunk) onChunk(parole)
  }
  let extra = {}
  try { extra = meta ? JSON.parse(meta) : {} } catch { extra = {} }
  return { reponse: parole, ...extra }
}

// Réponse diplomatique en STREAMING : onChunk(texteCumulé) est appelé au fil des
// tokens (premiers mots en ~1-2 s). Résout avec le texte complet.
export async function streamDiplomaticMessage(cible, texte, onChunk) {
  const res = await fetch(`${API_BASE}/api/diplomatie/message/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cible, texte }),
  })
  if (!res.ok || !res.body) throw new ApiError('Échec du flux', { status: res.status })
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let plein = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    plein += dec.decode(value, { stream: true })
    if (onChunk) onChunk(plein)
  }
  return plein
}

export const moveUnit = (unitId, territoire, opts) =>
  request('/api/unit/move', { method: 'POST', body: { unit_id: unitId, territoire }, ...opts })

export const annexProvince = (territoire, opts) =>
  request('/api/province/annex', { method: 'POST', body: { territoire }, ...opts })

export const getWarOffers = (cible, opts) =>
  request(`/api/guerre/offres?cible=${encodeURIComponent(cible)}`, opts)

export const makePeace = (cible, provinces = [], orExige = 0, opts) =>
  request('/api/guerre/paix', {
    method: 'POST',
    body: { cible, provinces, or_exige: orExige },
    ...opts,
  })

export const getSaves = (opts) => request('/api/saves', opts)

export const saveGame = (slot = 1, opts) =>
  request('/api/save', { method: 'POST', body: { slot }, ...opts })

export const loadGame = (slot = 1, opts) =>
  request('/api/load', { method: 'POST', body: { slot }, ...opts })
