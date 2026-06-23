# Backend — Jeu de Grande Stratégie Historique (Rome ~264 av. J.C.)

Backend Python / FastAPI. Tout est piloté par fichiers JSON/Markdown (aucune base
de données). L'IA générative locale (Ollama, modèle `llama3.1:8b`) est optionnelle :
le jeu reste 100 % jouable sans elle grâce à une dégradation gracieuse.

## Prérequis
- Python 3.11+
- (Optionnel) [Ollama](https://ollama.com) avec le modèle `llama3.1:8b` :
  ```bash
  ollama pull llama3.1:8b
  ```
  Si Ollama est absent ou le modèle pas encore téléchargé, les réponses IA
  passent automatiquement en mode `fallback` (déterministe, basé sur les profils).

## Installation
Depuis le dossier `game/backend/` :
```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Lancement
```bash
.venv/bin/uvicorn main:app --reload --port 8000
```
Le serveur écoute sur `http://localhost:8000`. CORS est ouvert pour le frontend
Vite (`http://localhost:5173`).

Vérification rapide :
```bash
curl http://localhost:8000/api/health
```

## Endpoints (contrat ARCHITECTURE §4)
| Méthode | Route | Description |
|---|---|---|
| GET  | `/api/health` | `{ok, ollama, modele, modele_pret}` |
| GET  | `/api/map` | Carte (territories.json + couleurs résolues) |
| GET  | `/api/tech-tree` | Arbre technologique |
| GET  | `/api/state` | GameState courant (404 si aucune partie) |
| POST | `/api/new-game` | `{joueur_pays}` → GameState initial |
| POST | `/api/end-turn` | `{state, evenements, messages_diplomatiques}` |
| POST | `/api/action` | `{type, cible, texte, params}` → validation + application |
| POST | `/api/diplomatie/message` | `{cible, texte}` → réponse d'un dirigeant IA |
| GET  | `/api/saves` | Liste des slots de sauvegarde |
| POST | `/api/save` | `{slot}` → écrit `saves/save_slot_N.json` |
| POST | `/api/load` | `{slot}` → charge un slot |

Documentation interactive auto-générée : `http://localhost:8000/docs`.

## Organisation
| Fichier | Rôle |
|---|---|
| `main.py` | App FastAPI, routes, CORS, gestion d'erreurs |
| `game_engine.py` | Moteur : tours, production, IA, conflits, puissance, victoire |
| `world_state.py` | Persistance JSON, slots, world_state.md narratif |
| `ai_director.py` | Orchestration Ollama + replis déterministes |
| `realism_validator.py` | Validation des actions (déterministe + Ollama) |
| `tech_tree.py` | Arbre techno : prérequis, progression, effets |
| `models/` | `country.py`, `unit.py`, `city.py` |

Les chemins `data/` et `saves/` sont résolus depuis `game/` (via
`Path(__file__).resolve().parent.parent`), donc le serveur fonctionne quel que
soit le répertoire de lancement.

## Sauvegardes
- Partie en cours : `saves/save_courant.json` (écrite automatiquement).
- Slots manuels : `saves/save_slot_N.json` (via `/api/save`).
- Chronique narrative : `saves/world_state_AAAA_MM.md`, régénérée tous les 6 tours.
