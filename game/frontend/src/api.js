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

export const newGame = (joueurPays = 'rome', opts) =>
  request('/api/new-game', { method: 'POST', body: { joueur_pays: joueurPays }, ...opts })

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

export const moveUnit = (unitId, territoire, opts) =>
  request('/api/unit/move', { method: 'POST', body: { unit_id: unitId, territoire }, ...opts })

export const annexProvince = (territoire, opts) =>
  request('/api/province/annex', { method: 'POST', body: { territoire }, ...opts })

export const getSaves = (opts) => request('/api/saves', opts)

export const saveGame = (slot = 1, opts) =>
  request('/api/save', { method: 'POST', body: { slot }, ...opts })

export const loadGame = (slot = 1, opts) =>
  request('/api/load', { method: 'POST', body: { slot }, ...opts })
