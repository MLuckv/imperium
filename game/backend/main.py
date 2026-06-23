"""Point d'entrée FastAPI — contrat API REST ARCHITECTURE §4.

Lancement :  uvicorn main:app --reload --port 8000   (depuis game/backend, venv)

Toutes les réponses sont JSON. CORS ouvert pour http://localhost:5173 (Vite).
Les erreurs renvoient un JSON propre (pas de 500 brut). /api/state -> 404 si
aucune partie en cours. Ollama n'est jamais bloquant (dégradation gracieuse).
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# S'assure que le dossier backend/ est sur sys.path (lancement `uvicorn main:app`
# depuis game/backend, ou import en tant que package). Imports top-level partout.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import game_engine            # noqa: E402
import world_state as ws      # noqa: E402
import ai_director            # noqa: E402
import realism_validator      # noqa: E402
import tech_tree              # noqa: E402
import conversations          # noqa: E402
import merveilles             # noqa: E402
from models.city import CATALOGUE_BATIMENTS  # noqa: E402
from models.unit import COUTS_UNITES, FORCES_UNITES, TECH_REQUISE_UNITE, COUT_POP_UNITES, COUT_RES_UNITES  # noqa: E402

RACINE = Path(__file__).resolve().parent.parent
CHEMIN_TERRITOIRES = RACINE / "data" / "map" / "territories.json"
CHEMIN_TECH = RACINE / "data" / "tech_tree.json"
CHEMIN_DOGMES = RACINE / "data" / "dogmes.json"

app = FastAPI(title="Civ-History Backend", version="2.0")


@app.on_event("startup")
def _warmup_ia():
    """Précharge le modèle Ollama en arrière-plan (réponses rapides ensuite)."""
    import threading
    threading.Thread(target=ai_director.warmup, daemon=True).start()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================================
#  Gestion d'erreurs : JSON propre, jamais de 500 brut
# =====================================================================
@app.exception_handler(Exception)
async def _handler_global(request, exc):
    return JSONResponse(status_code=500,
                        content={"erreur": "erreur_interne", "detail": str(exc)})


@app.exception_handler(HTTPException)
async def _handler_http(request, exc):
    return JSONResponse(status_code=exc.status_code,
                        content={"erreur": "requete_invalide", "detail": exc.detail})


# =====================================================================
#  Modèles de requête (Pydantic v2)
# =====================================================================
class NewGameReq(BaseModel):
    joueur_pays: str = "rome"


class ActionReq(BaseModel):
    type: str = "texte_libre"
    cible: str | None = None
    texte: str | None = None
    params: dict | None = None


class MessageReq(BaseModel):
    cible: str
    texte: str


class MoveReq(BaseModel):
    unit_id: str
    territoire: str


class AnnexReq(BaseModel):
    territoire: str


class SlotReq(BaseModel):
    slot: int = 1


# =====================================================================
#  Routes
# =====================================================================
@app.get("/api/health")
def health():
    """{ok, ollama, modele, modele_pret}. Ne bloque jamais le démarrage."""
    statut = ai_director.statut_ollama()
    return {
        "ok": True,
        "ollama": statut["ollama"],
        "modele": statut["modele"],
        "modele_pret": statut["modele_pret"],
    }


@app.get("/api/map")
def get_map():
    """Contenu de territories.json (monde + territoires, couleurs résolues)."""
    try:
        data = json.loads(CHEMIN_TERRITOIRES.read_text(encoding="utf-8"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Carte introuvable : {e}")
    # Résout la couleur de faction sur chaque territoire (pratique pour le front).
    couleurs = {
        "rome": "#b03a2e", "carthage": "#c9a227", "macedoine": "#1e8449",
        "sparte": "#2e6da4", None: "#7f8c8d", "neutre": "#7f8c8d",
    }
    for t in data.get("territoires", []):
        t["couleur"] = couleurs.get(t.get("faction"), "#7f8c8d")
    # Marque les provinces qui abritent une merveille (pour le repère sur la carte).
    prov_merv = {w["province"]: {"id": wid, "nom": w["nom"], "type": w["type"]}
                 for wid, w in merveilles.MERVEILLES.items() if w.get("province")}
    for t in data.get("territoires", []):
        if t["id"] in prov_merv:
            t["merveille"] = prov_merv[t["id"]]
    return data


@app.get("/api/tech-tree")
def get_tech_tree():
    """Contenu de tech_tree.json."""
    try:
        return json.loads(CHEMIN_TECH.read_text(encoding="utf-8"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Arbre techno introuvable : {e}")


@app.get("/api/dogme-tree")
def get_dogme_tree():
    """Contenu de dogmes.json (arbre de dogmes)."""
    try:
        return json.loads(CHEMIN_DOGMES.read_text(encoding="utf-8"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dogmes introuvables : {e}")


@app.get("/api/state")
def get_state():
    """GameState courant. 404 si aucune partie en cours."""
    state = ws.charger_etat_courant()
    if state is None:
        raise HTTPException(status_code=404, detail="Aucune partie en cours.")
    return state


@app.post("/api/new-game")
def new_game(req: NewGameReq):
    """Crée une nouvelle partie et retourne le GameState initial."""
    state = game_engine.new_game(req.joueur_pays)
    return state


@app.post("/api/end-turn")
def end_turn(tours: int = 1):
    """Avance de `tours` tours (1 mois chacun ; ex. 3 = un trimestre, 12 = une année).
    Cumule les événements/messages de tous les tours. {state, evenements, messages_diplomatiques}."""
    state = ws.charger_etat_courant()
    if state is None:
        raise HTTPException(status_code=404, detail="Aucune partie en cours.")
    n = max(1, min(12, tours))
    evenements, messages, res = [], [], None
    for _ in range(n):
        res = game_engine.end_turn(state)
        evenements.extend(res.get("evenements", []))
        messages.extend(res.get("messages_diplomatiques", []))
        state = res.get("state", state)
    if res is not None:
        res["evenements"] = evenements
        res["messages_diplomatiques"] = messages
    return res


@app.post("/api/action")
def action(req: ActionReq):
    """Valide puis applique une action. {valide, raison, suggestion, state}."""
    state = ws.charger_etat_courant()
    if state is None:
        raise HTTPException(status_code=404, detail="Aucune partie en cours.")
    joueur_id = state.get("meta", {}).get("joueur_pays")
    pays = state.get("pays", {}).get(joueur_id, {})

    action_dict = {
        "type": req.type, "cible": req.cible,
        "texte": req.texte or "", "params": req.params or {},
    }
    verdict = realism_validator.valider_action(action_dict, pays, state)

    if not verdict.get("valide"):
        return {"valide": False, "raison": verdict.get("raison", ""),
                "suggestion": verdict.get("suggestion", ""), "state": state}

    resultat = game_engine.appliquer_action(state, action_dict)
    state.setdefault("historique_actions", []).append({
        "tour": state.get("meta", {}).get("tour"), "acteur": joueur_id,
        "texte": resultat.get("texte", ""), "resultat": resultat.get("resultat", ""),
    })
    game_engine._recalculer_puissances(state)
    ws.sauver_etat_courant(state)

    # Message principal : le résultat concret de l'action (chantier lancé, etc.).
    message = resultat.get("texte") or verdict.get("raison", "")
    detail = resultat.get("resultat", "")
    return {"valide": True,
            "raison": (f"{message} {detail}".strip() if detail else message),
            "suggestion": verdict.get("suggestion", ""),
            "texte": resultat.get("texte", ""), "resultat": detail, "state": state}


@app.post("/api/unit/move")
def unit_move(req: MoveReq):
    """Déplace une unité du joueur vers une région adjacente. {ok, raison, state}."""
    state = ws.charger_etat_courant()
    if state is None:
        raise HTTPException(status_code=404, detail="Aucune partie en cours.")
    res = game_engine.deplacer_unite(state, req.unit_id, req.territoire)
    if res.get("ok"):
        game_engine._recalculer_puissances(state)
        ws.sauver_etat_courant(state)
    return {"ok": res.get("ok", False), "raison": res.get("raison", ""), "state": state}


@app.post("/api/province/annex")
def province_annex(req: AnnexReq):
    """Annexe une province neutre occupée par une armée du joueur. {ok, raison, state}."""
    state = ws.charger_etat_courant()
    if state is None:
        raise HTTPException(status_code=404, detail="Aucune partie en cours.")
    res = game_engine.annexer_province(state, req.territoire)
    if res.get("ok"):
        game_engine._recalculer_puissances(state)
        ws.sauver_etat_courant(state)
    return {"ok": res.get("ok", False), "raison": res.get("raison", ""), "state": state}


@app.post("/api/diplomatie/message")
def diplomatie_message(req: MessageReq):
    """Réponse diplomatique d'un dirigeant IA, avec mémoire de la conversation.

    L'IA reçoit l'historique COMPLET du fil pour rester cohérente. Le message du
    joueur et la réponse sont ajoutés au fil (état + fichier JSON par IA).
    Retourne {reponse, auteur, source, conversation}.
    """
    state = ws.charger_etat_courant()
    if state is None:
        raise HTTPException(status_code=404, detail="Aucune partie en cours.")

    etat_monde = ws.lire_world_state_courant(state)
    date_jeu = state.get("meta", {}).get("date_jeu", "264-03")
    pays_joueur = state.get("meta", {}).get("joueur_pays", "rome")
    tour = state.get("meta", {}).get("tour")

    # Ajoute le message du joueur AVANT de répondre, puis passe tout le fil à l'IA.
    conversations.ajouter_message(
        state, req.cible, role="joueur",
        auteur=state.get("pays", {}).get(pays_joueur, {}).get("nom", pays_joueur),
        texte=req.texte, tour=tour)
    historique = conversations.historique_pour_prompt(state, req.cible)

    res = ai_director.reponse_diplomatique(
        req.cible, req.texte, etat_monde=etat_monde,
        historique=historique, date_jeu=date_jeu, pays_joueur=pays_joueur)

    conversations.ajouter_message(
        state, req.cible, role="ia", auteur=res["auteur"],
        texte=res["reponse"], tour=tour)
    ws.sauver_etat_courant(state)

    res["conversation"] = conversations.get_conversation(state, req.cible)
    return res


@app.get("/api/diplomatie/conversation")
def diplomatie_conversation(cible: str):
    """Historique complet du fil de discussion avec une IA. {cible, messages}."""
    state = ws.charger_etat_courant()
    if state is None:
        raise HTTPException(status_code=404, detail="Aucune partie en cours.")
    return {"cible": cible, "messages": conversations.get_conversation(state, cible)}


@app.get("/api/catalog")
def catalog():
    """Catalogue de développement (bâtiments + unités) pour le panneau Civ-like."""
    unites = []
    for type_unite, cout in COUTS_UNITES.items():
        unites.append({
            "id": type_unite,
            "cout": cout,
            "cout_pop": COUT_POP_UNITES.get(type_unite, 1),
            "cout_res": COUT_RES_UNITES.get(type_unite, {}),
            "force": FORCES_UNITES.get(type_unite, 0),
            "tech_requise": TECH_REQUISE_UNITE.get(type_unite),
        })
    return {
        "batiments": CATALOGUE_BATIMENTS,
        "unites": unites,
        "fondation": {
            "cout_or": game_engine.COUT_FONDER_VILLE_OR,
            "colons": game_engine.POP_NOUVELLE_VILLE,
            "penalite_stabilite": game_engine.PENALITE_STAB_VILLE,
        },
        "conquete": {
            "cout_or": game_engine.COUT_CONQUETE_OR,
            "penalite_stabilite": game_engine.PENALITE_STAB_CONQUETE,
        },
        "tech_navale": game_engine.TECH_NAVIGATION,
        "impots": [{"id": k, "nom": v["nom"], "or_pop": v["or_pop"], "stab": v["stab"]}
                   for k, v in game_engine.IMPOTS.items()],
        "merveilles": merveilles.info_publique(),
    }


@app.get("/api/saves")
def saves():
    """Liste des slots de sauvegarde."""
    return {"slots": ws.lister_slots()}


@app.post("/api/save")
def save(req: SlotReq):
    """Sauvegarde la partie courante dans un slot. {ok, fichier}."""
    state = ws.charger_etat_courant()
    if state is None:
        raise HTTPException(status_code=404, detail="Aucune partie à sauvegarder.")
    fichier = ws.sauver_slot(state, req.slot)
    return {"ok": True, "fichier": fichier}


@app.post("/api/load")
def load(req: SlotReq):
    """Charge un slot et en fait la partie courante. Retourne le GameState."""
    state = ws.charger_slot(req.slot)
    if state is None:
        raise HTTPException(status_code=404, detail=f"Slot {req.slot} introuvable.")
    ws.sauver_etat_courant(state)
    return state


@app.get("/")
def racine():
    return {"service": "civ-history-backend", "docs": "/docs", "api": "/api/health"}
