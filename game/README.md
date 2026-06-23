# Imperium — Jeu de Grande Stratégie Historique (Rome Antique, ~264 av. J.C.)

Jeu de grande stratégie au tour par tour, solo, situé en Méditerranée centrale en
264 av. J.C. Vous dirigez **Rome**, **Carthage** ou la **Macédoine** face à des
dirigeants rivaux pilotés par une **IA générative locale** (Ollama / `llama3.1:8b`).
Inspiré de *Civilization* (gestion, arbre techno, carte) et *Pax Historia*
(diplomatie vivante, actions en langage naturel, narration IA).

> **État : Phase 1 — MVP jouable.** Carte des 3 factions, ressources qui
> progressent chaque tour, boucle de tour complète, dirigeants IA qui répondent,
> sauvegarde/chargement JSON. Voir [`../cahier_des_charges.md`](../cahier_des_charges.md)
> pour la vision complète et la roadmap, et [`DECISIONS.md`](DECISIONS.md) pour les
> choix techniques.

---

## Stack

| Composant | Techno | Version testée |
|---|---|---|
| Frontend | React + Vite + **Pixi.js** (carte) + **Tailwind CSS** | React 19, Vite 7, Pixi 8, Tailwind 4 |
| Backend | **Python** + **FastAPI** + uvicorn | Python 3.14 (≥3.11 ok), FastAPI 0.137 |
| IA locale | **Ollama** — modèle `llama3.1:8b` | Ollama 0.15 |
| Persistance | JSON (sauvegardes) + Markdown (narration) | — |
| Plateforme | macOS Apple Silicon | M2 / 16 Go |

---

## Prérequis

```bash
# Node ≥ 18 et Python ≥ 3.11 (3.13/3.14 ok), via Homebrew :
brew install node python ollama
```

### Le modèle IA (optionnel pour jouer, requis pour l'IA générative)
```bash
ollama serve            # démarre le serveur Ollama (http://localhost:11434)
ollama pull llama3.1:8b # ~4.9 Go, à faire une seule fois
```
> **Le jeu est 100 % jouable même sans Ollama.** Tant que le modèle n'est pas
> présent, les dirigeants IA répondent via un **mode de repli déterministe**
> (réponses tirées de leur profil). Dès que `llama3.1:8b` est téléchargé et
> qu'`ollama serve` tourne, les réponses deviennent génératives automatiquement
> (champ `source: "ollama"` au lieu de `"fallback"`).

---

## Installation

```bash
# 1) Backend
cd game/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 2) Frontend
cd ../frontend
npm install
```

---

## Lancement (3 terminaux)

```bash
# Terminal 1 — Ollama (si vous voulez l'IA générative)
ollama serve

# Terminal 2 — Backend (API sur http://localhost:8000)
cd game/backend
.venv/bin/uvicorn main:app --reload --port 8000

# Terminal 3 — Frontend (UI sur http://localhost:5173)
cd game/frontend
npm run dev
```

Ouvrez **http://localhost:5173**. Au premier lancement, cliquez **« Nouvelle
partie »**. Vérifier le backend : http://localhost:8000/api/health.

---

## Comment jouer (boucle de base)

1. **Carte du monde** (style Age of History) : provinces colorées par faction,
   noms des villes à leur position. **Cliquez une civilisation** (sur la carte ou
   dans la liste « Civilisations ») pour ouvrir sa **diplomatie**.
2. **Mon Empire** (panneau de droite, à la *Civilization*) : vous choisissez
   vous-même quoi **construire**, **recruter** et **rechercher**, selon vos
   ressources. Ces choix sont déterministes (jamais arbitrés par l'IA).
3. **Diplomatie & guerre** (au clic sur une civilisation) : déclarer la guerre,
   demander la paix, traité commercial, ambassadeur, offrir des ressources, et
   une **messagerie** privée avec le dirigeant. Chaque IA **se souvient** de tout
   le fil de discussion (`saves/conversations/<faction>.json`).
4. **Ressources dynamiques** : la production `(+x)` dépend des bâtiments, de la
   **stabilité**, de l'état de **guerre** et des **événements** en cours — elle
   varie d'un tour à l'autre.
5. **Fin de tour** : le monde avance d'un mois (production, croissance, IA,
   événements). L'IA **analyse vos conversations privées** et applique
   automatiquement les **accords** conclus (traité, paix, échange), puis rédige la
   **« Chronique du tour »** (résumé des événements majeurs). Tous les 6 tours,
   `saves/world_state_*.md` est régénéré.
6. **Sauvegarder / Charger** (slot 1) à tout moment.

> Avec le modèle Ollama chargé, une réponse diplomatique prend ~10-13 s et une fin
> de tour ~9 s sur M2 16 Go (génération locale). Sans Ollama, le jeu reste jouable
> en mode repli déterministe.

---

## Structure du projet

```
game/
├── ARCHITECTURE.md       # Contrat partagé (ids, schémas data, API REST) — source de vérité
├── README.md             # Ce fichier
├── DECISIONS.md          # Journal des choix techniques
├── backend/              # FastAPI : moteur de jeu, IA, validation, sauvegardes
│   ├── main.py game_engine.py ai_director.py world_state.py
│   ├── conversations.py realism_validator.py tech_tree.py requirements.txt
│   ├── models/ (country.py unit.py city.py)
│   └── prompts/ (systeme_dirigeant.md validateur_realisme.md monde_narratif.md
│                 analyse_accords.md resume_tour.md profil_joueur.md test_prompts.py)
├── frontend/             # React + Vite + Pixi + Tailwind
│   └── src/ (App.jsx api.js lib/format.js
│             components/{Map,ResourceBar,DevelopmentPanel,DiplomacyModal,MessageThread,TechTree}.jsx)
├── data/                 # Données du jeu (JSON/MD) — éditables à la main
│   ├── map/ (territories.json starting_positions.json)
│   ├── leaders/ (carthage_hamilcar.md macedoine_antigone.md rome_scipio.md)
│   ├── tech_tree.json world_events.json
└── saves/                # Sauvegardes JSON + chroniques world_state_*.md
```

---

## API REST (résumé)

Base `http://localhost:8000`. Contrat complet dans [`ARCHITECTURE.md`](ARCHITECTURE.md) §4.

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/health` | état serveur + Ollama (`modele_pret`) |
| GET | `/api/map` / `/api/tech-tree` | carte / arbre techno |
| GET | `/api/state` | état de la partie (404 si aucune) |
| POST | `/api/new-game` | nouvelle partie `{joueur_pays}` |
| POST | `/api/end-turn` | avance d'un tour (+ événements, messages IA) |
| POST | `/api/action` | action joueur (validée) |
| POST | `/api/diplomatie/message` | message libre à un dirigeant IA |
| GET/POST | `/api/saves` `/api/save` `/api/load` | sauvegardes |

---

## Tests

```bash
# Backend up, puis :
curl -s localhost:8000/api/health

# Prompts IA (marche en mode fallback sans le modèle) :
cd game/backend && .venv/bin/python prompts/test_prompts.py

# Build frontend de production :
cd game/frontend && npm run build
```

---

## Dépannage

- **« Backend indisponible »** dans l'UI → le backend n'écoute pas sur `:8000`
  (relancer uvicorn). CORS est ouvert pour `http://localhost:5173`.
- **Réponses IA « fallback »** → normal tant que `llama3.1:8b` n'est pas
  téléchargé ou qu'`ollama serve` ne tourne pas. Vérifier `ollama list`.
- **Port occupé** → changez le port uvicorn (`--port`) et `VITE_API_BASE`
  (voir `frontend/.env.example`), ou le port Vite.
