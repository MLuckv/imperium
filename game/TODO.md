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

- [x] **Personas historiques des 4 dirigeants** — fiches recherchées (vie/histoire,
  façon de parler, ennemis, alliés, répliques) dans `game/data/leaders/`, utilisées
  comme mémoire par l'IA. Testé : réponses en caractère, anachronismes traités comme
  hérésie, le fil de conversation est tenu (Ollama llama3.1:8b).
- [ ] **Conseiller dans l'onglet Diplomatie** — un conseiller qui guide le joueur.
- [ ] IA adverse + guerre (conquête de provinces ennemies, batailles).
- [ ] Messagerie / diplomatie active (accords, alliances, trahisons appliqués au jeu).
- [ ] Conditions de victoire (prestige culturel, domination militaire…).
- [ ] Feuilles / historique de conversations par IA.
