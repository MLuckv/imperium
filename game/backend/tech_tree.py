"""Arbre technologique : chargement, prérequis, progression, effets.

Consomme `data/tech_tree.json` (produit par l'agent DATA, NON modifié ici).
Les effets de jeu déductibles de chaque techno sont calculés ici sous forme de
modificateurs numériques appliqués par le moteur (game_engine).
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

# game/ = parent du dossier backend/ (résolution robuste, indépendante du cwd).
RACINE = Path(__file__).resolve().parent.parent
CHEMIN_TECH = RACINE / "data" / "tech_tree.json"


@lru_cache(maxsize=1)
def charger_tech_tree() -> dict:
    """Charge et met en cache le contenu brut de tech_tree.json."""
    with open(CHEMIN_TECH, encoding="utf-8") as f:
        return json.load(f)


def liste_technologies() -> list[dict]:
    return charger_tech_tree().get("technologies", [])


def liste_eres() -> list[dict]:
    return charger_tech_tree().get("eres", [])


def tech_par_id(tech_id: str) -> dict | None:
    for t in liste_technologies():
        if t["id"] == tech_id:
            return t
    return None


def cout_recherche(tech_id: str) -> int:
    t = tech_par_id(tech_id)
    return int(t["cout_recherche"]) if t else 100


def prerequis_remplis(tech_id: str, technologies_acquises: list[str]) -> bool:
    """Vrai si tous les prérequis de `tech_id` sont déjà acquis."""
    t = tech_par_id(tech_id)
    if t is None:
        return False
    return all(p in technologies_acquises for p in t.get("prerequis", []))


def technologies_disponibles(technologies_acquises: list[str]) -> list[dict]:
    """Technos recherchables : non acquises et dont les prérequis sont remplis."""
    dispo = []
    for t in liste_technologies():
        if t["id"] in technologies_acquises:
            continue
        if prerequis_remplis(t["id"], technologies_acquises):
            dispo.append(t)
    return dispo


def peut_rechercher(tech_id: str, technologies_acquises: list[str]) -> tuple[bool, str]:
    """Vérifie qu'une techno peut être lancée. Retourne (ok, raison)."""
    if tech_par_id(tech_id) is None:
        return False, f"Technologie inconnue : {tech_id}."
    if tech_id in technologies_acquises:
        return False, f"Technologie déjà acquise : {tech_id}."
    if not prerequis_remplis(tech_id, technologies_acquises):
        t = tech_par_id(tech_id)
        manquants = [p for p in t.get("prerequis", []) if p not in technologies_acquises]
        return False, f"Prérequis manquants : {', '.join(manquants)}."
    return True, ""


def effets_technologies(technologies_acquises: list[str]) -> dict[str, float]:
    """Agrège les modificateurs numériques issus des technologies acquises.

    Renvoie un dict de multiplicateurs/bonus utilisés par le moteur :
      - or_pct                : bonus multiplicatif sur l'or produit
      - nourriture_pct        : bonus multiplicatif sur la nourriture produite
      - combat_infanterie_pct : bonus de combat pour l'infanterie
      - force_navale_pct      : bonus de force navale
      - stabilite_bonus       : bonus de stabilité par tour
      - recherche_pct         : bonus de vitesse de recherche
      - voir_puissance        : 1.0 si l'espionnage révèle la puissance réelle
      - cout_muraille_pct     : réduction du coût des murailles
      - cout_aqueduc_pct      : réduction du coût des aqueducs
    """
    eff: dict[str, float] = {
        "or_pct": 0.0,
        "nourriture_pct": 0.0,
        "combat_infanterie_pct": 0.0,
        "force_navale_pct": 0.0,
        "stabilite_bonus": 0.0,
        "recherche_pct": 0.0,
        "voir_puissance": 0.0,
        "cout_muraille_pct": 0.0,
        "cout_aqueduc_pct": 0.0,
        "gouverneurs_bonus": 0.0,
    }
    acquis = set(technologies_acquises)
    # Économie
    if "routes_commerciales" in acquis:
        eff["or_pct"] += 0.20
    if "monnaie_frappee" in acquis:
        eff["or_pct"] += 0.10
    if "agriculture_intensive" in acquis:
        eff["nourriture_pct"] += 0.25
    if "ingenierie_hydraulique" in acquis:
        eff["cout_aqueduc_pct"] += 0.30
    # Militaire
    if "legion_tactique" in acquis:
        eff["combat_infanterie_pct"] += 0.15
    if "marine_guerre" in acquis:
        eff["force_navale_pct"] += 0.20
    # Administration : chaque avancée administrative autorise un gouverneur de plus.
    if "routes_commerciales" in acquis:
        eff["gouverneurs_bonus"] += 1
    if "droit_romain" in acquis:
        eff["gouverneurs_bonus"] += 1
    # Culture
    if "droit_romain" in acquis:
        eff["stabilite_bonus"] += 2.0
    if "philosophie_grecque" in acquis:
        eff["recherche_pct"] += 0.15
    if "jeux_publics" in acquis:
        eff["stabilite_bonus"] += 1.0
    if "reseau_espionnage" in acquis:
        eff["voir_puissance"] = 1.0
    # Construction
    if "architecture_pierre" in acquis:
        eff["cout_muraille_pct"] += 0.25
    return eff


def progresser_recherche(
    recherche_en_cours: dict | None,
    technologies_acquises: list[str],
    points_recherche: float,
) -> tuple[dict | None, str | None]:
    """Avance la recherche en cours.

    Retourne (recherche_maj, tech_terminee_id_ou_None). Si la recherche est
    terminée, l'appelant ajoute la techno aux acquises et choisit la suivante.
    """
    if not recherche_en_cours:
        return recherche_en_cours, None
    tech_id = recherche_en_cours.get("tech")
    if not tech_id:
        return recherche_en_cours, None
    cout = int(recherche_en_cours.get("cout") or cout_recherche(tech_id))
    progres = float(recherche_en_cours.get("progres", 0)) + points_recherche
    if progres >= cout:
        return None, tech_id
    recherche_en_cours = dict(recherche_en_cours)
    recherche_en_cours["progres"] = round(progres, 1)
    recherche_en_cours["cout"] = cout
    return recherche_en_cours, None


def choisir_prochaine_recherche(technologies_acquises: list[str]) -> dict | None:
    """Choisit déterministiquement la prochaine techno la moins chère disponible."""
    dispo = technologies_disponibles(technologies_acquises)
    if not dispo:
        return None
    dispo.sort(key=lambda t: (int(t["cout_recherche"]), t["id"]))
    cible = dispo[0]
    return {"tech": cible["id"], "progres": 0, "cout": int(cible["cout_recherche"])}
