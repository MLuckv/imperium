# TODO — Imperium

## ⚠️ Points faibles relevés (mis de côté)

Issus de la critique globale après la longue partie de test (v16).

- [x] **Surplus d'or/ressources en fin de partie** — ✅ CORRIGÉ (point #1, voir ci-dessous) :
  corruption + entretien + inflation + annexion exponentielle.
- [ ] **Pas d'ennemis ni d'IA** — l'armée et la diplomatie ne servent presque à rien
  pour l'instant. (Phase 2, volontaire.)
- [ ] **Âges d'or / âge sombre trop rares** — seuils (stab ≥ 75 ou ≤ 32 soutenus 3 tours)
  difficiles à atteindre. À assouplir.
- [ ] **Expansion = surtout annexion** — la population gonfle par conquête bien plus que
  par croissance organique.
- [ ] **Pas de condition de victoire** — le Prestige (merveilles) est prêt à servir de base.
- [ ] **Diplomatie / messagerie en sommeil** — (Phase 2.)

---

## 🔧 Point #1 — Équilibrage économique (à corriger AVANT la phase 2)

Objectif : créer de vrais puits de dépense + rendre la thésaurisation contre-productive,
pour que l'or ne s'accumule plus indéfiniment. Mécaniques à implémenter :

- [x] **Coût d'annexion EXPONENTIEL** — `COUT_CONQUETE_OR × 1.3^n` (n = provinces).
- [x] **Entretien des villes** — 2 or/mois/ville.
- [x] **Entretien des bâtiments et des merveilles** — 1 or/bâtiment, 4 or/merveille.
- [x] **Corruption** (% sur le revenu d'or) — monte avec taille de l'empire + faible
  stabilité ; baisse avec gouverneurs, forum/agora, droit romain, magistratures.
- [x] **Inflation** — monte quand l'or dort (trésor élevé) : renchérit tous les coûts
  (bâtiments, unités, annexion, merveilles) ET érode le trésor. Dépenser la fait baisser.
- [x] Exposer **corruption** (☣) et **inflation** (↗) dans la barre du haut.
- [x] Re-testé sur 144 mois : or final 2 500 (au lieu de 24 000). ✅ RÉSOLU.

**Résultat des tests :** thésaurisation → inflation monte (0→14 % en accumulant 1 000 or) ;
expansion rapide → corruption (25 %) + chute de stabilité → révoltes (la consolidation
devient nécessaire). Petit empire prudent : corruption 0 %, sain.

---

## 🚀 Phase 2 (en cours)

- [ ] **AMÉLIORER LES PERFORMANCES DE L'IA** — objectif **≤ 5 s** par réponse
  (actuellement ~7–15 s selon la verbosité + la richesse du contexte). Pistes : moins de
  tokens générés, contexte/persona allégés, prompt plus court, garder le modèle chaud
  (keep_alive + warmup au démarrage), modèle plus rapide/quantisé, streaming.
- [x] **Conseiller dans l'onglet Diplomatie** — chat IA : point sur le royaume, conseils,
  DIRECTIVES libres → « points » sur la carte (coût/durée décidés par l'IA, en mois).
  Espions opérationnels = vrais renseignements sur la cible. Rébellion bien financée =
  une province NON-capitale ennemie fait sécession / rejoint le joueur (capitale
  imprenable). Sabotage = dégâts. Garde-fous : refus des ordres impossibles/magiques.
- [x] **Dirigeants qui écrivent au joueur d'eux-mêmes** — déclencheurs (manœuvre hostile
  DÉTECTÉE — l'espionnage est furtif et souvent indétecté —, armée trop proche, attaque
  d'un protégé, hostilité, alliance face à un tiers puissant, joueur affaibli) → message
  EN CARACTÈRE + conséquence (réputation, guerre, coalition). **Sans réponse → escalade**
  (menace → ultimatum → guerre) ; **répondre apaise**. Badge sur Diplomatie. Varié.
- [x] **Chronique** — plus de résumé chaque tour (juste les événements marquants) ; au
  PASSAGE D'UNE ANNÉE, belle chronique embellie « livre d'histoire » (Ollama, variée).
- [x] **Combat réel + capitales prenables** — entrer dans une province ennemie = acte de
  guerre → bataille (`resoudre_bataille`). La capitale se défend x2.5 (+murailles) ; sa
  chute = ÉLIMINATION (butin, provinces restantes → anarchie). Seuls les REBELLES ne
  peuvent pas la prendre. L'IA marche vers l'ennemi, mobilise en guerre (+3 unités).
- [x] **Conditions de victoire** — MILITAIRE (éliminer tous les dirigeants),
  DIPLOMATIQUE (10 provinces + paix + alliance + estime des survivants),
  TOURISTIQUE (1200 pts, 1 pt/prestige/mois via les merveilles). Défaite si ta capitale
  tombe. Écran de fin + tourisme 🏺 dans la barre.

### ⚠️ Déséquilibres relevés (partie test jusqu'à victoire, T413)
- [ ] La victoire TOURISTIQUE arrive « par défaut » (~30 ans) si personne ne gagne avant :
  l'Égypte la remporte à chaque simulation. Peut-être exiger 2+ merveilles bâties/restaurées.
- [ ] Le tourisme du Parthénon (antique, passif) rapporte autant que les merveilles bâties.
- [ ] Les guerres IA↔IA finissent presque toujours en paix blanche (les capitales-forteresses
  tiennent) : peu d'éliminations entre IA — le joueur est le principal conquérant possible.
- [ ] L'or du joueur s'accumule encore en toute fin de partie (5 600 au T361) malgré
  l'inflation : il manque un usage tardif (mercenaires ? grands projets ?).
- [ ] Les révoltes limitent l'IA vers ~10-14 provinces (voulu), mais l'Égypte reste
  systématiquement la plus grosse (le Nil est très rentable).
- [x] **Personas historiques des 4 dirigeants** — fiches recherchées (vie/histoire,
  façon de parler, ennemis, alliés, répliques) dans `game/data/leaders/`, utilisées
  comme mémoire par l'IA. Testé : réponses en caractère, anachronismes traités comme
  hérésie, le fil de conversation est tenu (Ollama llama3.1:8b).
- [ ] **Conseiller dans l'onglet Diplomatie** — un conseiller qui guide le joueur.
- [x] **IA adverse qui JOUE** (`ia_faction.py`) — chaque tour : impôts, gouverneurs,
  fondation de villes, chantiers, recrutement, EXPANSION (annexions payées au même tarif
  que le joueur), GUERRES (batailles de provinces, capitale imprenable, paix blanche si
  enlisement), ALLIANCES (Ptolémée↔Alexandre), MERVEILLES (bâtisseurs : Néron, Ptolémée).
  Priorités par dirigeant : Ptolémée → le Nil (terres fertiles) ; Alexandre → conquête
  agressive (rival Sparte) ; Léonidas → armée/défense ; Néron → monuments/économie.
  Les messages de tour racontent les actions RÉELLES. Testé sur 12 ans (plusieurs seeds).
- [ ] Messagerie / diplomatie active (accords, alliances, trahisons appliqués au jeu).
- [ ] Conditions de victoire (prestige culturel, domination militaire…).
- [ ] Feuilles / historique de conversations par IA.
