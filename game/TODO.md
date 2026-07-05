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

- [x] **Benchmark modèles** — qwen2.5:7b RETENU (compréhension des camps correcte,
  français fluide, JSON fiable) ; llama3.1:8b supprimé. Surcharge : `IMPERIUM_MODELE`.
- [x] **Fiches dirigeants v2 (« ressentis »)** — renommées (rome_neron, macedoine_alexandre,
  carthage_ptolemee, sparte_leonidas), 1re personne, SANS dates ni mort (simulation
  anachronique assumée), ressentis humains envers chaque rival (jalousie, tendresse,
  mépris…), réactions (flatterie/menace/trahison/offres), liens style Obsidian.
  Phrases prédéfinies reléguées au repli hors-ligne uniquement.
- [x] **Vitesse chat** — STREAMING : les mots apparaissent dès ~2-6 s (1er message d'un
  fil : ~12-15 s à cause du préchargement, puis ~5-7 s) ; prompt compressé 6154 → ~3150
  caractères SANS perte de cohérence (batterie de tests avant/après) ; chronique annuelle
  et world_state 100 % CODE → fin de tour SANS AUCUN appel IA (+1 an : 0,0 s).
  ⚠ Le MODE ÉCONOMIE D'ÉNERGIE macOS est ACTIVÉ et divise la vitesse par ~2 :
  le désactiver (Réglages Système → Batterie) ≈ premiers mots en ~2-3 s.
- [x] **Conversations → effets sur la carte** — vérifié de bout en bout : pacte de
  non-agression négocié par chat (Ptolémée a exigé des garanties, accepté l'or) →
  traité inscrit + 80 or réellement transférés à la fin du tour.
- [x] **Glissements quasi éliminés** — température 0,72, règles resserrées, coupe
  anti-alphabets étrangers (qwen glissait en chinois : corrigé net, flux + stockage),
  fin à la dernière phrase complète. Résiduel : rare mot moderne (« chèque ») — limite 7B.
- [ ] **Événements aléatoires** (étape suivante convenue).
  FAIT : tours de jeu instantanés (mode rapide multi-tours — +1 an : 47 s → 10 s).
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

### ✅ Déséquilibres corrigés (v19)
- [x] Victoire touristique passive → merveille HÉRITÉE (antique) = 1 pt/mois, BÂTIE ou
  RESTAURÉE = plein prestige. Retesté : plus aucune victoire par défaut à T300.
- [x] Guerres IA↔IA en paix blanche → paix SEULEMENT si impasse (forces proches) +
  SIÈGE avec attrition quand il ne reste que la capitale ; seuils de guerre assouplis.
- [x] Or de fin de partie → MERCENAIRES (160 or, 0 pop, 0 fer), joueur + IA en guerre.
- [x] Conseils génériques en repli → diagnostic RÉEL (stabilité + provinces instables,
  vivres, eau, or, armée, inflation, corruption) avec recommandations concrètes.
- [x] Égypte dominante → expansion 0,6 → 0,5 (le Nil reste un avantage, assumé).
- [x] Roleplay : le dirigeant connaît SA situation (guerres, alliances, opinion de toi),
  négocie selon SES intérêts (conditions/marchandage/refus motivé), consigne
  anti-contresens (alliance CONTRE X ≠ AVEC X — bug Léonidas corrigé).
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
