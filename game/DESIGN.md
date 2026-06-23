# DESIGN.md — Système de design (Civ VI / Age of History)

Direction artistique de l'UI d'**Imperium**, inspirée de **Civilization VI**
(titres gravés, panneaux ornés, lisibilité) et **Age of History** (carte
politique sobre, provinces colorées, frontières nettes). Objectif : **rester
simple** mais épique et antique.

## Palette (définie dans `frontend/src/index.css`, bloc `@theme`)
| Rôle | Token | Hex |
|---|---|---|
| Parchemin (texte clair) | `--color-parchment` | `#f3e9d2` |
| Encre (fonds clairs) | `--color-ink` | `#241d12` |
| Bronze (accents, titres) | `--color-bronze` | `#c9a13b` |
| Or lumineux (highlights) | `--color-gold` | `#e8c267` |
| Terre cuite (action) | `--color-terracotta` | `#b5462f` |
| Abysse / Nuit / Mer | `--color-abyss/night/sea` | `#14110c` / `#1c1813` / `#16222e` |
| Factions | rome `#c0392b` · carthage `#8e44ad` · macedoine `#1e8449` · neutre `#6b7378` |

## Typographie
- **Titres** : `Cinzel` (≈ Trajan, lettrage gravé romain) → `--font-display`.
- **Corps** : `EB Garamond` (serif lisible) → `--font-body`.
- Chargées via Google Fonts (`@import` en tête de `index.css`) avec **fallback
  serif robuste** (Georgia…) : l'UI reste correcte hors-ligne.

## Principes
1. **Fond sombre, accents dorés** — l'or/bronze guide l'œil (titres, action principale).
2. **Hiérarchie gravée** — titres en capitales espacées (`letter-spacing`), corps lisible.
3. **Carte = vedette** — la Méditerranée occupe le centre ; panneaux sobres autour.
4. **Sobriété AoH** — provinces aplats colorés, frontières fines, noms de villes seuls sur la carte.

## Contrat de classes (implémenté dans `index.css`, utilisé par les composants)
- Menu : `.menu-screen` (fond épique + vignette), `.menu-title`, `.menu-subtitle`.
- Structure : `.panel`, `.panel-title`.
- Boutons : `.btn` + `.btn-primary` (or), `.btn-danger` (guerre), `.btn-ghost`, `.btn-sm`.
- Badges : `.chip`, `.chip-war`.
- Cartes d'item : `.card`, `.card-selected`, `.card-disabled`.
- Progression : `.progress` + `.progress-bar` (avancement des chantiers).
- Divers conservés : `.thin-scroll`, `.typing-dots`.

## Carte (`data/map/territories.json`)
- Monde **1200×640** (ratio ~2:1 adapté à la Méditerranée).
- 16 provinces géographiquement positionnées (Hispanie ouest, Italie centre,
  Afrique sud, Grèce/Asie est…), polygones de 8–20 sommets, adjacences réciproques
  (traversées maritimes incluses). Cadrage automatique sur les terres côté rendu.

> Produit par l'agent **DESIGN** (recherche Civ VI / Age of History). Itérations
> futures possibles : coastlines plus détaillées, textures parchemin, icônes d'unités.
