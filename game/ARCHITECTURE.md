# Contrat d'Architecture & d'Intégration — Phase 1 MVP

Ce document est la **source de vérité partagée** entre les agents DATA, BACKEND,
FRONTEND et PROMPTS IA. Tout agent DOIT le respecter pour que les modules
développés en parallèle s'intègrent sans friction.

> Conventions générales
> - Langue du domaine métier : **français** (ids, clés JSON, champs). Code/commentaires : français ok.
> - Encodage UTF-8 partout.
> - Tout est piloté par fichiers JSON/Markdown — **aucune base de données**.

---

## 1. Identifiants canoniques (NE JAMAIS dévier)

### Factions (clés stables)
- `rome`     — Rome — couleur `#b03a2e` (rouge) — joueur par défaut
- `carthage` — Carthage — couleur `#8e44ad` (violet)
- `macedoine`— Royaume de Macédoine — couleur `#1e8449` (vert)

Territoires neutres : faction `null` (ou `"neutre"`), couleur `#7f8c8d` (gris).

### Système de coordonnées de la carte
- Monde logique : **largeur 1000 × hauteur 700** unités (origine en haut-gauche).
- Le frontend rend ce monde dans un canvas Pixi via un `viewBox`/scale ; il NE
  hardcode AUCUNE géométrie : toute la géométrie vient de l'API.

---

## 2. Schémas de données (produits par l'agent DATA)

### `data/map/territories.json`
```json
{
  "monde": { "largeur": 1000, "hauteur": 700 },
  "territoires": [
    {
      "id": "latium",
      "nom": "Latium",
      "faction": "rome",
      "terrain": "plaine",
      "ressources": ["fer", "pierre"],
      "polygone": [[x,y], [x,y], ...],
      "centre": [x, y],
      "adjacents": ["etrurie", "campanie", "sicile_nord"],
      "capitale": true
    }
  ]
}
```
- `faction` ∈ {rome, carthage, macedoine, null}.
- `polygone` : ≥5 points, coordonnées dans le monde 1000×700, sans auto-intersection.
- Couvrir : Rome (Latium [capitale], Étrurie/Campanie, Sicile nord), Carthage
  (Afrique du Nord [capitale Carthage], Sardaigne, Hispanie sud), Macédoine
  (Grèce/Macédoine [capitale Pella], Thrace, Asie Mineure ouest) + 3-5 neutres.

### `data/map/starting_positions.json`
État initial par faction (consommé par le backend pour `new-game`) :
```json
{
  "rome": {
    "ressources": { "or": 400, "nourriture": 300, "eau": 200, "pierre": 150, "bois": 120, "fer": 100, "population": 50 },
    "ressources_luxe": { "vin": 0, "epices": 0, "ivoire": 0, "marbre": 0, "grain_egyptien": 0 },
    "stabilite": 70,
    "technologies": ["legion_tactique"],
    "villes": [ { "id": "rome", "nom": "Rome", "territoire": "latium", "population": 40, "batiments": ["forum"], "fortifications": 1 } ],
    "unites": [ { "id": "rome-leg-1", "type": "legionnaire", "territoire": "latium", "effectif": 3, "moral": 100 } ],
    "reputation": { "carthage": -20, "macedoine": 10 }
  },
  "carthage": { ... },
  "macedoine": { ... }
}
```
Équilibrer selon le cahier (Rome=militaire fer/pierre ; Carthage=or/luxe/naval ;
Macédoine=culture/influence). Types d'unités autorisés (cf. cahier §8.1) :
`levee, infanterie_legere, legionnaire, hoplite, phalange, cavalerie, elephant, trireme`.

### `data/tech_tree.json`
Reprend §12 du cahier. Structure :
```json
{
  "eres": [ { "id": "premiere_republique", "nom": "Première République", "periode": "264-220 av. J.C." }, ... ],
  "technologies": [
    { "id": "legion_tactique", "nom": "Tactique de la légion", "branche": "militaire",
      "ere": "premiere_republique", "cout_recherche": 100, "prerequis": [],
      "effet": "+15% combat infanterie", "description": "..." }
  ]
}
```
Brancher : `militaire`, `economie`, `culture`, `construction`. Inclure au moins
toutes les technologies listées au §12 (ères 1 et 2 prioritaires pour le MVP).

### `data/world_events.json`
Événements aléatoires (§16) :
```json
{ "evenements": [
  { "id": "epidemie", "nom": "Épidémie", "type": "negatif", "probabilite": 0.04,
    "effet": { "cible": "ville_aleatoire", "population_pct": -0.20 },
    "texte": "Une épidémie frappe {ville} : la population chute." }
] }
```
Probabilités telles que le total déclenché par tour tombe dans 5-15% (cf. cahier).

### `data/leaders/*.md`
Trois fichiers au format §5 du cahier (Identité, Personnalité, Priorités,
Objectifs secrets, Relations de départ, Style diplomatique, Connaissance du
monde, Phrases types) :
- `carthage_hamilcar.md` — Hamilcar Barca (modèle fourni au §5, à enrichir)
- `macedoine_antigone.md` — Antigone (Macédoine)
- `rome_scipio.md` — Scipion (Rome) — utilisé si le joueur n'incarne pas Rome

### `saves/world_state_264_03.md`
Template narratif initial (§14.3) : Situation Générale, Événements récents,
Tensions actives. Daté « Mars 264 av. J.C. ».

### `saves/save_slot_exemple.json`
Exemple de sauvegarde conforme au schéma d'état de la §4 ci-dessous.

---

## 3. Schéma d'état du jeu (GameState) — échangé via l'API

Le backend sérialise/désérialise cet objet. Les sauvegardes JSON utilisent
EXACTEMENT cette forme.
```json
{
  "meta": {
    "date_jeu": "264-03", "tour": 1, "annee": -264, "mois": 3,
    "joueur_pays": "rome", "ere": "premiere_republique"
  },
  "pays": {
    "rome": {
      "id": "rome", "nom": "Rome", "couleur": "#b03a2e", "est_joueur": true,
      "ressources": { "or": 400, "nourriture": 300, "eau": 200, "pierre": 150, "bois": 120, "fer": 100, "population": 50 },
      "ressources_luxe": { "vin": 0, "epices": 0, "ivoire": 0, "marbre": 0, "grain_egyptien": 0 },
      "production": { "or": 25, "nourriture": 18, "eau": 5, "pierre": 8, "bois": 6, "fer": 5, "population": 2 },
      "villes": [ ... ], "unites": [ ... ],
      "territoires": ["latium", "sicile_nord"],
      "technologies": ["legion_tactique"],
      "recherche_en_cours": { "tech": "siege", "progres": 30, "cout": 120 },
      "reputation": { "carthage": -20, "macedoine": 10 },
      "stabilite": 70,
      "puissance": 1234
    },
    "carthage": { ... , "est_joueur": false },
    "macedoine": { ... , "est_joueur": false }
  },
  "diplomatie": { "traites_actifs": [], "guerres_actives": [] },
  "historique_actions": [ { "tour": 1, "acteur": "rome", "texte": "...", "resultat": "..." } ],
  "evenements_tour": [],
  "messages_diplomatiques": []
}
```
- `puissance` : calculée `(Unités×Force)+(Or×0.5)+(Population×0.3)+(Territoires×10)`.
  Valeur réelle pour le joueur ; pour les IA, le backend peut l'omettre ou
  fournir une estimation ±20% sous une clé `puissance_estimee`.
- `est_joueur` distingue la faction du joueur.

---

## 4. Contrat API REST (backend FastAPI ⇄ frontend)

Base URL : `http://localhost:8000`. CORS ouvert pour `http://localhost:5173`
(port Vite par défaut). Toutes les réponses sont JSON. Préfixe `/api`.

| Méthode | Route | Corps (req) | Réponse |
|---|---|---|---|
| GET  | `/api/health` | — | `{ "ok": true, "ollama": true/false, "modele": "llama3.1:8b" }` |
| GET  | `/api/map` | — | contenu de `territories.json` (monde + territoires, couleurs résolues) |
| GET  | `/api/tech-tree` | — | contenu de `tech_tree.json` |
| GET  | `/api/state` | — | `GameState` courant (404 si aucune partie) |
| POST | `/api/new-game` | `{ "joueur_pays": "rome" }` | `GameState` initial |
| POST | `/api/end-turn` | — | `{ "state": GameState, "evenements": [...], "messages_diplomatiques": [...] }` |
| POST | `/api/action` | `{ "type": "...", "cible": "carthage", "texte": "...", "params": {...} }` | `{ "valide": bool, "raison": str, "suggestion": str, "state": GameState }` |
| POST | `/api/diplomatie/message` | `{ "cible": "carthage", "texte": "..." }` | `{ "reponse": str, "auteur": "Hamilcar Barca", "source": "ollama"|"fallback" }` |
| GET  | `/api/saves` | — | `{ "slots": [ { "slot": 1, "tour": 5, "date_jeu": "264-08", "joueur_pays": "rome" } ] }` |
| POST | `/api/save` | `{ "slot": 1 }` | `{ "ok": true, "fichier": "saves/save_slot_1.json" }` |
| POST | `/api/load` | `{ "slot": 1 }` | `GameState` |

### Types d'action (`/api/action`, champ `type`)
Menu rapide (§11.1) : `envoyer_ambassadeur`, `traite_commercial`, `declarer_guerre`,
`demander_paix`, `envoyer_ressources`, `organiser_jeux`, `recruter` (params: type, quantite),
`construire` (params: batiment, ville), `rechercher` (params: tech), `texte_libre`
(params libres + `texte`). Toute action passe par le validateur de réalisme.

### Endpoint IA
`/api/diplomatie/message` et les décisions IA de `/api/end-turn` appellent Ollama
(`http://localhost:11434/api/generate`, modèle `llama3.1:8b`). **Dégradation
gracieuse obligatoire** : si Ollama est injoignable / timeout (>6 s), renvoyer une
réponse de repli déterministe (`source: "fallback"`) basée sur le profil du
dirigeant, sans planter. Le jeu doit rester 100% jouable sans Ollama.

---

## 5. Emplacement des prompts IA (agent PROMPTS IA)

- Les templates de prompts vivent dans `backend/prompts/*.md` :
  `systeme_dirigeant.md`, `validateur_realisme.md`, `monde_narratif.md`, `profil_joueur.md`.
- `backend/ai_director.py` les CHARGE depuis ces fichiers s'ils existent, sinon
  utilise un template par défaut embarqué (pour fonctionner même avant PROMPTS IA).
- Placeholders au format `{NOM_VARIABLE}` (cf. cahier §14).
- `backend/prompts/test_prompts.py` : script de test des prompts sur scénarios réels.

---

## 5bis. Évolutions v2 (refonte gameplay « type Civilization »)

Ajouts au contrat (rétrocompatibles) :

### Nouveaux endpoints
| Méthode | Route | Réponse |
|---|---|---|
| GET | `/api/catalog` | `{ batiments:[{id,nom,cout,effet}], unites:[{id,cout,force,tech_requise}] }` — alimente le panneau de développement Civ-like. |
| GET | `/api/diplomatie/conversation?cible=carthage` | `{ cible, messages:[{role,auteur,texte,tour,ts,analyse}] }` — fil privé complet. |

### Endpoints enrichis
- `POST /api/diplomatie/message` : mémorise le fil (l'IA reçoit l'historique
  complet → cohérence). Réponse enrichie de `conversation` (fil à jour). Le
  message joueur **et** la réponse IA sont ajoutés au fil et persistés.
- `POST /api/end-turn` : réponse enrichie de `resume` (résumé narratif des
  événements majeurs du tour, généré par l'IA), `resume_source`, et `accords`
  (accords détectés dans les conversations privées et appliqués automatiquement).
- `POST /api/action` : **100 % déterministe** (jamais arbitré par l'IA). Sert au
  développement choisi par le joueur (`construire`, `recruter`, `rechercher`) et
  aux actes diplomatiques structurés (`declarer_guerre`, `demander_paix`,
  `traite_commercial`, `envoyer_ambassadeur`, `envoyer_ressources`).

### Champs ajoutés au GameState
- `pays.<id>.modificateurs` : `[{ressource, facteur, valeur, tours_restants, source}]`
  — effets temporaires d'événements rendant la **production dynamique**.
- `meta`/racine : `conversations` (`{faction: [messages]}`), `resume_tour` (str),
  `accords_recents` (list).
- `villes[].position` : `[x,y]` en coords monde — placement géographique de la
  ville sur la carte (sinon centre du territoire).

### Règles métier v2
- **Production dynamique** : revenu = base bâtiments/territoires/tech **×** facteur
  de stabilité (0,60→1,15) **×** économie de guerre (−15 % d'or si en guerre)
  **+** modificateurs d'événements (récolte, mines… sur plusieurs tours).
- **Conversations privées par IA** : un fichier `saves/conversations/<faction>.json`
  par dirigeant ; l'état partagé est unique (monde global commun).
- **Analyse de fin de tour** : l'IA relit les conversations non analysées et, si un
  accord mutuel est conclu (traité, paix, alliance, échange), l'applique tout seul.

---

## 6. Ports & lancement
- Backend : `uvicorn main:app --reload --port 8000` (depuis `game/backend`, venv).
- Frontend : Vite dev server `http://localhost:5173`, proxy/fetch direct vers `:8000`.
- Ollama : `http://localhost:11434`, modèle `llama3.1:8b`.
