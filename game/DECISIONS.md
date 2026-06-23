# DECISIONS.md — Journal des choix techniques

Décisions d'architecture prises pendant la livraison de la **Phase 1 (MVP)**.
Le cahier des charges ([`../cahier_des_charges.md`](../cahier_des_charges.md))
laissait explicitement la liberté de dévier en documentant pourquoi.

---

## 0. Orchestration multi-agents

Le projet a été construit par **4 sous-agents spécialisés** (comme demandé dans le
prompt d'initialisation), coordonnés par un **contrat partagé** rédigé en amont :
[`ARCHITECTURE.md`](ARCHITECTURE.md).

- **Pourquoi un contrat d'abord ?** BACKEND et FRONTEND ont travaillé **en
  parallèle**. Figer à l'avance les *ids canoniques*, les *schémas de données*, le
  *schéma GameState* et le *contrat API REST* a permis une intégration sans
  divergence (vérifiée : CORS + tous les endpoints au premier essai).
- **Ordre d'exécution** : DATA → (BACKEND ∥ FRONTEND) → PROMPTS IA. Les données
  sont une dépendance de tout le reste ; les prompts s'ajoutent par-dessus un
  backend qui embarque déjà des templates par défaut.
- **Périmètres disjoints** : chaque agent n'écrit que dans son dossier
  (`data/`, `backend/`, `frontend/`, `backend/prompts/`) → zéro conflit de fichier.

---

## 1. Dégradation gracieuse de l'IA (décision structurante)

**Décision :** le jeu doit être **100 % jouable sans Ollama**. `ai_director.py` et
`realism_validator.py` détectent la présence du modèle (`GET /api/tags`), imposent
un **timeout de 6 s** (contrainte cahier), et en cas d'indisponibilité / timeout /
erreur renvoient une **réponse de repli déterministe** construite depuis le profil
du dirigeant, marquée `source: "fallback"`. Aucune exception ne remonte aux endpoints.

**Pourquoi :** le modèle `llama3.1:8b` (~4.9 Go) peut être absent ou en cours de
téléchargement, et une dépendance dure à un service local rendrait le MVP
non démontrable. Le passage `fallback → ollama` est automatique dès que le modèle
est prêt — aucun changement de code.

---

## 2. Frontend — Vite + JavaScript (pas TypeScript)

**Décision :** React 19 via **Vite** en **JavaScript pur**.
**Pourquoi :** vitesse de livraison du MVP, moins de configuration. La frontière
de typage forte est de toute façon le **contrat API** (ARCHITECTURE §3/§4), pas le
langage du front. Migration TS possible plus tard sans changer l'archi.

## 3. Tailwind CSS v4 (config CSS-first)

**Décision :** Tailwind **v4** via le plugin Vite `@tailwindcss/vite`
(`@import "tailwindcss"` + bloc `@theme`), **sans** `tailwind.config.js` ni PostCSS.
**Pourquoi :** c'est la configuration v4 la plus stable et la plus simple, moins de
fichiers de config, build propre.

## 4. Pixi.js v8 alimenté par l'API

**Décision :** la carte récupère **toute** sa géométrie depuis `GET /api/map`
(monde logique **1000×700**, polygones, couleurs). Le frontend ne hardcode aucune
donnée de jeu ; il met à l'échelle le monde vers le canvas en conservant le ratio
(letterbox), gère le cycle de vie Pixi proprement (destruction au démontage).
**Pourquoi :** découplage total données/rendu — modifier la carte = éditer un JSON,
sans toucher au code front. Les conquêtes recolorent les territoires dynamiquement
depuis `state.pays[*].territoires`.

---

## 5. Backend — modules à plat + package `models/`

**Décision :** uvicorn lance `main:app` à plat ; imports top-level + ajustement
`sys.path` dans `main.py` ; `models/` reste un vrai package Python.
**Pourquoi :** lancement le plus simple (`uvicorn main:app`) sans imposer une
exécution en module. Les chemins `data/`/`saves/` sont résolus depuis
`Path(__file__).parent.parent` (= `game/`), donc le serveur marche **quel que soit
le cwd**.

## 6. requirements.txt — bornes de versions plutôt qu'épinglage strict

**Décision :** dépendances déclarées en **plages** (`>=…,<…`) plutôt qu'en versions
exactes.
**Pourquoi :** l'environnement de dev utilise **Python 3.14**, pour lequel certaines
versions épinglées (ex. pydantic 2.10.x) n'avaient pas de *wheels* précompilés
(échec de compilation depuis les sources). Les bornes laissent pip choisir des
wheels compatibles. Versions installées et testées : FastAPI 0.137, Pydantic 2.13,
uvicorn 0.49, httpx 0.28.

## 7. Modèles de données — dataclasses

**Décision :** modèles `country/unit/city` en **dataclasses** Python.
**Pourquoi :** sérialisation JSON directe vers le schéma GameState (ARCHITECTURE §3),
légèreté, pas besoin de la validation Pydantic au cœur du moteur (Pydantic reste
dispo pour les corps de requête FastAPI).

## 8. Trirème — force navale nominale

**Décision :** la trirème (force notée « — » au cahier §8.1) reçoit une **force
navale nominale de 5** utilisée dans le calcul de puissance (§10.2).
**Pourquoi :** éviter une unité à puissance nulle ; valeur documentée en commentaire,
à affiner quand le système naval sera développé (Phase 2).

## 9. Puissance des IA masquée (réelle vs estimée)

**Décision :** dans le GameState, le **joueur** voit sa `puissance` réelle ; les
factions IA exposent une `puissance_estimee` (réel ±20 %, cf. cahier §10.2), pas la
valeur exacte.
**Pourquoi :** respecter la règle de connaissance limitée — la puissance est cachée
aux adversaires.

---

## 10. Prompts en fichiers + templates par défaut embarqués

**Décision :** les prompts vivent dans `backend/prompts/*.md` et sont **chargés s'ils
existent**, sinon le backend utilise des **templates par défaut embarqués**. Format
des variables : `{NOM_VARIABLE}` (substitution littérale).
**Pourquoi :** découple le travail de l'agent PROMPTS du backend (le backend tourne
même avant que les prompts soient écrits) et permet d'itérer sur les prompts sans
redéploiement de code. Le validateur force une **sortie JSON stricte**
(`{valide, raison, suggestion}`) + `format:"json"` côté appel Ollama.

## 11. `profil_joueur.md` — livré mais pas encore câblé

**Décision :** le template `profil_joueur.md` (profil dynamique du joueur, cahier §5)
est écrit avec un contrat de placeholders cohérent, mais **aucun module backend ne le
consomme encore**.
**Pourquoi :** le profil joueur dynamique relève de la **Phase 3** de la roadmap. Le
template est prêt ; il restera à le brancher (alimenter `reputation.trahison` /
`reputation.genereux`) le moment venu.

---

## 12. Persistance — JSON + Markdown, zéro base de données

**Décision :** conforme au cahier. Sauvegardes en slots JSON
(`saves/save_slot_N.json`), partie courante dans `saves/save_courant.json`,
chroniques narratives en Markdown régénérées tous les 6 tours.
**Pourquoi :** lisible, éditable à la main, versionnable, aucune dépendance externe.

---

## v2 — Refonte « type Civilization » (itération gameplay)

### 13. Suppression de l'onglet Actions ; développement piloté par le joueur
**Décision :** l'`ActionInput` (texte libre + menu) est supprimé. Le joueur gère
son empire via un **panneau de développement** (construire/recruter/rechercher
selon ses ressources, `DevelopmentPanel.jsx`) et la **guerre/diplomatie via un
panneau par civilisation** ouvert au clic sur une civilisation (carte ou liste,
`DiplomacyModal.jsx`). `POST /api/action` est rendu **100 % déterministe** : les
choix de développement ne sont JAMAIS arbitrés par l'IA.
**Pourquoi :** demande explicite — gameplay plus proche de Civilization, l'IA ne
décide pas à la place du joueur ; la diplomatie (dont la guerre) se concentre là
où on clique une nation.

### 14. Production de ressources dynamique
**Décision :** le revenu n'est plus quasi-constant : il intègre un **facteur de
stabilité** (0,60→1,15), une **économie de guerre** (−15 % d'or en guerre) et des
**modificateurs d'événements** à durée limitée (récolte exceptionnelle, mines…).
La production affichée est recalculée en fin de tour pour refléter ces facteurs.
**Pourquoi :** demande explicite — le revenu doit dépendre des infrastructures, de
l'état de la civilisation et des événements en cours.

### 15. Conversations privées mémorisées par IA + messagerie
**Décision :** chaque IA a un fil persistant (`saves/conversations/<faction>.json`
+ copie dans le GameState pour save/load). L'IA reçoit l'**historique complet** du
fil à chaque message (cohérence). UI : messagerie moderne (bulles, indicateur
« écrit… », `MessageThread.jsx`).
**Pourquoi :** demande explicite — cohérence des échanges et rendu type app de
messagerie. Double stockage (fichier dédié + état) pour satisfaire « un fichier
JSON par IA » tout en gardant un save/load simple.

### 16. Monde global partagé + application automatique des accords
**Décision :** l'état du monde est unique et partagé (déjà le cas). En fin de
tour, `ai_director.analyser_accords` relit les messages non analysés de chaque fil
et, si un accord mutuel est détecté (traité, paix, alliance, échange), le moteur
l'applique automatiquement (`_appliquer_accord` : traités, fin de guerre,
transferts de ressources, réputation). Sortie JSON stricte + repli heuristique par
mots-clés si Ollama indisponible.
**Pourquoi :** demande explicite — les décisions prises en conversation privée
doivent produire des conséquences réelles sans action manuelle supplémentaire.

### 17. Résumé de tour généré par l'IA
**Décision :** à chaque fin de tour, `ai_director.resumer_tour` rédige une
chronique des événements majeurs (guerres, accords, recherches, catastrophes),
affichée dans « Chronique du tour ». Repli déterministe si Ollama absent.
**Pourquoi :** demande explicite.

### 18. Performance Ollama sur Apple Silicon (M2 16 Go)
**Décision :** `keep_alive` 30 min (modèle résident), **préchargement au démarrage**,
prompts **fortement allégés** (brief de dirigeant compact au lieu du profil
complet, état du monde tronqué, template système condensé), `num_predict` borné
par usage, et **décisions IA de tour rendues déterministes** pour ne garder qu'un
seul appel génératif lourd par fin de tour (le résumé) + l'analyse d'accords
seulement quand une conversation est en attente. Délai de génération porté à 18 s.
**Pourquoi :** en mode low-VRAM (11,8 Go), le *prefill* domine (~170 tok/s). Sans
ces mesures, une réponse dépassait 24 s. Résultats chauds obtenus : diplomatie
≈ 10-13 s, fin de tour ≈ 9 s. La cible « < 6 s » du cahier n'est pas atteignable
pour des réponses génératives de qualité sur ce matériel ; l'UI l'absorbe via un
indicateur « écrit… » et un état « le monde avance… ». La dégradation gracieuse
(repli déterministe) reste active si le modèle est absent.

---

## v3 — UI/UX type Civilization & Age of History (itération design + mécaniques)

> L'IA n'a volontairement PAS été modifiée dans cette itération (demande explicite).

### 19. Agent DESIGN dédié
**Décision :** un sous-agent « DESIGN » a recherché Civ VI / Age of History et livré
le système visuel ([`DESIGN.md`](DESIGN.md)) : thème complet dans `index.css`
(polices gravées Cinzel + EB Garamond, palette, **contrat de classes** `.panel`,
`.btn*`, `.card*`, `.progress`, `.menu-*`) et une **carte de la Méditerranée
géographique** (`territories.json`, monde 1200×640, provinces positionnées).
**Pourquoi :** demande explicite ; parallélisme sans conflit via un contrat de
classes (le DESIGN style les classes, les composants les consomment).

### 20. Menu principal → choix de civilisation → départ « à zéro »
**Décision :** écran-titre, puis sélection de la civilisation (Rome/Carthage/
Macédoine), puis partie. On démarre avec **une seule cité et toutes les ressources
à 0** ; la cité produit une base modeste, et l'on **construit pour produire**.
**Pourquoi :** demande explicite ; boucle de progression plus proche de Civilization.

### 21. Construction à durée (file de chantier)
**Décision :** construire investit l'or immédiatement puis prend **N tours**
(`DUREE_BATIMENTS`) ; l'avancement est affiché (barre de progression, tours
restants) ; une seule construction à la fois par ville.
**Pourquoi :** demande explicite (« un temps en tours indiqué… l'avance sur la production »).

### 22. Armées : recrutement régional, déplacement, entretien
**Décision :** les unités sont recrutées **sur une région possédée**, affichées
sur la carte (badge ⚔ effectif) et se **déplacent de région adjacente en région
adjacente** (1 mouvement/tour ; clic sur l'armée → régions voisines éclairées →
clic pour déplacer). Chaque effectif **coûte de l'or/tour**, **consomme nourriture
+ eau** et **pèse sur la stabilité** (sur-militarisation graduée). Stocks plancher à 0.
**Pourquoi :** demande explicite ; donne du poids stratégique à l'armée.

### 23. `/api/action` renvoie le résultat moteur ; nouvel `/api/unit/move`
**Décision :** la réponse d'action expose le message concret du moteur (« Chantier
lancé… ») ; un endpoint `POST /api/unit/move` gère le déplacement (adjacence + 1/tour).
**Pourquoi :** retour clair au joueur ; mouvement piloté côté serveur (règles).

---

## v4 — Carte réaliste de l'Europe + pause IA pour les tests

### 24. Carte issue de données géographiques réelles (Natural Earth admin-1 10m)
**Décision :** `data/map/territories.json` est désormais **généré** (script
[`tools/build_map.py`](tools/build_map.py)) depuis Natural Earth admin-1 10m : **~1024 provinces** aux
**vraies côtes** couvrant l'Europe et le pourtour méditerranéen (fenêtre lon
−11..40, lat 30..56), projetées en monde 1400×976. Factions placées
historiquement : Rome = péninsule italienne (+ Sicile), Carthage = Maghreb +
Ibérie + Sardaigne, Macédoine = Grèce/Balkans/Anatolie ouest, le reste neutre.
Adjacence par proximité de frontières (terrestre + détroits courts), capitales
détectées par proximité aux coordonnées historiques (Roma, Tunis, Macédoine
centrale) et **synchronisées dans `starting_positions.json`**.
**Pourquoi :** demande explicite (« vraie map de l'Europe avec beaucoup de cases »).
**Optimisations rendu :** suppression de l'ombre par province et survol qui ne
redessine QUE la province concernée (sinon ~1000 redraws/hover).
**Limite connue :** ~5 provinces insulaires restent isolées (pas d'adjacence).

### 25. Résumé de tour génératif EN PAUSE (tests UI/design)
**Décision :** drapeau `RESUME_IA_ACTIF = False` dans `game_engine.py` : la fin de
tour n'appelle plus Ollama pour le résumé (devient **instantanée**) et fournit un
résumé déterministe. L'UI affiche le badge **« ⏸ Résumé IA en pause »**.
**Pourquoi :** demande explicite pour accélérer les tests d'interface. La
diplomatie générative (messages) et l'analyse d'accords restent actives ;
repasser le drapeau à `True` réactive la narration de tour.

---

## v5 — Refonte UI/UX façon Civ/Age of History + carte propre

### 26. Carte « pays » (admin-0) complète, regroupée, zoomable
**Décision :** la carte admin-1 (~1024 micro-provinces, trouée) est remplacée par
une carte **admin-0 (pays, 10m)** : ~92 provinces aux vraies côtes, **découpées à
la fenêtre** (Sutherland–Hodgman) pour une **couverture complète sans trous**, îles
majeures incluses. La carte est **zoomable** (molette + boutons +/−/recentrer) et
**déplaçable** (glisser). Script : [`tools/build_map.py`](tools/build_map.py).
**Pourquoi :** demande explicite (carte trouée → propre, provinces regroupées plus
grosses « pour le moment »).

### 27. Chaque civilisation démarre avec UNE province
**Décision :** dans `territories.json`, **seules les 3 capitales** portent une
faction (Italie→Rome, Tunisie→Carthage, Grèce→Macédoine) ; tout le reste est
neutre. `new_game` dérive donc 1 territoire par faction.
**Pourquoi :** demande explicite.

### 28. UI épurée : carte + barre du haut, le reste en modales
**Décision :** la vue de jeu n'affiche que la **carte** et la **barre de ressources**,
plus une **barre d'action** en bas. Production, Recrutement, Technologies et
Diplomatie s'ouvrent en **modales** via un bouton. La chronique de tour devient un
**toast** refermable.
**Pourquoi :** demande explicite (« tu ne vois que la map et la top bar »).

### 29. Production unique vs recrutement libre (coût population)
**Décision :** **une seule construction à la fois** (par ville) ; le **recrutement
est illimité** tant qu'il reste assez d'**or ET de population** — chaque unité
consomme de l'or et de la **population** (`COUT_POP_UNITES`), exposée au front via
`/api/catalog`.
**Pourquoi :** demande explicite.

### 30. Panneau de civilisation : messagerie d'abord
**Décision :** cliquer une civilisation ouvre un panneau **sur l'onglet Messages**
(messagerie), avec un **onglet Diplomatie** en haut (relation + guerre/paix/traité/
ambassadeur/don).
**Pourquoi :** demande explicite.

---

## v6 — Sélection, déplacement maritime, conquête & polish carte

### 31. Carte « vraie carte » : terre/mer + adjacence terre vs mer
**Décision :** la mer est bleue, les terres en parchemin (provinces neutres), les
empires colorés (rendu Age of History, moins « générique »). `territories.json`
distingue désormais **adjacence terrestre** (sommets de frontière partagés, topo)
et **adjacence maritime** (`adjacents_mer` : détroits/mers étroites validées en
vérifiant que le segment traverse la mer, pas une autre province).
**Pourquoi :** demande (carte trouée/peu crédible → réaliste ; design « trop IA »).

### 32. Sélection qui se soulève + flèches de déplacement
**Décision :** cliquer une province la **soulève** (ombre portée + contour clair).
Cliquer SON armée affiche des **flèches** vers les régions atteignables (or =
terre, bleu = mer). Boutons d'UI dé-émojifiés.
**Pourquoi :** demande explicite.

### 33. Technologie « Navigation maritime » pour franchir la mer
**Décision :** déplacer une armée par une liaison maritime exige la techno
`navigation_maritime` (sinon refus). Les flèches maritimes n'apparaissent qu'une
fois la techno acquise.
**Pourquoi :** demande explicite.

### 34. Déplacement LIBRE, annexion séparée et payante, colonisation déstabilisante
**Décision (révisée v7) :** déplacer une armée est **gratuit** — on traverse une
province neutre sans la conquérir. **Annexer** est une action distincte et
optionnelle (`/api/province/annex`, bouton « Annexer » qui apparaît quand une armée
occupe une province neutre) : **90 or** et **−8 de stabilité** (province agitée).
**Fonder une ville** coûte **220 or + 6 colons** (prélevés sur la plus grande
ville), **−6 de stabilité**, et la colonie reste en **pacification 3 tours**.
Entrer dans une province ennemie est refusé pour l'instant (conquête militaire =
évolution future).
**Pourquoi :** demande — pouvoir circuler sans être forcé de conquérir (et sans
être bloqué faute d'or), tout en gardant une expansion coûteuse et déstabilisante.

### 35. Cadrage carte + zoom/pan (v7)
**Décision :** la barre d'action passe en **bas de page (flux normal)** au lieu de
recouvrir la carte (qui était « coupée »). Le **zoom molette** devient doux
(exponentiel, borné) et le **zoom/déplacement de l'utilisateur est préservé**
quand un panneau s'ouvre/se ferme (plus de recentrage intempestif).
**Pourquoi :** demande (carte coupée, zoom/déplacement peu naturels).

> Note : les interactions carte (soulèvement, flèches) sont rendues côté Pixi
> (clavier/souris) ; la logique serveur (déplacement, mer, conquête, fondation)
> est testée et validée.

---

## v8 — Subdivision des pays, carte plein écran, icônes

### 36. Carte subdivisée (admin-1 → ~K régions/pays via shapely)
**Décision :** `tools/build_map.py` passe à **Natural Earth admin-1** : les
provinces sont regroupées par pays puis **partitionnées en ~K régions** (k-means
sur les centroïdes + **union shapely**), K proportionnel à la surface (France 7,
Italie 5, Espagne 7, Turquie 7…). **118 provinces** au total, côtes naturelles,
adjacence terre/mer calculée via shapely (`touches`/`distance` + segment qui ne
traverse pas la terre). Chaque civilisation démarre sur **la sous-région contenant
sa capitale** (le reste du pays est neutre, à conquérir).
**Dépendances de l'outil :** `shapely`, `numpy` (dans `backend/.venv`, pour le
script de génération uniquement — le runtime n'en a pas besoin, la carte est
pré-générée dans `territories.json`).
**Pourquoi :** demande (« plus de provinces par pays »).

### 37. Carte plein écran (cover)
**Décision :** la carte **remplit** la zone (mise à l'échelle « cover » + zone sans
marge) au lieu d'être en letterbox ; le joueur déplace/zoome pour voir les bords.
**Pourquoi :** demande (« la map prend pas tout l'écran »).

### 38. Icônes SVG (unités, bâtiments, emblèmes)
**Décision :** un jeu d'**icônes SVG** maison (`components/Icons.jsx`, sans asset
externe, couleur via `currentColor`) : icônes d'unités (recrutement), de bâtiments
(production) et **emblèmes de faction** (aigle romain, symbole de Tanit, soleil de
Vergina) dans le menu de civ, le sélecteur diplomatique et l'en-tête de diplomatie.
**Pourquoi :** demande (« ajoute des images pour les armées, la production, les logos »).

---

## v9 — Carte sans trous, sélection contextuelle, arbre & infobulles

- **Trous de la carte corrigés** : chaque région est légèrement dilatée
  (`buffer`) après simplification pour recouvrir les slivers entre voisins.
- **Noms cohérents** : chaque province porte le nom réel de sa province admin-1
  dominante ; les 3 capitales = Latium / Africa / Macédoine.
- **Carte plein écran « cover » + zoom de base plus serré + pan borné** : on ne
  peut plus voir au-delà des bords (`clampView`), zoom molette adouci.
- **Menus liés aux provinces** : Production et Armée n'apparaissent qu'après avoir
  cliqué une de SES provinces (la barre affiche son nom) ; les modales agissent
  sur cette province.
- **Déplacement libre sans popup** ; **bouton Annexer affiche le coût** (or) et le
  nom de la province.
- **Infobulle ressources** : survol d'une ressource → ventilation des sources de
  production/perte (backend `production_detail`).
- **Toasts flottants** (ne décalent plus la carte) ; modales stylées.
- **Vrai arbre technologique** : graphe en colonnes par profondeur de prérequis,
  avec **traits de liaison** prérequis → techno.
- **Chantiers visibles sur la carte** : échafaud + % pendant la construction
  (une seule à la fois), puis **icône du bâtiment** sur la province une fois bâti.

---

## v10 — Colonisation, gouvernance, dogmes, économie & carte

- **Bug « bâtiment déjà construit »** corrigé : la modale Production est désormais
  **liée à la province sélectionnée** (et non rabattue sur la capitale). Une
  province sans ville propose **Fonder une ville** ; une province avec ville
  propose construction + gouvernance.
- **Fonder une ville dans les provinces annexées** : accessible directement (la
  colonisation est focalisée sur la province choisie).
- **Économie revue** : nourriture/eau dépendent des **provinces possédées** et de
  la **population** ; la **consommation** croît avec les **villes** et la
  population (visible dans l'infobulle).
- **Population** : démarre plus haut (24) et **croît lentement** (plafonnée).
- **Gouverneurs** (`nommer_gouverneur`, 100 or) : +2 stabilité/tour, rétablit
  l'ordre. **Jeux/fêtes** (`organiser_jeux`) exposés dans la gouvernance.
- **Arbre de DOGMES** (`data/dogmes.json`, `/api/dogme-tree`, `DogmeTree.jsx`) en
  plus de l'arbre techno : 3 branches (Ordre civique / Foi / Expansion), adoption
  payée en or, effets cumulés (stabilité, or, −coût d'annexion/fondation).
- **Carte sans trous** : `buffer` élargi (0.09), provinces plus petites conservées
  (MIN_AREA 0.12), fenêtre étendue au nord (toute la Bretagne).

---

## v11 — Population des provinces, capitale, carte affinée

- **Annexion** instantanée qui **apporte la population** de la province
  (`population` prédéfinie par province dans `territories.json`, gagnée à l'annexion).
- **Carte** : buffer ramené à 0.035 + MIN_AREA 0.06 (trous comblés sans débordement
  de provinces voisines), simplification plus légère.
- **Capitale** : marqueur visuel = **étoile dorée laurée** (vs simple point pour
  les autres villes), nom doré et un peu plus grand.

> Partie simulée (18 tours) — points d'amélioration relevés (hors IA/messages) :
> - Les ressources **autres que l'or s'accumulent sans usage** (nourriture/eau/
>   pierre/bois/fer) → faire **coûter ces ressources** aux bâtiments/unités.
> - L'**or est l'unique goulot** (tout coûte de l'or, revenu ~13-15/tour) →
>   progression lente et à une dimension.
> - **Croissance de population lente** (+0,3/tour) — l'annexion devient le moteur.
> - **Stabilité statique** (ne dérive pas ; gérée via forum/dogmes/gouverneur/jeux).

---

## v12 — Économie multi-ressources, impôts, stabilité réaliste, révoltes

- **Bâtiments d'extraction** : Ferme (+nourriture, −eau), Puits/Aqueduc (+eau),
  Scierie (+bois), Carrière (+pierre), Mine (+fer). **Rien n'est produit au départ**
  hors une base modeste de la ville ; il faut bâtir pour produire.
- **Ressources non-or utiles** : les bâtiments coûtent **pierre/bois**, les unités
  coûtent **fer** (navires : bois). Chaîne d'amorçage : Scierie → bois → Carrière/Mine.
- **Consommation** nourriture/eau = **population + armée**.
- **Impôts** (4 niveaux : Bas/Normal/Élevé/Oppressif) : l'or vient de la population
  selon le taux ; le taux pèse sur la **stabilité**. Sélecteur dans la barre d'action.
- **Stabilité réaliste** : ne s'accumule plus, elle **dérive (inertie ~35 %) vers une
  CIBLE** issue des conditions (impôts, famine, sur-militarisation, taille de l'empire,
  bâtiments, dogmes, gouverneurs). Affichée « actuel → cible » + infobulle de ventilation.
- **Révoltes** : stabilité < 25 → une province fait **sécession** ; < 15 → **mutinerie**
  (une unité déserte/se retourne). La capitale n'est jamais perdue.
- **Annexion** : apporte la **population** de la province.
- **Équilibrage « fun »** (après partie de test) : trésor de départ (100 or), revenu
  et croissance de population revus → début dynamique (6 bâtiments ~T26, armée ~T15).

---

## v13 — Reskin 54 ap. J.-C. + carte sans trou + merveilles

- **Carte** : génération refaite pour un pavage GARANTI sans trou ni chevauchement —
  regroupement CONTIGU des provinces (croissance depuis graines), snap sur grille de
  précision commune (`set_precision`), puis absorption automatique de tout trou interne
  (frontières inter-pays / lacs) par la province voisine. Grèce densifiée (6 provinces,
  `MIN_K`), îles majeures (Crète, Eubée) gardées, pas de confetti. ~163 provinces.
- **Époque 54 ap. J.-C.** (reskin, 3 factions conservées en interne) :
  - `rome` → **Rome** (Néron) — Latium.
  - `carthage` → **Empire parthe** (Vologèse Ier) — Ctésiphon, frontière d'Orient (Şanlıurfa).
  - `macedoine` → **Germains** (Arminius) — Mattium, Germanie (Rhénanie).
  - Les IDs internes restent (rome/carthage/macedoine) pour ne rien casser ; seuls
    nom/couleur/dirigeant/capitale/profil sont reskinés. Dates en « ap. J.-C. ».
- **Merveilles** (`merveilles.py`, 1 par type pour la v1) :
  - **Antique** (Parthénon @ sterea_ellada) : bonus passif si on tient la province.
  - **Ruine→restaurer** (Colosse de Rhodes @ notio_aigaio) : or+marbre+tours.
  - **Fouille** (Cnossos @ kriti) : or+tours → relique aléatoire.
  - **Construction** (Colisée, dans une ville) : or+marbre+tours, unique au monde.
  - Bonus intégrés (or/recherche/stabilité), **Prestige** cumulé, repères ✦ sur la
    carte, panneau Merveille dans la modale Production. État vivant dans `state["merveilles"]`.

---

## v14 — 5 av. J.-C., 4 factions, stabilité par province + âges

- **Époque 5 av. J.-C.**, 4 factions ANACHRONIQUES (gameplay/UI ; IA = phase 2) :
  Rome/**Néron**, Macédoine/**Alexandre le Grand**, Sparte/**Léonidas** (id `sparte`, nouveau),
  Égypte/**Ptolémée** (id interne `carthage`). Capitales : Latium, Pella, Laconie, Alexandrie.
- **Gouverneurs** : interdits dans la **capitale** (gérée par le dirigeant) ; **plafond**
  débloqué par technos/dogmes (`routes_commerciales`, `droit_romain`, dogme `magistratures`
  → +1 chacun, base 2). Un gouverneur donne +12 de stabilité LOCALE.
- **Stabilité PAR PROVINCE** : chaque province a sa stabilité (dérive vers une cible
  locale), agrégée en une **moyenne nationale** (le « moral » affiché). L'infobulle liste
  les facteurs nationaux + les **provinces les plus instables** (< 45). Révolte = sécession
  de la province dont la stabilité s'effondre (< 25), capitale protégée.
- **Modificateurs** — globaux (empire) : **âge d'or** (moral ≥ 75 ~3 tours, +14) / **âge
  sombre** (≤ 32, −14) avec hystérésis ; **guerre longue** (> 6 tours, −12). Locaux (province) :
  **armée omniprésente** (trop d'unités, jusqu'à −20), **conquête récente** (−18),
  **catastrophes** aléatoires (séisme/peste/sécheresse/émeutes, malus temporaire).

---

## v15 — Carte élargie au sud, tours annuels, production par terrain

- **Carte** : bord sud abaissé (LAT0 29.5 → 23.0) → l'Égypte (vallée du Nil), le
  Levant et le Sahara ont de la place. Monde 1400×1286, ~182 provinces, toujours sans trou.
- **Temps** : `MOIS_PAR_TOUR = 12` → **1 tour = 1 an**. La date avance par années
  (« An 5 av. J.-C. »), traverse l'Histoire bien plus vite. Durées de chantier toujours
  en TOURS (donc en années → réaliste pour les monuments).
- **Production réaliste par TERRAIN** (`classer_terrain` dans build_map + `TERRAIN_PROD`) :
  - `fertile` (Nil, plaine du Pô) : nourriture ×2,4 — vrai grenier.
  - `plaine` : standard.
  - `montagne` (Alpes) : peu de vivres, + pierre.
  - `desert` (Sahara) : quasi stérile, un peu d'or (caravanes/oasis).
- **Rééquilibrage** (testé sur 26 ans, 3 factions) : consommation annuelle relevée
  (pop ×0,11 vivres) et croissance ajustée (min(nn/9, ne/4, 2,5)) → le surplus sert la
  population au lieu de s'accumuler ; l'eau plafonne souvent la croissance (→ aqueducs).
  L'Égypte dispose d'un net avantage vivrier (Nil), conforme à l'Histoire.

---

## v16 — Tours mensuels + avance rapide, durées réelles, frein à l'expansion, fix ville

- **1 tour = 1 mois** (`MOIS_PAR_TOUR=1`), mais on peut **avancer plusieurs tours d'un
  coup** : boutons « Fin de tour », « +3 mois », « +1 an » (endpoint `/api/end-turn?tours=N`
  qui cumule les événements).
- **Durées de chantier réalistes (en mois)** : petits ouvrages 3-6, aqueduc 12 (1 an),
  forum 14, murailles 10 ; merveilles 18-48 (1,5 à 4 ans) ; une **colonie** met ~18 mois
  à prospérer (pacification longue).
- **BUG corrigé — fondation de ville** : le validateur exigeait 500 or + 200 nourriture
  alors que le coût réel est 220 or → l'action était proposée puis refusée. Aligné sur 200 or.
- **Frein à l'expansion en boule de neige** (équilibrage testé sur 144 mois) :
  coût d'annexion **croissant** avec la taille de l'empire (×(1+0,30·n)), **administration**
  (puits d'or ~2,5/province au-delà de 3), et **tension impériale** (−jusqu'à 30 de stabilité
  par province quand l'empire s'étend). Résultat : l'expansion s'auto-limite (~9 provinces
  au lieu de 25+), avec révoltes si on force.
- Production agricole calée sur le terrain (Nil fertile, Sahara stérile), consommation
  mensuelle, croissance plafonnée par l'eau.

---

## v17 — Puits de dépense d'or : corruption, inflation, entretien (point #1 du TODO)

Corrige le surplus d'or de fin de partie (l'or n'explose plus : ~2 500 au lieu de 24 000
sur 144 mois). Voir `TODO.md`.

- **Annexion EXPONENTIELLE** : `COUT_CONQUETE_OR × 1.3^n` (n = nb de provinces).
- **Entretien** (or/mois) : 2/ville + 1/bâtiment + 4/merveille.
- **Corruption** (`_maj_corruption`, % sur le revenu d'or) : ↑ avec taille de l'empire et
  faible stabilité ; ↓ avec gouverneurs, forum/agora, droit romain, magistratures.
- **Inflation** (`_maj_inflation`, %) : monte quand l'or DORT (trésor > 300) → renchérit
  TOUS les coûts (`_cout_inflation`) et érode le trésor ; dépenser la fait redescendre.
- UI : indicateurs **☣ corruption** et **↗ inflation** dans la barre du haut ; le détail
  apparaît dans l'infobulle de l'or (Corruption, Entretien).

---

## Écarts par rapport au cahier des charges

- **Aucun écart fonctionnel.** Les déviations ci-dessus sont des choix
  d'implémentation laissés libres par le cahier (langage front, version des libs,
  bornes de versions, force de la trirème, mécanique de dégradation IA).
- Éléments **hors périmètre Phase 1** (présents en roadmap, partiellement amorcés) :
  système militaire complet, fondation/capture de villes, ressources de luxe &
  commerce, profil joueur dynamique, toutes les conditions de victoire, ères 3-5.
