"""Moteur de jeu : tours, production, croissance, IA, conflits, victoire.

Le GameState manipulé est un dict conforme à ARCHITECTURE §3 (round-trip JSON).
Les chemins data/saves sont résolus depuis game/ (indépendant du cwd).

Responsabilités :
- new_game : construit l'état initial depuis starting_positions.json + territoires.
- end_turn : production des ressources (§7), croissance population, moral,
  recherche, événements aléatoires (§16), décisions IA (ai_director),
  résolution simple des conflits, MAJ world_state tous les 6 tours.
- application d'actions validées (recruter, construire, rechercher, diplomatie…).
- calcul puissance (§10.2), stabilité (§10.3), conditions de victoire (§17).
"""

from __future__ import annotations

import json
import random
from functools import lru_cache
from pathlib import Path

import tech_tree
import world_state as ws
import ai_director
import conversations
import merveilles
from models.unit import (
    force_unite, COUTS_UNITES, TECH_REQUISE_UNITE, COUT_POP_UNITES, COUT_RES_UNITES,
)
from models.city import (
    COUT_BATIMENTS, EFFETS_BATIMENTS, STABILITE_BATIMENTS, DUREE_BATIMENTS,
    PROD_BATIMENTS, COUT_RES_BATIMENTS,
)
from models.country import META_FACTIONS, RESSOURCES_BASE

# Taux d'imposition : impact sur l'or (depuis la population) et la stabilité (cible).
IMPOTS = {
    "bas":       {"or_pop": 0.20, "stab": +10, "nom": "Bas"},
    "normal":    {"or_pop": 0.40, "stab": 0,   "nom": "Normal"},
    "eleve":     {"or_pop": 0.65, "stab": -10, "nom": "Élevé"},
    "oppressif": {"or_pop": 0.95, "stab": -22, "nom": "Oppressif"},
}

# Entretien de l'armée, par effectif et par tour (cf. demande v3) :
# une armée coûte de l'or, consomme nourriture et eau, et pèse sur la stabilité.
ENTRETIEN_OR = 1.0
ENTRETIEN_NOURRITURE = 0.5
ENTRETIEN_EAU = 0.3

# 1 tour = 1 mois. Le joueur peut avancer plusieurs tours d'un coup (1 mois / 3 mois /
# 1 an) via l'option de fin de tour ; les durées de chantier sont en MOIS (réalistes).
MOIS_PAR_TOUR = 1

# Expansion : conquérir/coloniser coûte CHER et déstabilise (cf. demande v6).
COUT_CONQUETE_OR = 90          # annexer une province neutre (or)
PENALITE_STAB_CONQUETE = 8     # la province conquise est agitée (stabilité nationale)
COUT_FONDER_VILLE_OR = 220     # fonder une nouvelle ville (or)
POP_NOUVELLE_VILLE = 6         # colons transférés vers la nouvelle ville
PENALITE_STAB_VILLE = 6        # une colonie naissante pèse sur la stabilité
TECH_NAVIGATION = "navigation_maritime"  # requise pour traverser la mer

# game/ = parent de backend/.
RACINE = Path(__file__).resolve().parent.parent
DOSSIER_DATA = RACINE / "data"
CHEMIN_STARTING = DOSSIER_DATA / "map" / "starting_positions.json"
CHEMIN_TERRITOIRES = DOSSIER_DATA / "map" / "territories.json"
CHEMIN_EVENTS = DOSSIER_DATA / "world_events.json"

# Base MODESTE du centre-ville : un peu d'or/nourriture/eau pour survivre, mais
# AUCUNE pierre/bois/fer (il faut bâtir carrière/scierie/mine pour en produire).
PROD_BASE_VILLE = {
    "or": 6, "nourriture": 4, "eau": 3,
}
# Bonus de production lié aux ressources d'un territoire (gisements naturels).
PROD_TERRITOIRE = {
    "or": {"or": 4}, "vin": {"or": 2}, "ivoire": {"or": 3}, "epices": {"or": 3},
    "grain_egyptien": {"nourriture": 4},
}

# Coût pour organiser des Jeux (cf. §11.1) et son bonus de stabilité.
COUT_JEUX = 150
BONUS_STABILITE_JEUX = 15


# =====================================================================
#  Chargement des données statiques
# =====================================================================
@lru_cache(maxsize=1)
def _starting_positions() -> dict:
    return json.loads(CHEMIN_STARTING.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def charger_territoires() -> dict:
    return json.loads(CHEMIN_TERRITOIRES.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _world_events() -> dict:
    return json.loads(CHEMIN_EVENTS.read_text(encoding="utf-8"))


def _territoires_par_faction() -> dict[str, list[str]]:
    """Map faction -> liste d'ids de territoires possédés (depuis territories.json)."""
    res: dict[str, list[str]] = {}
    for t in charger_territoires().get("territoires", []):
        fac = t.get("faction")
        if fac:
            res.setdefault(fac, []).append(t["id"])
    return res


def _ressources_territoire(territoire_id: str) -> list[str]:
    for t in charger_territoires().get("territoires", []):
        if t["id"] == territoire_id:
            return t.get("ressources", [])
    return []


# Production agricole/naturelle par TYPE de terrain (réaliste). Le Nil (fertile) est
# un grenier, le Sahara (désert) est stérile mais traversé de caravanes, etc.
TERRAIN_PROD = {
    "fertile": {"nourriture": 1.4, "eau": 0.8},
    "plaine": {"nourriture": 0.8, "eau": 0.6},
    "montagne": {"nourriture": 0.35, "eau": 0.35, "pierre": 0.4},
    "desert": {"nourriture": 0.1, "eau": 0.1, "or": 0.4},
}

def _terrain_territoire(territoire_id: str) -> str:
    for t in charger_territoires().get("territoires", []):
        if t["id"] == territoire_id:
            return t.get("terrain", "plaine")
    return "plaine"


def _adjacents(territoire_id: str) -> list[str]:
    for t in charger_territoires().get("territoires", []):
        if t["id"] == territoire_id:
            return t.get("adjacents", [])
    return []


def _adjacents_mer(territoire_id: str) -> list[str]:
    for t in charger_territoires().get("territoires", []):
        if t["id"] == territoire_id:
            return t.get("adjacents_mer", [])
    return []


def _nom_territoire(territoire_id: str) -> str:
    for t in charger_territoires().get("territoires", []):
        if t["id"] == territoire_id:
            return t.get("nom", territoire_id)
    return territoire_id


def _population_territoire(territoire_id: str) -> int:
    """Population prédéfinie d'une province (gagnée lors de l'annexion)."""
    for t in charger_territoires().get("territoires", []):
        if t["id"] == territoire_id:
            return int(t.get("population", 6))
    return 6


def _proprietaire(state: dict, territoire_id: str) -> str | None:
    """Faction possédant ce territoire (None = neutre)."""
    for fid, p in state.get("pays", {}).items():
        if territoire_id in p.get("territoires", []):
            return fid
    return None


def _capitale_faction(faction: str) -> str | None:
    for t in charger_territoires().get("territoires", []):
        if t.get("faction") == faction and t.get("capitale"):
            return t["id"]
    return None


# =====================================================================
#  Nouvelle partie
# =====================================================================
def new_game(joueur_pays: str = "rome") -> dict:
    """Construit le GameState initial depuis starting_positions.json."""
    if joueur_pays not in META_FACTIONS:
        joueur_pays = "rome"

    start = _starting_positions()
    terr_map = _territoires_par_faction()

    pays: dict[str, dict] = {}
    for fid, base in start.items():
        meta = META_FACTIONS.get(fid, {})
        territoires = terr_map.get(fid, [])
        p = {
            "id": fid,
            "nom": meta.get("nom", fid.capitalize()),
            "couleur": meta.get("couleur", "#7f8c8d"),
            "est_joueur": (fid == joueur_pays),
            "ressources": dict(base.get("ressources", {})),
            "ressources_luxe": dict(base.get("ressources_luxe", {})),
            "production": {},
            "villes": [dict(v) for v in base.get("villes", [])],
            "unites": [dict(u) for u in base.get("unites", [])],
            "territoires": list(territoires),
            "technologies": list(base.get("technologies", [])),
            "recherche_en_cours": None,
            "reputation": dict(base.get("reputation", {})),
            "stabilite": int(base.get("stabilite", 70)),
            # Modificateurs dynamiques actifs (issus d'événements, durée limitée).
            "modificateurs": [],
            "dogmes": [],  # dogmes adoptés (arbre de dogmes)
            "impots": "normal",  # niveau d'imposition (cf. IMPOTS)
        }
        # Choisit une première recherche déterministe.
        p["recherche_en_cours"] = tech_tree.choisir_prochaine_recherche(p["technologies"])
        # Calcule la production initiale + sa ventilation par source.
        _maj_production_detail(p)
        # Stabilité PAR PROVINCE (la capitale au départ).
        p["prov_stab"] = {tid: 60.0 for tid in p.get("territoires", [])}
        p["age"] = None; p["age_compteur"] = 0; p["tours_guerre"] = 0; p["prov_modif"] = {}
        p["corruption"] = 0.0; p["inflation"] = 0.0
        p["projets"] = []  # entreprises libres ordonnées via le conseiller
        pays[fid] = p

    state = {
        "meta": {
            "date_jeu": "5-03", "tour": 1, "annee": -5, "mois": 3,
            "joueur_pays": joueur_pays, "ere": "republique",
        },
        "pays": pays,
        "merveilles": merveilles.etat_initial(),
        "diplomatie": {"traites_actifs": [], "guerres_actives": []},
        "historique_actions": [
            {"tour": 1, "acteur": joueur_pays,
             "texte": f"Début de la partie : {pays[joueur_pays]['nom']} entre dans l'Histoire.",
             "resultat": "Partie initialisée."}
        ],
        "evenements_tour": [],
        "messages_diplomatiques": [],
        # Fils de discussion privés par IA (cf. conversations.py) + résumé du tour.
        "conversations": {},
        "resume_tour": "",
        "accords_recents": [],
    }
    for p in pays.values():
        p["merveilles_effet"] = merveilles.bonus_actif(p, state)
        calculer_stabilite(p, state)
        _maj_corruption(p)
    conversations.reinitialiser(state, list(pays.keys()))
    _recalculer_puissances(state)
    ws.sauver_etat_courant(state)
    # Écrit un world_state initial daté SANS écraser celui fourni par l'agent
    # DATA s'il existe déjà (préserve la chronique d'ouverture rédigée à la main).
    ws.ecrire_world_state(state, ecraser=False)
    return state


# =====================================================================
#  Production des ressources (§7)
# =====================================================================
CHEMIN_DOGMES = DOSSIER_DATA / "dogmes.json"
COUT_GOUVERNEUR = 100


@lru_cache(maxsize=1)
def charger_dogmes() -> dict:
    return json.loads(CHEMIN_DOGMES.read_text(encoding="utf-8"))


def dogme_par_id(did: str) -> dict | None:
    for d in charger_dogmes().get("dogmes", []):
        if d["id"] == did:
            return d
    return None


def effets_dogmes(dogmes: list[str]) -> dict[str, float]:
    """Modificateurs cumulés des dogmes adoptés (stabilité, or, coûts d'expansion)."""
    eff = {"stabilite_bonus": 0.0, "or_pct": 0.0, "cout_ville_pct": 0.0,
           "cout_annexion_pct": 0.0, "gouverneurs_bonus": 0}
    s = set(dogmes or [])
    if "magistratures" in s: eff["stabilite_bonus"] += 3; eff["gouverneurs_bonus"] += 1
    if "code_lois" in s: eff["stabilite_bonus"] += 3; eff["cout_annexion_pct"] += 0.15
    if "senat" in s: eff["or_pct"] += 0.06
    if "culte_etat" in s: eff["stabilite_bonus"] += 2
    if "grands_temples" in s: eff["or_pct"] += 0.10
    if "pretrise" in s: eff["stabilite_bonus"] += 3
    if "colonisation" in s: eff["cout_ville_pct"] += 0.35
    if "limes" in s: eff["stabilite_bonus"] += 3
    if "voies_imperiales" in s: eff["or_pct"] += 0.06
    return eff


def _en_guerre(pays_id: str, state: dict | None) -> bool:
    """Vrai si `pays_id` a au moins une guerre active."""
    if not state:
        return False
    for g in state.get("diplomatie", {}).get("guerres_actives", []):
        if pays_id in ({g.get("a"), g.get("b")} | {g.get("attaquant"), g.get("defenseur")}):
            return True
    return False


def _modificateurs_production(pays: dict) -> dict[str, dict[str, float]]:
    """Agrège les modificateurs dynamiques actifs en {ressource: {mult, flat}}.

    Un modificateur (issu d'un événement) a la forme :
      {"ressource": "nourriture", "facteur": 0.3, "tours_restants": 2, "source": "..."}
    où `facteur` est un bonus multiplicatif (+0.3 = +30%) et/ou `valeur` un ajout fixe.
    """
    agg: dict[str, dict[str, float]] = {}
    for mod in pays.get("modificateurs", []):
        if mod.get("tours_restants", 0) <= 0:
            continue
        res = mod.get("ressource")
        if not res:
            continue
        slot = agg.setdefault(res, {"mult": 0.0, "flat": 0.0})
        slot["mult"] += float(mod.get("facteur", 0) or 0)
        slot["flat"] += float(mod.get("valeur", 0) or 0)
    return agg


def _facteur_stabilite(stabilite: int) -> float:
    """Multiplicateur de production lié à la stabilité (0.60 → 1.15)."""
    s = max(0, min(100, stabilite))
    return round(0.60 + 0.55 * (s / 100.0), 3)


def _ajouter_modificateur(pays: dict, ressource: str, facteur: float = 0.0,
                          valeur: float = 0.0, tours: int = 2,
                          source: str = "Événement") -> None:
    """Ajoute un modificateur de production temporaire à une faction."""
    pays.setdefault("modificateurs", []).append({
        "ressource": ressource, "facteur": facteur, "valeur": valeur,
        "tours_restants": int(tours), "source": source,
    })


def _decrementer_modificateurs(pays: dict) -> None:
    """Décrémente la durée des modificateurs et purge ceux expirés."""
    actifs = []
    for mod in pays.get("modificateurs", []):
        mod["tours_restants"] = int(mod.get("tours_restants", 0)) - 1
        if mod["tours_restants"] > 0:
            actifs.append(mod)
    pays["modificateurs"] = actifs


def _avancer_constructions(pays: dict, evenements: list) -> None:
    """Fait avancer les chantiers d'un tour ; livre les bâtiments terminés."""
    for ville in pays.get("villes", []):
        chantier = ville.get("construction")
        if not chantier:
            continue
        chantier["tours_restants"] = int(chantier.get("tours_restants", 0)) - 1
        if chantier["tours_restants"] <= 0:
            bat = chantier.get("batiment")
            if bat and bat not in ville.get("batiments", []):
                ville.setdefault("batiments", []).append(bat)
                if bat == "murailles":
                    ville["fortifications"] = ville.get("fortifications", 0) + 1
            ville["construction"] = None
            evenements.append({
                "type": "construction", "faction": pays["id"],
                "texte": f"{ville.get('nom')} achève la construction : "
                         f"{_nom_batiment(bat)}.",
            })


def _nom_batiment(bat_id: str) -> str:
    from models.city import CATALOGUE_BATIMENTS
    for b in CATALOGUE_BATIMENTS:
        if b["id"] == bat_id:
            return b["nom"]
    return bat_id or "bâtiment"


def _reset_mouvements(pays: dict) -> None:
    """Réinitialise le droit de déplacement des unités (1 mouvement/tour)."""
    for u in pays.get("unites", []):
        u["a_bouge"] = False


def _calculer_production(pays: dict, state: dict | None = None,
                         details: dict | None = None) -> dict[str, float]:
    """Production par tour de chaque ressource (DYNAMIQUE).

    Dépend de : bâtiments, ressources de territoires, technologies, population,
    STABILITÉ, ÉVÉNEMENTS en cours et état de GUERRE. Si `details` est fourni, il
    est rempli avec la ventilation par source {ressource: [{source, val}]} (pour
    l'infobulle des ressources).
    """
    eff = tech_tree.effets_technologies(pays.get("technologies", []))
    prod: dict[str, float] = {k: 0.0 for k in ("or", "nourriture", "eau", "pierre", "bois", "fer")}
    prod["population"] = 0.0
    pop = pays.get("ressources", {}).get("population", 0)

    def note(res, source, v):
        if details is not None and abs(v) >= 0.05:
            details.setdefault(res, []).append({"source": source, "val": round(v, 1)})

    villes = [v for v in pays.get("villes", []) if v.get("pacification", 0) <= 0]

    # 1) Base modeste du centre-ville (or/nourriture/eau).
    base = {}
    for v in villes:
        for res, val in PROD_BASE_VILLE.items():
            base[res] = base.get(res, 0) + val
    for res, v in base.items():
        prod[res] += v; note(res, "Villes", v)

    # 2) IMPÔTS : l'or est prélevé sur la population (taux choisi par le joueur).
    imp = IMPOTS.get(pays.get("impots", "normal"), IMPOTS["normal"])
    or_imp = pop * imp["or_pop"]
    if or_imp:
        prod["or"] += or_imp; note("or", f"Impôts ({imp['nom']})", or_imp)

    # 3) PRODUCTION FIXE des bâtiments d'extraction (ferme, puits, mine, scierie…).
    flat = {}
    for v in villes:
        for bat in v.get("batiments", []):
            for res, val in PROD_BATIMENTS.get(bat, {}).items():
                flat[res] = flat.get(res, 0) + val
    for res, v in flat.items():
        prod[res] += v; note(res, "Bâtiments", v)

    # 4) Gisements naturels des territoires + léger rendement des provinces.
    terr_b = {}
    for tid in pays.get("territoires", []):
        for r in _ressources_territoire(tid):
            for cible, val in PROD_TERRITOIRE.get(r, {}).items():
                terr_b[cible] = terr_b.get(cible, 0) + val
    for res, v in terr_b.items():
        prod[res] += v; note(res, "Territoires", v)
    # Rendement NATUREL de chaque province selon son TERRAIN (Nil fertile, désert
    # stérile, montagne pierreuse…) — production réaliste.
    tf = te = tpierre = tor = 0.0
    for tid in pays.get("territoires", []):
        ti = TERRAIN_PROD.get(_terrain_territoire(tid), TERRAIN_PROD["plaine"])
        tf += ti.get("nourriture", 0); te += ti.get("eau", 0)
        tpierre += ti.get("pierre", 0); tor += ti.get("or", 0)
    if tf: prod["nourriture"] += tf; note("nourriture", "Provinces (terrain)", tf)
    if te: prod["eau"] += te; note("eau", "Provinces (terrain)", te)
    if tpierre: prod["pierre"] += tpierre; note("pierre", "Reliefs", tpierre)
    if tor: prod["or"] += tor; note("or", "Oasis & caravanes", tor)

    # 5) Bonus MULTIPLICATIFS des bâtiments (marché, grenier, forum…).
    pct = {}
    for v in villes:
        for bat in v.get("batiments", []):
            for res, p in EFFETS_BATIMENTS.get(bat, {}).items():
                pct[res] = pct.get(res, 0) + p
    for res, p in pct.items():
        d = prod[res] * p
        if d: prod[res] += d; note(res, "Bâtiments (%)", d)

    # 6) Technologies + dogmes (or/nourriture).
    for res, key in (("or", "or_pct"), ("nourriture", "nourriture_pct")):
        d = prod[res] * eff.get(key, 0)
        if d: prod[res] += d; note(res, "Technologies", d)
    deff = effets_dogmes(pays.get("dogmes", []))
    if deff["or_pct"]:
        d = prod["or"] * deff["or_pct"]; prod["or"] += d; note("or", "Dogmes", d)

    # 6b) MERVEILLES : bonus plats (or/nourriture/eau) des merveilles actives.
    me = pays.get("merveilles_effet", {})
    for res in ("or", "nourriture", "eau"):
        if me.get(res):
            prod[res] += me[res]; note(res, "Merveilles", me[res])

    # 7) Facteur de STABILITÉ.
    fstab = _facteur_stabilite(pays.get("stabilite", 70))
    for res in ("or", "nourriture", "pierre", "bois", "fer"):
        d = prod[res] * (fstab - 1)
        if d: prod[res] += d; note(res, f"Stabilité (×{fstab})", d)

    # 8) Économie de guerre + événements.
    if _en_guerre(pays.get("id", ""), state):
        d = prod["or"] * -0.15; prod["or"] += d; note("or", "Guerre", d)
    for res, slot in _modificateurs_production(pays).items():
        if res in prod:
            d = prod[res] * slot["mult"] + slot["flat"]
            if d: prod[res] += d; note(res, "Événements", d)

    # 9) CONSOMMATION nourriture/eau = population + armée (cf. demande).
    # 9) Consommation MENSUELLE : population + armée.
    nb_eff = sum(u.get("effectif", 1) for u in pays.get("unites", []))
    conso_n = pop * 0.07 + nb_eff * ENTRETIEN_NOURRITURE
    conso_e = pop * 0.05 + nb_eff * ENTRETIEN_EAU
    prod["nourriture"] -= conso_n; note("nourriture", "Consommation (pop + armée)", -conso_n)
    prod["eau"] -= conso_e; note("eau", "Consommation (pop + armée)", -conso_e)
    if nb_eff:
        prod["or"] -= nb_eff * ENTRETIEN_OR; note("or", "Solde de l'armée", -nb_eff * ENTRETIEN_OR)
    # CORRUPTION : ponctionne le revenu d'or (skim sur impôts/commerce).
    corr = pays.get("corruption", 0)
    if corr and prod["or"] > 0:
        d = -prod["or"] * corr / 100.0; prod["or"] += d; note("or", f"Corruption ({int(corr)}%)", d)
    # ENTRETIEN : villes + bâtiments + merveilles (les monuments coûtent cher à tenir).
    nb_villes = len(pays.get("villes", []))
    nb_bat = sum(len(v.get("batiments", [])) for v in pays.get("villes", []))
    nb_merv = pays.get("merveilles_effet", {}).get("nb", 0)
    upkeep = nb_villes * 2.0 + nb_bat * 1.0 + nb_merv * 4.0
    if upkeep:
        prod["or"] -= upkeep; note("or", "Entretien (villes/bâtiments/merveilles)", -upkeep)

    # 10) Population : croît (par mois) avec le surplus de nourriture/eau ; DÉCLINE en
    # cas de famine. L'eau plafonne souvent la croissance (→ puits/aqueducs).
    nn, ne = prod["nourriture"], prod["eau"]
    if nn > 0 and ne > 0:
        prod["population"] = round(min(nn / 14.0, ne / 6.0, 1.0), 2)
        note("population", "Croissance", prod["population"])
    elif nn < 0:
        prod["population"] = round(max(nn / 12.0, -2.0), 2)
        note("population", "Famine", prod["population"])
    else:
        prod["population"] = 0.0

    return {k: round(v, 1) for k, v in prod.items()}


def _maj_production_detail(pays: dict, state: dict | None = None) -> None:
    """Recalcule la production ET stocke la ventilation par source."""
    details: dict = {}
    pays["production"] = _calculer_production(pays, state, details)
    pays["production_detail"] = details


def _appliquer_production(pays: dict, state: dict | None = None) -> None:
    """Ajoute la production aux ressources et fait croître la population."""
    prod = _calculer_production(pays, state)
    pays["production"] = prod
    res = pays.setdefault("ressources", {})
    for k, v in prod.items():
        if k == "population":
            continue
        # Stock plancher à 0 : pas de stock négatif (l'entretien impayé pèse
        # plutôt sur la stabilité, cf. calculer_stabilite).
        res[k] = max(0.0, round(res.get(k, 0) + v, 1))
    # INFLATION : l'or thésaurisé perd de sa valeur (incite à dépenser).
    infl = pays.get("inflation", 0.0)
    if infl > 5 and res.get("or", 0) > 0:
        res["or"] = max(0.0, round(res["or"] * (1 - infl / 100.0 * 0.035), 1))
    # Croissance de la population globale et des villes.
    croissance = prod.get("population", 0)
    if croissance:
        res["population"] = round(res.get("population", 0) + croissance, 1)
        # Répartit la croissance sur les villes (proportionnel).
        villes = [v for v in pays.get("villes", []) if v.get("pacification", 0) <= 0]
        if villes:
            part = croissance / len(villes)
            for v in villes:
                v["population"] = int(round(v.get("population", 0) + part))


# =====================================================================
#  Moral, stabilité, recherche
# =====================================================================
def _maj_moral(pays: dict) -> None:
    """Le moral des unités remonte lentement vers 100 en temps de paix."""
    for u in pays.get("unites", []):
        m = u.get("moral", 100)
        if m < 100:
            u["moral"] = min(100, m + 5)


BASE_GOUVERNEURS = 2


def _max_gouverneurs(pays: dict) -> int:
    """Nombre max de gouverneurs (capitale exclue), débloqué par technos/dogmes."""
    tb = tech_tree.effets_technologies(pays.get("technologies", [])).get("gouverneurs_bonus", 0)
    db = effets_dogmes(pays.get("dogmes", [])).get("gouverneurs_bonus", 0)
    return BASE_GOUVERNEURS + int(tb) + int(db)


def _base_stab_nationale(pays: dict, state: dict | None) -> tuple[float, list[dict]]:
    """Composante de stabilité PARTAGÉE par toutes les provinces + facteurs (tooltip)."""
    facteurs = []
    def f(label, v):
        if v: facteurs.append({"source": label, "val": int(v)})
    c = 50.0; f("Base", 50)
    imp = IMPOTS.get(pays.get("impots", "normal"), IMPOTS["normal"])
    c += imp["stab"]; f(f"Impôts ({imp['nom']})", imp["stab"])
    tb = tech_tree.effets_technologies(pays.get("technologies", [])).get("stabilite_bonus", 0)
    c += tb; f("Technologies", tb)
    db = effets_dogmes(pays.get("dogmes", [])).get("stabilite_bonus", 0)
    c += db; f("Dogmes", db)
    mb = pays.get("merveilles_effet", {}).get("stabilite", 0)
    c += mb; f("Merveilles", mb)
    if pays.get("ressources_luxe", {}).get("vin", 0) > 0:
        c += 2; f("Vin", 2)
    prod = pays.get("production", {}); res = pays.get("ressources", {})
    if prod.get("nourriture", 0) < 0:
        c -= 12; f("Famine", -12)
    if res.get("or", 0) <= 0 and prod.get("or", 0) < 0:
        c -= 8; f("Trésor vide", -8)
    tg = pays.get("tours_guerre", 0)
    if tg > 6:
        c -= 12; f("Guerre longue", -12)
    elif tg > 0:
        c -= 4; f("Guerre", -4)
    age = pays.get("age")
    if age == "or":
        c += 14; f("Âge d'or", 14)
    elif age == "sombre":
        c -= 14; f("Âge sombre", -14)
    return c, facteurs


def _cible_province(pays: dict, tid: str, base_nat: float,
                    upt: dict, cap_terr: str | None) -> float:
    """Cible de stabilité d'UNE province : base nationale + facteurs LOCAUX."""
    c = base_nat
    # Tension d'un empire étendu : au-delà de quelques provinces, chacune devient plus
    # difficile à tenir (frein à l'expansion ; les gouverneurs et bâtiments compensent).
    nb_terr = len(pays.get("territoires", []))
    if nb_terr > 4:
        c -= min(30, (nb_terr - 4) * 2.2)
    if tid == cap_terr:
        c += 15  # la capitale, siège du pouvoir, est intrinsèquement plus stable
    ville = next((v for v in pays.get("villes", []) if v.get("territoire") == tid), None)
    if ville:
        for bat in ville.get("batiments", []):
            c += STABILITE_BATIMENTS.get(bat, 0)
        if ville.get("gouverneur"):
            c += 12
        if ville.get("pacification", 0) > 0:
            c -= 18  # conquête récente
    nb = upt.get(tid, 0)
    if nb > 2:
        c -= min(20, (nb - 2) * 4)  # armée omniprésente : occupation pesante
    for m in pays.get("prov_modif", {}).get(tid, []):
        c += m.get("malus", 0)  # catastrophes locales (séisme, peste…)
    return max(0.0, min(100.0, c))


def calculer_stabilite(pays: dict, state: dict | None = None) -> int:
    """Stabilité PAR PROVINCE (dérive avec inertie), agrégée en une MOYENNE nationale
    (le « moral » affiché). Renseigne aussi les provinces les plus instables."""
    terrs = list(pays.get("territoires", []))
    base_nat, facteurs = _base_stab_nationale(pays, state)
    pays["gouverneurs_max"] = _max_gouverneurs(pays)
    pays["gouverneurs_actuels"] = sum(1 for v in pays.get("villes", []) if v.get("gouverneur"))
    prov_stab = pays.setdefault("prov_stab", {})
    if not terrs:
        pays["stabilite"] = max(0, min(100, int(round(base_nat))))
        pays["stabilite_cible"] = pays["stabilite"]
        pays["stabilite_facteurs"] = facteurs; pays["stabilite_basses"] = []
        return pays["stabilite"]
    cap_terr = _capitale_faction(pays["id"])
    upt: dict = {}
    for u in pays.get("unites", []):
        upt[u.get("territoire")] = upt.get(u.get("territoire"), 0) + u.get("effectif", 1)
    cibles = {}
    for tid in terrs:
        cible = _cible_province(pays, tid, base_nat, upt, cap_terr)
        cur = prov_stab.get(tid, 55.0)
        nv = cur + (cible - cur) * 0.35
        if abs(cible - cur) >= 1:
            nv += 1 if cible > cur else -1
        prov_stab[tid] = max(0.0, min(100.0, round(nv, 1)))
        cibles[tid] = cible
    for tid in list(prov_stab):  # purge les provinces perdues
        if tid not in terrs:
            del prov_stab[tid]
    pays["stabilite"] = int(round(sum(prov_stab[t] for t in terrs) / len(terrs)))
    pays["stabilite_cible"] = int(round(sum(cibles.values()) / len(cibles)))
    pays["stabilite_facteurs"] = facteurs
    basses = sorted((prov_stab[t], t) for t in terrs)[:4]
    pays["stabilite_basses"] = [{"nom": _nom_territoire(t), "stab": int(round(s))}
                                for s, t in basses if s < 45]
    return pays["stabilite"]


def _maj_age(pays: dict) -> None:
    """ÂGE de la civilisation (empire entier) selon la stabilité moyenne. Hystérésis :
    il faut tenir la condition ~3 tours pour entrer/sortir d'un âge d'or ou sombre."""
    stab = pays.get("stabilite", 60)
    cpt = pays.get("age_compteur", 0)
    if stab >= 75:
        cpt = (cpt + 1) if cpt >= 0 else 1
    elif stab <= 32:
        cpt = (cpt - 1) if cpt <= 0 else -1
    else:
        cpt = 0
    cpt = max(-4, min(4, cpt))
    pays["age_compteur"] = cpt
    if cpt >= 3:
        pays["age"] = "or"
    elif cpt <= -3:
        pays["age"] = "sombre"
    elif -2 <= cpt <= 2:
        pays["age"] = None


def _maj_corruption(pays: dict) -> float:
    """CORRUPTION (%) qui ponctionne le revenu d'or. Monte avec la taille de l'empire
    et l'instabilité ; baisse avec les gouverneurs, le forum/agora, le droit et les
    magistratures."""
    nb = len(pays.get("territoires", []))
    c = max(0.0, (nb - 4) * 3.0)
    stab = pays.get("stabilite", 60)
    if stab < 55:
        c += (55 - stab) * 0.4
    c -= 4 * sum(1 for v in pays.get("villes", []) if v.get("gouverneur"))
    bats = set()
    for v in pays.get("villes", []):
        bats.update(v.get("batiments", []))
    if "forum" in bats: c -= 6
    if "agora" in bats: c -= 6
    if "droit_romain" in pays.get("technologies", []): c -= 5
    if "magistratures" in pays.get("dogmes", []): c -= 5
    pays["corruption"] = round(max(0.0, min(55.0, c)), 1)
    return pays["corruption"]


def _maj_inflation(pays: dict) -> float:
    """INFLATION (%) : monte quand l'or DORT (trésor thésaurisé), redescend quand on
    dépense. Renchérit les coûts et érode lentement le trésor (cf. _appliquer_production)."""
    orr = pays.get("ressources", {}).get("or", 0)
    cible = max(0.0, min(45.0, (orr - 300) / 45.0))
    cur = pays.get("inflation", 0.0)
    nv = cur + (cible - cur) * (0.25 if cible > cur else 0.4)
    pays["inflation"] = round(max(0.0, nv), 1)
    return pays["inflation"]


def _cout_inflation(pays: dict, base: float) -> int:
    """Applique l'inflation à un coût en or."""
    return int(round(base * (1 + pays.get("inflation", 0.0) / 100.0)))


def _maj_guerre_compteur(pays: dict, state: dict | None) -> None:
    """Compte les tours de guerre consécutifs (pour le malus « guerre longue »)."""
    if _en_guerre(pays.get("id", ""), state):
        pays["tours_guerre"] = pays.get("tours_guerre", 0) + 1
    else:
        pays["tours_guerre"] = 0


def _decrementer_prov_modif(pays: dict) -> None:
    """Fait expirer les modificateurs locaux (catastrophes) au fil des tours."""
    pm = pays.get("prov_modif", {})
    for tid in list(pm):
        garde = []
        for m in pm[tid]:
            m["tours"] = m.get("tours", 1) - 1
            if m["tours"] > 0:
                garde.append(m)
        if garde:
            pm[tid] = garde
        else:
            del pm[tid]


CATASTROPHES = [
    {"nom": "Séisme", "malus": -25, "tours": 3, "texte": "Un séisme dévaste {prov}"},
    {"nom": "Peste", "malus": -22, "tours": 4, "texte": "La peste ravage {prov}"},
    {"nom": "Sécheresse", "malus": -16, "tours": 3, "texte": "La sécheresse frappe {prov}"},
    {"nom": "Émeutes", "malus": -18, "tours": 2, "texte": "Des émeutes éclatent à {prov}"},
]


def _declencher_catastrophes(state: dict, evenements: list) -> None:
    """Catastrophes locales aléatoires : posent un malus temporaire sur une province."""
    for fid, p in state.get("pays", {}).items():
        terrs = p.get("territoires", [])
        if len(terrs) < 2 or random.random() > 0.10:
            continue
        tid = random.choice(terrs)
        cat = random.choice(CATASTROPHES)
        p.setdefault("prov_modif", {}).setdefault(tid, []).append(
            {"nom": cat["nom"], "malus": cat["malus"], "tours": cat["tours"]})
        evenements.append({"type": "catastrophe", "faction": fid,
                           "texte": cat["texte"].format(prov=_nom_territoire(tid)) + " !"})


def appliquer_directive_conseiller(state: dict, directive: dict) -> dict:
    """Applique une DIRECTIVE libre décidée par le conseiller : prélève l'or (selon le
    coût qu'IL a fixé) et crée un PROJET (un « point » sur la carte). Générique : aucun
    type d'action n'est codé en dur. Retourne {ok, projet|raison}."""
    joueur = state.get("meta", {}).get("joueur_pays")
    pays = state.get("pays", {}).get(joueur, {})
    res = pays.setdefault("ressources", {})
    cout = _cout_inflation(pays, max(0, int(directive.get("cout_or", 0) or 0)))
    cout_res = {r: int(v) for r, v in (directive.get("cout_res", {}) or {}).items() if v}
    if res.get("or", 0) < cout:
        return {"ok": False, "raison": f"le trésor est insuffisant ({cout} or nécessaires)"}
    manque = next((r for r, v in cout_res.items() if res.get(r, 0) < v), None)
    if manque:
        return {"ok": False, "raison": f"il manque du {manque} ({cout_res[manque]} requis)"}
    res["or"] = round(res.get("or", 0) - cout, 1)
    for r, v in cout_res.items():
        res[r] = round(res.get(r, 0) - v, 1)
    dur = max(1, int(directive.get("duree", 3) or 3))
    cible = directive.get("cible_faction")
    if cible:  # tolère les noms d'affichage (Égypte→carthage, etc.)
        alias = {"egypte": "carthage", "égypte": "carthage", "sparte": "sparte",
                 "rome": "rome", "macedoine": "macedoine", "macédoine": "macedoine"}
        cible = alias.get(str(cible).strip().lower(), cible)
    cible = cible if cible in state.get("pays", {}) and cible != joueur else None
    origine = _capitale_faction(joueur) or (pays.get("territoires") or [None])[0]
    projets = pays.setdefault("projets", [])
    projet = {
        "id": f"proj-{len(projets) + 1}",
        "nom": str(directive.get("nom") or "Projet secret")[:48],
        "type": str(directive.get("type") or "autre"),
        "territoire": origine,
        "cible_faction": cible,
        "cible_territoire": _capitale_faction(cible) if cible else None,
        "cout_or": cout, "cout_res": cout_res,
        "duree": dur, "tours_restants": dur,
        "statut": "en_cours",
        "rapport": str(directive.get("rapport") or "")[:200],
        "journal": [],
    }
    projets.append(projet)
    return {"ok": True, "projet": projet}


def _avancer_projets(pays: dict, state: dict, evenements: list) -> None:
    """Fait progresser les projets du conseiller. À l'échéance : les projets PASSIFS
    (espionnage, garnison, commerce) deviennent « actifs » ; les projets HOSTILES
    (rébellion, sabotage) produisent leur EFFET puis se terminent."""
    for p in pays.get("projets", []):
        if p.get("statut") != "en_cours":
            continue
        p["tours_restants"] = p.get("tours_restants", 1) - 1
        if p["tours_restants"] > 0:
            continue
        typ = (p.get("type") or "").lower()
        if typ in ("espionnage", "garnison", "commerce"):
            p["statut"] = "actif"
            evenements.append({"type": "conseiller", "faction": pays.get("id"),
                               "texte": f"« {p.get('nom')} » est désormais opérationnel."})
        else:  # rébellion, sabotage, autre entreprise hostile : effet ponctuel
            _effet_projet_termine(state, pays, p, evenements)
            p["statut"] = "termine"


def _effet_projet_termine(state: dict, pays: dict, projet: dict, evenements: list) -> None:
    """Effet GÉNÉRIQUE d'un projet hostile achevé (selon son type + ses MOYENS). La
    capitale ennemie est TOUJOURS imprenable par ce biais."""
    cf = projet.get("cible_faction")
    cible = state.get("pays", {}).get(cf) if cf else None
    if not cible:
        evenements.append({"type": "projet", "faction": pays.get("id"),
                           "texte": f"« {projet.get('nom')} » s'achève sans cible claire."})
        return
    typ = (projet.get("type") or "").lower()
    nomp, nomc = projet.get("nom"), META_FACTIONS.get(cf, {}).get("nom", cf)
    cap = _capitale_faction(cf)
    non_cap = [t for t in cible.get("territoires", []) if t != cap]
    cout = projet.get("cout_or", 0)
    rebelle = typ in ("rebellion", "militaire", "revolte") or "rebel" in (projet.get("nom", "").lower())
    if rebelle:
        if not non_cap:
            evenements.append({"type": "projet", "faction": pays.get("id"),
                               "texte": f"« {nomp} » : la révolte n'a pas pris — {nomc} ne tient que sa capitale, imprenable."})
            return
        prov = random.choice(non_cap)
        cible["territoires"] = [t for t in cible["territoires"] if t != prov]
        cible["villes"] = [v for v in cible.get("villes", []) if v.get("territoire") != prov]
        cible.get("prov_stab", {}).pop(prov, None)
        if cout >= 300:  # moyens suffisants : la province soulevée te rejoint
            pays.setdefault("territoires", []).append(prov)
            pays.setdefault("prov_stab", {})[prov] = 32.0
            evenements.append({"type": "projet", "faction": pays.get("id"),
                               "texte": f"« {nomp} » : {_nom_territoire(prov)} se soulève contre {nomc} et REJOINT votre cause !"})
        else:  # moyens modestes : la province devient indépendante (affaiblit l'ennemi)
            evenements.append({"type": "projet", "faction": pays.get("id"),
                               "texte": f"« {nomp} » : {_nom_territoire(prov)} se soulève contre {nomc} et proclame son indépendance !"})
    elif typ == "sabotage":
        res = cible.setdefault("ressources", {})
        perte = round(res.get("or", 0) * 0.2, 1)
        res["or"] = max(0.0, round(res.get("or", 0) - perte, 1))
        if non_cap:
            prov = random.choice(non_cap)
            cible.setdefault("prov_stab", {})[prov] = max(0.0, cible.get("prov_stab", {}).get(prov, 50) - 25)
        evenements.append({"type": "projet", "faction": pays.get("id"),
                           "texte": f"« {nomp} » : sabotage réussi en {nomc} (−{perte} or, troubles)."})
    else:
        evenements.append({"type": "projet", "faction": pays.get("id"),
                           "texte": f"« {nomp} » est mené à bien."})


def _verifier_revolte(pays: dict, evenements: list) -> None:
    """Une province dont la stabilité s'effondre fait SÉCESSION + mutinerie possible.
    La capitale n'est jamais perdue."""
    prov_stab = pays.get("prov_stab", {})
    cap = _capitale_faction(pays["id"])
    candidats = sorted((s, t) for t, s in prov_stab.items() if t != cap and s < 25)
    if not candidats:
        return
    s, perdu = candidats[0]
    if random.random() < (0.6 if s < 12 else 0.3):
        pays["territoires"] = [t for t in pays.get("territoires", []) if t != perdu]
        pays["villes"] = [v for v in pays.get("villes", []) if v.get("territoire") != perdu]
        pays["unites"] = [u for u in pays.get("unites", []) if u.get("territoire") != perdu]
        prov_stab.pop(perdu, None)
        evenements.append({"type": "revolte", "faction": pays["id"],
                           "texte": f"RÉVOLTE : {_nom_territoire(perdu)} se soulève et fait sécession !"})
    if s < 12 and pays.get("unites") and random.random() < 0.5:
        u = random.choice(pays["unites"])
        pays["unites"] = [x for x in pays["unites"] if x is not u]
        evenements.append({"type": "revolte", "faction": pays["id"],
                           "texte": f"Mutinerie ! Des troupes ({u.get('type')}) désertent."})


def _progresser_recherche(pays: dict, evenements: list) -> None:
    """Avance la recherche en cours et enchaîne sur la suivante si terminée."""
    eff = tech_tree.effets_technologies(pays.get("technologies", []))
    # Points de recherche : base + bonus philosophie/merveilles + bonus or/pop.
    merv_pct = pays.get("merveilles_effet", {}).get("recherche_pct", 0)
    points = 12.0 * (1 + eff.get("recherche_pct", 0) + merv_pct)
    points += pays.get("ressources", {}).get("population", 0) * 0.1

    rec = pays.get("recherche_en_cours")
    if not rec:
        pays["recherche_en_cours"] = tech_tree.choisir_prochaine_recherche(
            pays.get("technologies", []))
        rec = pays["recherche_en_cours"]
    rec_maj, terminee = tech_tree.progresser_recherche(
        rec, pays.get("technologies", []), points)
    if terminee:
        pays.setdefault("technologies", []).append(terminee)
        t = tech_tree.tech_par_id(terminee)
        nom = t["nom"] if t else terminee
        evenements.append({
            "type": "recherche", "faction": pays["id"],
            "texte": f"{pays['nom']} achève la recherche : {nom}.",
        })
        pays["recherche_en_cours"] = tech_tree.choisir_prochaine_recherche(
            pays.get("technologies", []))
    else:
        pays["recherche_en_cours"] = rec_maj


# =====================================================================
#  Événements aléatoires (§16)
# =====================================================================
def _declencher_evenements(state: dict) -> list[dict]:
    """Tire les événements aléatoires du tour (probabilités de world_events.json)."""
    evenements = []
    pays = state.get("pays", {})
    for ev in _world_events().get("evenements", []):
        if random.random() >= ev.get("probabilite", 0):
            continue
        # Cible une faction au hasard.
        fid = random.choice(list(pays.keys()))
        p = pays[fid]
        effet = ev.get("effet", {})
        texte = ev.get("texte", ev.get("nom", "Événement"))
        contexte = {"faction": p.get("nom", fid)}

        # Application des effets.
        if "population_pct" in effet and p.get("villes"):
            ville = random.choice(p["villes"])
            delta = int(ville.get("population", 0) * effet["population_pct"])
            ville["population"] = max(1, ville.get("population", 0) + delta)
            contexte["ville"] = ville.get("nom", ville.get("id"))
        if "nourriture_pct" in effet:
            # Effet DURABLE : modificateur de production sur plusieurs tours
            # (rend le revenu dynamique au lieu d'un gain instantané unique).
            _ajouter_modificateur(p, "nourriture", facteur=effet["nourriture_pct"],
                                  tours=2, source=ev.get("nom", "Événement"))
        if "stabilite" in effet:
            p["stabilite"] = max(0, min(100, p.get("stabilite", 70) + effet["stabilite"]))
            if p.get("territoires"):
                contexte["territoire"] = random.choice(p["territoires"])
        if "batiments_pct" in effet and p.get("villes"):
            ville = random.choice(p["villes"])
            bats = ville.get("batiments", [])
            if bats and random.random() < abs(effet["batiments_pct"]):
                perdu = bats.pop()
                contexte["ville"] = ville.get("nom", ville.get("id"))
        if "nouvelle_ressource" in effet and p.get("territoires"):
            contexte["territoire"] = random.choice(p["territoires"])
            # Nouvelle mine : bonus de production durable de la ressource trouvée.
            res_trouvee = effet["nouvelle_ressource"]
            _ajouter_modificateur(p, res_trouvee, valeur=4.0, tours=6,
                                  source=ev.get("nom", "Mine"))
        if "reputation_alea" in effet:
            for autre in p.get("reputation", {}):
                p["reputation"][autre] = max(-100, p["reputation"][autre] + effet["reputation_alea"])

        # Formatage du texte (placeholders {ville}, {faction}, {territoire}).
        try:
            texte_fmt = texte.format(**{
                "faction": contexte.get("faction", fid),
                "ville": contexte.get("ville", "une cité"),
                "territoire": contexte.get("territoire", "une province"),
            })
        except Exception:
            texte_fmt = texte
        evenements.append({
            "id": ev.get("id"), "nom": ev.get("nom"), "type": ev.get("type"),
            "faction": fid, "texte": texte_fmt,
        })
    return evenements


# =====================================================================
#  Décisions IA + résolution de conflit simple
# =====================================================================
def _decisions_ia(state: dict) -> list[dict]:
    """Chaque dirigeant IA décrit son action du tour (Ollama ou repli)."""
    messages = []
    meta = state.get("meta", {})
    etat_monde = ws.lire_world_state_courant(state)
    for fid, p in state.get("pays", {}).items():
        if p.get("est_joueur"):
            continue
        # Décisions déterministes (rapides) : on réserve les appels Ollama lents
        # de la fin de tour au résumé narratif et à l'analyse des accords.
        dec = ai_director.decision_tour(
            fid, etat_monde=etat_monde, date_jeu=meta.get("date_jeu", "264-03"),
            utiliser_ia=False)
        state.setdefault("historique_actions", []).append({
            "tour": meta.get("tour"), "acteur": fid,
            "texte": dec["texte"], "resultat": f"Décision IA ({dec['source']}).",
        })
        messages.append({
            "auteur": ai_director.nom_dirigeant(fid), "faction": fid,
            "texte": dec["texte"], "source": dec["source"],
        })
    return messages


def _resoudre_conflits(state: dict) -> list[dict]:
    """Résolution simple des guerres actives (§8 simplifié).

    Pour chaque guerre active, compare la force militaire des deux camps.
    Le camp le plus faible perd du moral et un peu d'effectif ; pas de capture
    automatique de capitale (le MVP reste prudent). Retourne les événements.
    """
    evenements = []
    pays = state.get("pays", {})
    for guerre in state.get("diplomatie", {}).get("guerres_actives", []):
        a = guerre.get("a") or guerre.get("attaquant")
        b = guerre.get("b") or guerre.get("defenseur")
        if a not in pays or b not in pays:
            continue
        fa = _force_militaire(pays[a])
        fb = _force_militaire(pays[b])
        if fa == fb:
            continue
        gagnant, perdant = (a, b) if fa > fb else (b, a)
        # Le perdant subit des pertes de moral et un effectif réduit.
        for u in pays[perdant].get("unites", []):
            u["moral"] = max(20, u.get("moral", 100) - 15)
        # Retire un effectif à la plus grosse unité du perdant.
        unites = sorted(pays[perdant].get("unites", []),
                        key=lambda u: u.get("effectif", 0), reverse=True)
        if unites and unites[0].get("effectif", 0) > 1:
            unites[0]["effectif"] -= 1
        evenements.append({
            "type": "conflit", "faction": gagnant,
            "texte": f"{pays[gagnant]['nom']} prend l'avantage sur "
                     f"{pays[perdant]['nom']} dans les combats du mois.",
        })
    return evenements


def _force_militaire(pays: dict) -> int:
    return sum(force_unite(u.get("type", "")) * u.get("effectif", 1)
               for u in pays.get("unites", []))


# =====================================================================
#  Analyse des conversations privées & application automatique des accords
# =====================================================================
def _analyser_conversations(state: dict) -> list[dict]:
    """En fin de tour, examine les conversations privées joueur↔IA et applique
    automatiquement les accords/échanges qui y ont été conclus (§ exigence v2).

    Retourne la liste des accords appliqués (pour le résumé / les événements).
    """
    appliques: list[dict] = []
    meta = state.get("meta", {})
    joueur = meta.get("joueur_pays", "rome")
    date_jeu = meta.get("date_jeu", "264-03")

    for fid in list(state.get("pays", {}).keys()):
        if fid == joueur:
            continue
        non_analyses = conversations.messages_non_analyses(state, fid)
        # Il faut au moins un échange dans les deux sens pour conclure un accord.
        a_joueur = any(m.get("role") == "joueur" for m in non_analyses)
        a_ia = any(m.get("role") == "ia" for m in non_analyses)
        if not (a_joueur and a_ia):
            continue

        accord = ai_director.analyser_accords(
            fid, non_analyses, date_jeu=date_jeu, pays_joueur=joueur)
        conversations.marquer_analyses(state, fid)

        if accord.get("accord_conclu"):
            desc = _appliquer_accord(state, joueur, fid, accord)
            if desc:
                appliques.append(desc)
    return appliques


def _appliquer_accord(state: dict, joueur: str, faction: str, accord: dict) -> dict | None:
    """Applique les conséquences d'un accord conclu. Retourne une description."""
    typ = accord.get("type", "aucun")
    tour = state.get("meta", {}).get("tour")
    diplo = state.setdefault("diplomatie", {})
    traites = diplo.setdefault("traites_actifs", [])
    guerres = diplo.setdefault("guerres_actives", [])
    nom_ia = state.get("pays", {}).get(faction, {}).get("nom", faction)
    nom_joueur = state.get("pays", {}).get(joueur, {}).get("nom", joueur)

    if typ in ("traite_commercial", "non_agression", "alliance"):
        traites.append({"type": typ, "parties": [joueur, faction], "tour": tour})
        _ajuster_reputation(state, joueur, faction,
                            +25 if typ == "alliance" else +15)
    elif typ == "paix":
        diplo["guerres_actives"] = [
            g for g in guerres if {g.get("a"), g.get("b")} != {joueur, faction}]
        _ajuster_reputation(state, joueur, faction, +20)
    elif typ == "declaration_guerre":
        if not any({g.get("a"), g.get("b")} == {joueur, faction} for g in guerres):
            guerres.append({"a": joueur, "b": faction, "tour": tour})
        _ajuster_reputation(state, joueur, faction, -40)

    # Transferts de ressources convenus (dans les deux sens).
    _transferer(state, joueur, faction, accord.get("ressources_joueur_vers_ia", {}))
    _transferer(state, faction, joueur, accord.get("ressources_ia_vers_joueur", {}))

    # Ajustement de réputation suggéré par l'analyse.
    delta = int(accord.get("reputation_delta", 0) or 0)
    if delta:
        _ajuster_reputation(state, joueur, faction, delta)

    resume = accord.get("resume") or _libelle_accord(typ, nom_joueur, nom_ia)
    return {
        "type": typ, "faction": faction, "avec": joueur,
        "resume": resume, "source": accord.get("source", "fallback"),
    }


def _transferer(state: dict, source: str, cible: str, montants: dict) -> None:
    """Transfère des ressources de `source` vers `cible` (dans la limite du stock)."""
    if not montants:
        return
    ps = state.get("pays", {}).get(source, {}).get("ressources", {})
    pc = state.get("pays", {}).get(cible, {}).get("ressources", {})
    for r, v in montants.items():
        try:
            v = float(v)
        except Exception:
            continue
        dispo = min(v, ps.get(r, 0))
        if dispo > 0:
            ps[r] = round(ps.get(r, 0) - dispo, 1)
            pc[r] = round(pc.get(r, 0) + dispo, 1)


def _libelle_accord(typ: str, n1: str, n2: str) -> str:
    libelles = {
        "traite_commercial": f"Traité commercial entre {n1} et {n2}.",
        "non_agression": f"Pacte de non-agression entre {n1} et {n2}.",
        "paix": f"Paix conclue entre {n1} et {n2}.",
        "alliance": f"Alliance scellée entre {n1} et {n2}.",
        "echange_ressources": f"Échange de ressources entre {n1} et {n2}.",
        "declaration_guerre": f"La guerre éclate entre {n1} et {n2}.",
    }
    return libelles.get(typ, f"Accord entre {n1} et {n2}.")


# =====================================================================
#  Puissance (§10.2) & victoire (§17)
# =====================================================================
def calculer_puissance(pays: dict) -> int:
    """Puissance = (Unités×Force) + (Or×0.5) + (Population×0.3) + (Territoires×10)."""
    force = _force_militaire(pays)
    orr = pays.get("ressources", {}).get("or", 0)
    pop = pays.get("ressources", {}).get("population", 0)
    nb_terr = len(pays.get("territoires", []))
    return int(round(force + orr * 0.5 + pop * 0.3 + nb_terr * 10))


def _recalculer_puissances(state: dict) -> None:
    """MAJ puissance : valeur réelle pour le joueur, estimée ±20% pour les IA.

    Si le joueur possède le réseau d'espionnage, il voit la puissance réelle des IA.
    """
    pays = state.get("pays", {})
    joueur = next((p for p in pays.values() if p.get("est_joueur")), None)
    espionnage = False
    if joueur:
        espionnage = "reseau_espionnage" in joueur.get("technologies", [])
    for p in pays.values():
        reelle = calculer_puissance(p)
        if p.get("est_joueur"):
            p["puissance"] = reelle
            p.pop("puissance_estimee", None)
        else:
            if espionnage:
                p["puissance"] = reelle
                p.pop("puissance_estimee", None)
            else:
                # Estimation ±20% déterministe (seed liée à l'id + tour).
                rng = random.Random(f"{p['id']}-{state.get('meta', {}).get('tour')}")
                marge = rng.uniform(-0.20, 0.20)
                p["puissance_estimee"] = int(round(reelle * (1 + marge)))
                p.pop("puissance", None)


def verifier_victoire(state: dict) -> dict | None:
    """Vérification BASIQUE des conditions de victoire (§17).

    Retourne {gagnant, type, raison} si une condition est remplie, sinon None.
    """
    pays = state.get("pays", {})
    meta = state.get("meta", {})
    joueur_id = meta.get("joueur_pays")

    # Survie : dernier pays debout (autres sans ville).
    vivants = [fid for fid, p in pays.items() if p.get("villes")]
    if len(vivants) == 1:
        gid = vivants[0]
        return {"gagnant": gid, "type": "survie",
                "raison": f"{pays[gid]['nom']} est la dernière puissance debout."}

    # Militaire : un pays contrôle les capitales des 2 autres.
    for fid, p in pays.items():
        terr = set(p.get("territoires", []))
        capitales_autres = [
            _capitale_faction(autre) for autre in pays if autre != fid
        ]
        capitales_autres = [c for c in capitales_autres if c]
        if capitales_autres and all(c in terr for c in capitales_autres):
            return {"gagnant": fid, "type": "militaire",
                    "raison": f"{p['nom']} contrôle les capitales adverses."}

    # Économique : 5000 or (les routes commerciales sont simplifiées ici).
    for fid, p in pays.items():
        if p.get("ressources", {}).get("or", 0) >= 5000:
            return {"gagnant": fid, "type": "economique",
                    "raison": f"{p['nom']} a amassé une fortune dominante (5000+ or)."}

    # Diplomatique : alliances avec les 2 autres + paix (rep >= 60 mutuelle).
    for fid, p in pays.items():
        autres = [a for a in pays if a != fid]
        if all(p.get("reputation", {}).get(a, 0) >= 60
               and pays[a].get("reputation", {}).get(fid, 0) >= 60
               for a in autres):
            return {"gagnant": fid, "type": "diplomatique",
                    "raison": f"{p['nom']} est allié à toutes les puissances."}

    return None


# =====================================================================
#  Fin de tour
# =====================================================================
def end_turn(state: dict) -> dict:
    """Fait avancer le jeu d'un tour. Retourne {state, evenements, messages_diplomatiques}."""
    meta = state.setdefault("meta", {})
    evenements: list[dict] = []
    messages: list[dict] = []

    # 1) Merveilles : avancement des chantiers (restauration/fouille/construction).
    merveilles.avancer_chantiers(state, evenements)

    # 1b) Production (DYNAMIQUE), croissance, moral, recherche, stabilité.
    for fid, p in state.get("pays", {}).items():
        p["merveilles_effet"] = merveilles.bonus_actif(p, state)
        p["prestige"] = p["merveilles_effet"].get("prestige", 0)
        _maj_guerre_compteur(p, state)
        _maj_corruption(p)
        _maj_inflation(p)
        _appliquer_production(p, state)
        _decrementer_modificateurs(p)  # les effets d'événements s'estompent
        _decrementer_prov_modif(p)     # les catastrophes locales s'estompent
        _avancer_projets(p, state, evenements)  # projets du conseiller (espions, garnisons…)
        _avancer_constructions(p, evenements)  # chantiers : -1 tour, livraison
        _maj_moral(p)
        _progresser_recherche(p, evenements)
        calculer_stabilite(p, state)
        _maj_age(p)                    # âge d'or / âge sombre (selon la moyenne)
        _verifier_revolte(p, evenements)
        _reset_mouvements(p)  # les unités peuvent rebouger au tour suivant
        # Décrémente la pacification des villes capturées (§9.3).
        for v in p.get("villes", []):
            if v.get("pacification", 0) > 0:
                v["pacification"] -= 1

    # 1c) Catastrophes locales (séisme, peste…) → malus de stabilité par province.
    _declencher_catastrophes(state, evenements)

    # 2) Événements aléatoires (§16) — peuvent poser des modificateurs durables.
    evenements.extend(_declencher_evenements(state))

    # 3) Décisions IA (§6 étape 4).
    messages.extend(_decisions_ia(state))

    # 3b) Analyse des conversations privées : applique les accords conclus.
    accords = _analyser_conversations(state)
    for acc in accords:
        evenements.append({"type": "accord", "faction": acc.get("faction"),
                           "texte": acc.get("resume", "Accord conclu.")})
    state["accords_recents"] = accords

    # 4) Résolution simple des conflits (§6 étape 5).
    evenements.extend(_resoudre_conflits(state))

    # 5) Avance la date (1 tour = 1 mois, §6).
    _avancer_date(state)

    # 6) Recalcule les puissances.
    _recalculer_puissances(state)

    # 6b) Recalcule la production AFFICHÉE pour le prochain tour, en tenant compte
    # des changements de stabilité / guerre / modificateurs survenus ce tour-ci.
    for p in state.get("pays", {}).values():
        _maj_production_detail(p, state)

    # 7) Vérifie la victoire (basique).
    victoire = verifier_victoire(state)
    if victoire:
        state["victoire"] = victoire
        evenements.append({"type": "victoire", "faction": victoire["gagnant"],
                           "texte": victoire["raison"]})

    # 8) MAJ world_state.md tous les 6 tours (§6 étape 6, §14.3).
    if meta.get("tour", 1) % 6 == 0:
        res_ws = ws.ecrire_world_state(state)
        evenements.append({"type": "chronique", "faction": None,
                           "texte": f"La chronique du monde est mise à jour ({res_ws['source']})."})

    # 9) Résumé narratif des événements MAJEURS du tour écoulé (exigence v2).
    resume = _generer_resume_tour(state, evenements, messages, accords)
    state["resume_tour"] = resume.get("texte", "")

    # Enregistre les événements du tour dans l'état + sauvegarde courante.
    state["evenements_tour"] = evenements
    state["messages_diplomatiques"] = messages
    ws.sauver_etat_courant(state)

    return {
        "state": state,
        "evenements": evenements,
        "messages_diplomatiques": messages,
        "accords": accords,
        "resume": resume.get("texte", ""),
        "resume_source": resume.get("source", "fallback"),
    }


# ⏸ IA EN PAUSE POUR LES TESTS UI/DESIGN
# Le résumé narratif génératif (appel Ollama, ~8 s/tour) est temporairement
# DÉSACTIVÉ pour accélérer les tests d'interface : la fin de tour devient instantanée.
# Pour réactiver la narration générative, repasser RESUME_IA_ACTIF à True.
RESUME_IA_ACTIF = False


def _generer_resume_tour(state: dict, evenements: list, messages: list,
                         accords: list) -> dict:
    """Construit les faits du tour et (sauf en pause) délègue le résumé à l'IA."""
    faits: list[str] = []
    for ev in evenements:
        txt = ev.get("texte") if isinstance(ev, dict) else str(ev)
        if txt:
            faits.append(f"- {txt}")
    for acc in accords:
        if acc.get("resume"):
            faits.append(f"- {acc['resume']}")
    for m in messages:
        if isinstance(m, dict) and m.get("texte"):
            faits.append(f"- {m.get('auteur', 'Un dirigeant')} : {m['texte']}")

    if not RESUME_IA_ACTIF:
        # ⏸ Pause IA (tests) : résumé déterministe, AUCUN appel Ollama.
        lignes = [f.lstrip("-• ").strip() for f in faits if f.strip()]
        txt = " ".join(lignes[:4]) or "Le monde poursuit tranquillement sa course."
        return {"texte": txt, "source": "pause"}

    date_jeu = state.get("meta", {}).get("date_jeu", "264-03")
    return ai_director.resumer_tour("\n".join(faits), date_jeu=date_jeu)


def _avancer_date(state: dict) -> None:
    """Avance d'UN TOUR = MOIS_PAR_TOUR mois (1 an par défaut). MAJ tour/année/date/ère."""
    meta = state.setdefault("meta", {})
    meta["tour"] = meta.get("tour", 1) + 1
    mois = meta.get("mois", 3) + MOIS_PAR_TOUR
    annee = meta.get("annee", -5)
    while mois > 12:
        mois -= 12
        annee += 1  # le temps avance vers le futur
    if annee == 0:
        annee = 1  # il n'y a pas d'an 0 (on saute de -1 à 1)
    meta["mois"] = mois
    meta["annee"] = annee
    meta["date_jeu"] = f"{abs(annee):03d}-{mois:02d}"
    meta["ere"] = _ere_pour_annee(annee)


def _ere_pour_annee(annee: int) -> str:
    """Détermine l'ère (le jeu démarre sous le Principat, 54 ap. J.-C.)."""
    if annee < 0:
        return "republique"
    if annee < 200:
        return "haut_empire"
    return "bas_empire"


# =====================================================================
#  Application d'actions validées (appelée après le validateur)
# =====================================================================
def appliquer_action(state: dict, action: dict) -> dict:
    """Applique les effets d'une action déjà validée. Retourne {texte, resultat}.

    NB : la validation (ressources, tech…) est faite en amont par
    realism_validator. Ici on applique de façon défensive.
    """
    type_action = (action or {}).get("type", "texte_libre")
    params = (action or {}).get("params") or {}
    cible = (action or {}).get("cible")
    joueur_id = state.get("meta", {}).get("joueur_pays")
    pays = state.get("pays", {}).get(joueur_id, {})
    res = pays.setdefault("ressources", {})

    if type_action == "recruter":
        type_unite = params.get("type")
        quantite = int(params.get("quantite", 1) or 1)
        if type_unite not in COUTS_UNITES:
            return {"texte": "Recrutement", "resultat": "Échec : unité inconnue."}
        tech_req = TECH_REQUISE_UNITE.get(type_unite)
        if tech_req and tech_req not in pays.get("technologies", []):
            return {"texte": "Recrutement",
                    "resultat": f"Échec : technologie requise ({tech_req})."}
        # L'unité est recrutée SUR une région possédée (sinon la capitale).
        region = params.get("region")
        if region not in pays.get("territoires", []):
            region = pays.get("territoires", [None])[0] if pays.get("territoires") else None
        if not region:
            return {"texte": "Recrutement", "resultat": "Échec : aucun territoire."}
        cout = COUTS_UNITES.get(type_unite, 0) * quantite
        # Remise « camp militaire » (-20% au recrutement) si la nation en possède un.
        if any("camp_militaire" in v.get("batiments", []) for v in pays.get("villes", [])):
            cout = int(round(cout * 0.8))
        cout = _cout_inflation(pays, cout)
        cout_pop = COUT_POP_UNITES.get(type_unite, 1) * quantite
        cout_res = {r: v * quantite for r, v in COUT_RES_UNITES.get(type_unite, {}).items()}
        if res.get("or", 0) < cout:
            return {"texte": "Recrutement", "resultat": "Échec : or insuffisant."}
        if res.get("population", 0) < cout_pop:
            return {"texte": "Recrutement", "resultat": "Échec : population insuffisante."}
        manque = next((r for r, v in cout_res.items() if res.get(r, 0) < v), None)
        if manque:
            return {"texte": "Recrutement", "resultat": f"Échec : {manque} insuffisant ({int(cout_res[manque])} requis)."}
        res["or"] -= cout
        for r, v in cout_res.items():
            res[r] = round(res.get(r, 0) - v, 1)
        # L'armée se lève dans la population : on la retire (pop nationale + ville).
        res["population"] = round(res.get("population", 0) - cout_pop, 1)
        ville_region = next((v for v in pays.get("villes", []) if v.get("territoire") == region), None)
        if ville_region:
            ville_region["population"] = max(0, ville_region.get("population", 0) - cout_pop)
        base_id = f"{joueur_id}-{type_unite}-{_compteur_unites(pays)}"
        pays.setdefault("unites", []).append({
            "id": base_id, "type": type_unite, "territoire": region,
            "effectif": quantite, "moral": 90, "a_bouge": False,
        })
        return {"texte": f"Recrutement de {quantite} × {type_unite} ({region}).",
                "resultat": f"{cout} or, {cout_pop} population."}

    if type_action == "construire":
        batiment = params.get("batiment")
        ville_id = params.get("ville")
        if batiment not in COUT_BATIMENTS:
            return {"texte": "Construction", "resultat": "Échec : bâtiment inconnu."}
        eff = tech_tree.effets_technologies(pays.get("technologies", []))
        cout = COUT_BATIMENTS.get(batiment, 0)
        if batiment == "murailles":
            cout = int(cout * (1 - eff.get("cout_muraille_pct", 0)))
        if batiment == "aqueduc":
            cout = int(cout * (1 - eff.get("cout_aqueduc_pct", 0)))
        cout = _cout_inflation(pays, cout)
        ville = next((v for v in pays.get("villes", [])
                      if v.get("id") == ville_id), None)
        if ville is None and pays.get("villes"):
            ville = pays["villes"][0]
        if ville is None:
            return {"texte": "Construction", "resultat": "Échec : aucune ville."}
        if batiment in ville.get("batiments", []):
            return {"texte": "Construction", "resultat": "Déjà construit dans cette ville."}
        if ville.get("construction"):
            return {"texte": "Construction",
                    "resultat": "Un chantier est déjà en cours dans cette ville."}
        if res.get("or", 0) < cout:
            return {"texte": "Construction", "resultat": "Échec : or insuffisant."}
        cout_res = dict(COUT_RES_BATIMENTS.get(batiment, {}))
        manque = next((r for r, v in cout_res.items() if res.get(r, 0) < v), None)
        if manque:
            return {"texte": "Construction",
                    "resultat": f"Échec : {manque} insuffisant ({cout_res[manque]} requis — produisez-en avec carrière/scierie/mine)."}
        # Lance le chantier : or + ressources investis maintenant, le bâtiment se
        # construit en plusieurs tours (l'avancement est visible dans l'interface).
        res["or"] -= cout
        for r, v in cout_res.items():
            res[r] = round(res.get(r, 0) - v, 1)
        duree = DUREE_BATIMENTS.get(batiment, 3)
        ville["construction"] = {
            "batiment": batiment, "tours_restants": duree, "duree": duree, "cout": cout,
        }
        res_txt = (" + " + ", ".join(f"{int(v)} {r}" for r, v in cout_res.items())) if cout_res else ""
        return {"texte": f"Chantier lancé : {_nom_batiment(batiment)} à "
                         f"{ville.get('nom')} ({duree} tours).",
                "resultat": f"{cout} or{res_txt} investis."}

    if type_action == "fonder_ville":
        terr = params.get("territoire") or cible
        if terr not in pays.get("territoires", []):
            return {"texte": "Fondation", "resultat": "Échec : province non contrôlée."}
        if any(v.get("territoire") == terr for v in pays.get("villes", [])):
            return {"texte": "Fondation", "resultat": "Une ville existe déjà ici."}
        cout = _cout_inflation(pays, COUT_FONDER_VILLE_OR * (1 - effets_dogmes(pays.get("dogmes", []))["cout_ville_pct"]))
        if res.get("or", 0) < cout:
            return {"texte": "Fondation",
                    "resultat": f"Échec : il faut {cout} or pour fonder une ville."}
        # Les colons partent de la plus grande ville existante.
        source = max(pays.get("villes", []), key=lambda v: v.get("population", 0), default=None)
        if not source or source.get("population", 0) <= POP_NOUVELLE_VILLE + 4:
            return {"texte": "Fondation",
                    "resultat": "Échec : population insuffisante pour envoyer des colons."}
        res["or"] = round(res.get("or", 0) - cout, 1)
        source["population"] = source.get("population", 0) - POP_NOUVELLE_VILLE
        nom = _nom_territoire(terr)
        pays.setdefault("villes", []).append({
            "id": f"{joueur_id}-ville-{len(pays.get('villes', [])) + 1}",
            "nom": nom, "territoire": terr, "population": POP_NOUVELLE_VILLE,
            "batiments": [], "fortifications": 0, "construction": None,
            "pacification": 18,  # une colonie met des ANNÉES à se développer (~1,5 an)
        })
        pays.setdefault("prov_stab", {})[terr] = min(pays.get("prov_stab", {}).get(terr, 45), 35.0)
        return {"texte": f"Nouvelle ville fondée à {nom}.",
                "resultat": f"{cout} or, {POP_NOUVELLE_VILLE} colons. "
                            f"Colonie naissante : ~1,5 an avant de prospérer."}

    if type_action == "nommer_gouverneur":
        ville_id = params.get("ville")
        ville = next((v for v in pays.get("villes", []) if v.get("id") == ville_id), None)
        if ville is None and pays.get("villes"):
            ville = pays["villes"][0]
        if ville is None:
            return {"texte": "Gouverneur", "resultat": "Échec : aucune ville."}
        if ville.get("gouverneur"):
            return {"texte": "Gouverneur", "resultat": "Cette ville a déjà un gouverneur."}
        # La capitale est gérée par le dirigeant : pas de gouverneur possible.
        if ville.get("territoire") == _capitale_faction(pays.get("id", "")):
            return {"texte": "Gouverneur", "resultat": "Pas de gouverneur dans la capitale (gérée par le dirigeant)."}
        # Limite de gouverneurs (débloquée par technos/dogmes).
        maxg = _max_gouverneurs(pays)
        actuels = sum(1 for v in pays.get("villes", []) if v.get("gouverneur"))
        if actuels >= maxg:
            return {"texte": "Gouverneur",
                    "resultat": f"Limite atteinte ({actuels}/{maxg}). Débloquez plus de gouverneurs (technos/dogmes)."}
        if res.get("or", 0) < COUT_GOUVERNEUR:
            return {"texte": "Gouverneur", "resultat": f"Échec : il faut {COUT_GOUVERNEUR} or."}
        res["or"] = round(res.get("or", 0) - COUT_GOUVERNEUR, 1)
        ville["gouverneur"] = True
        ville["pacification"] = 0  # le gouverneur rétablit l'ordre immédiatement
        return {"texte": f"Gouverneur nommé à {ville.get('nom')}.",
                "resultat": f"{COUT_GOUVERNEUR} or. +12 stabilité locale, ordre rétabli ({actuels + 1}/{maxg})."}

    if type_action == "adopter_dogme":
        did = params.get("dogme")
        d = dogme_par_id(did)
        if not d:
            return {"texte": "Dogme", "resultat": "Échec : dogme inconnu."}
        adoptes = pays.setdefault("dogmes", [])
        if did in adoptes:
            return {"texte": "Dogme", "resultat": "Dogme déjà adopté."}
        if not all(p in adoptes for p in d.get("prerequis", [])):
            return {"texte": "Dogme", "resultat": "Échec : prérequis non adoptés."}
        cout = int(d.get("cout_or", 150))
        if res.get("or", 0) < cout:
            return {"texte": "Dogme", "resultat": f"Échec : il faut {cout} or."}
        res["or"] = round(res.get("or", 0) - cout, 1)
        adoptes.append(did)
        return {"texte": f"Dogme adopté : {d['nom']}.", "resultat": f"{cout} or. {d.get('effet', '')}"}

    if type_action == "definir_impots":
        niveau = params.get("niveau")
        if niveau not in IMPOTS:
            return {"texte": "Impôts", "resultat": "Niveau d'imposition inconnu."}
        pays["impots"] = niveau
        i = IMPOTS[niveau]
        return {"texte": f"Impôts réglés sur « {i['nom']} ».",
                "resultat": f"Or {int(i['or_pop'] * 100)}%/habitant, stabilité {i['stab']:+d}."}

    if type_action in ("restaurer_merveille", "fouiller_merveille", "construire_merveille"):
        wid = params.get("merveille")
        if wid not in merveilles.MERVEILLES:
            return {"texte": "Merveille", "resultat": "Échec : merveille inconnue."}
        w = merveilles.MERVEILLES[wid]
        st = state.setdefault("merveilles", {}).setdefault(wid, {})
        luxe = pays.setdefault("ressources_luxe", {})
        if type_action == "restaurer_merveille":
            if w["type"] != "ruine":
                return {"texte": "Merveille", "resultat": "Échec : ne se restaure pas."}
            if st.get("etat") != "ruine":
                return {"texte": "Merveille", "resultat": "Déjà restaurée ou en chantier."}
            if w["province"] not in pays.get("territoires", []):
                return {"texte": "Merveille", "resultat": "Échec : contrôlez d'abord sa province."}
            verbe, etat = "Restauration", "en_restauration"
        elif type_action == "fouiller_merveille":
            if w["type"] != "fouille":
                return {"texte": "Merveille", "resultat": "Échec : ne se fouille pas."}
            if st.get("etat") != "site":
                return {"texte": "Merveille", "resultat": "Site déjà fouillé ou en cours."}
            if w["province"] not in pays.get("territoires", []):
                return {"texte": "Merveille", "resultat": "Échec : contrôlez d'abord sa province."}
            verbe, etat = "Fouille", "fouille_en_cours"
        else:  # construire_merveille
            if w["type"] != "construction":
                return {"texte": "Merveille", "resultat": "Échec : ne se construit pas."}
            if st.get("etat") not in (None, "non_construite"):
                return {"texte": "Merveille", "resultat": "Déjà bâtie ou en chantier (unique au monde)."}
            tech_req = w.get("tech_requise")
            if tech_req and tech_req not in pays.get("technologies", []):
                return {"texte": "Merveille", "resultat": f"Échec : technologie requise ({tech_req})."}
            ville = next((v for v in pays.get("villes", []) if v.get("id") == params.get("ville")), None)
            if ville is None and pays.get("villes"):
                ville = pays["villes"][0]
            if ville is None:
                return {"texte": "Merveille", "resultat": "Échec : aucune ville."}
            st["ville"] = ville.get("id")
            verbe, etat = "Chantier", "en_construction"
        cout = _cout_inflation(pays, w.get("cout_or", 0))
        cout_res = dict(w.get("cout_res", {}))
        if res.get("or", 0) < cout:
            return {"texte": "Merveille", "resultat": "Échec : or insuffisant."}
        manque = next((r for r, v in cout_res.items()
                       if (luxe.get(r, 0) if r == "marbre" else res.get(r, 0)) < v), None)
        if manque:
            return {"texte": "Merveille", "resultat": f"Échec : {manque} insuffisant ({cout_res[manque]} requis)."}
        res["or"] -= cout
        for r, v in cout_res.items():
            if r == "marbre":
                luxe[r] = round(luxe.get(r, 0) - v, 1)
            else:
                res[r] = round(res.get(r, 0) - v, 1)
        dur = w.get("duree", 3)
        st["proprietaire"] = joueur_id
        st["etat"] = etat
        st["chantier"] = {"tours_restants": dur, "duree": dur}
        res_txt = (" + " + ", ".join(f"{int(v)} {r}" for r, v in cout_res.items())) if cout_res else ""
        return {"texte": f"{verbe} : {w['nom']} ({dur} tours).",
                "resultat": f"{cout} or{res_txt} investis."}

    if type_action == "rechercher":
        tech_id = params.get("tech")
        ok, _ = tech_tree.peut_rechercher(tech_id, pays.get("technologies", []))
        if ok:
            pays["recherche_en_cours"] = {
                "tech": tech_id, "progres": 0,
                "cout": tech_tree.cout_recherche(tech_id)}
            return {"texte": f"Recherche orientée vers {tech_id}.",
                    "resultat": "Recherche en cours."}
        return {"texte": "Recherche", "resultat": "Échec : prérequis non remplis."}

    if type_action == "envoyer_ressources" and cible:
        montant = params.get("ressources") or {}
        cible_pays = state.get("pays", {}).get(cible)
        if cible_pays:
            for r, v in montant.items():
                if res.get(r, 0) >= v:
                    res[r] -= v
                    cible_pays.setdefault("ressources", {})[r] = \
                        cible_pays["ressources"].get(r, 0) + v
            # L'aide améliore la réputation.
            _ajuster_reputation(state, joueur_id, cible, +10)
            return {"texte": f"Aide envoyée à {cible}.", "resultat": "Réputation améliorée."}
        return {"texte": "Aide", "resultat": "Échec : cible inconnue."}

    if type_action == "organiser_jeux":
        if res.get("or", 0) >= COUT_JEUX:
            res["or"] -= COUT_JEUX
            pays["stabilite"] = min(100, pays.get("stabilite", 70) + BONUS_STABILITE_JEUX)
            return {"texte": "Des Jeux sont organisés.",
                    "resultat": f"+{BONUS_STABILITE_JEUX} stabilité."}
        return {"texte": "Jeux", "resultat": "Échec : or insuffisant."}

    if type_action == "traite_commercial" and cible:
        state.setdefault("diplomatie", {}).setdefault("traites_actifs", []).append({
            "type": "commercial", "parties": [joueur_id, cible],
            "tour": state.get("meta", {}).get("tour")})
        _ajuster_reputation(state, joueur_id, cible, +15)
        return {"texte": f"Traité commercial proposé à {cible}.",
                "resultat": "Relations améliorées."}

    if type_action == "envoyer_ambassadeur" and cible:
        _ajuster_reputation(state, joueur_id, cible, +5)
        return {"texte": f"Ambassadeur envoyé à {cible}.",
                "resultat": "Relations légèrement améliorées."}

    if type_action == "declarer_guerre" and cible:
        guerres = state.setdefault("diplomatie", {}).setdefault("guerres_actives", [])
        if not any({g.get("a"), g.get("b")} == {joueur_id, cible} for g in guerres):
            guerres.append({"a": joueur_id, "b": cible,
                            "tour": state.get("meta", {}).get("tour")})
        _ajuster_reputation(state, joueur_id, cible, -40)
        return {"texte": f"Guerre déclarée à {cible}.", "resultat": "État de guerre."}

    if type_action == "demander_paix" and cible:
        guerres = state.setdefault("diplomatie", {}).setdefault("guerres_actives", [])
        state["diplomatie"]["guerres_actives"] = [
            g for g in guerres if {g.get("a"), g.get("b")} != {joueur_id, cible}]
        _ajuster_reputation(state, joueur_id, cible, +20)
        return {"texte": f"Paix demandée à {cible}.", "resultat": "Guerre suspendue."}

    # Texte libre ou type non géré : enregistré tel quel.
    texte = (action or {}).get("texte", "") or params.get("texte", "")
    return {"texte": texte or f"Action {type_action}.",
            "resultat": "Action prise en compte."}


def _compteur_unites(pays: dict) -> int:
    return len(pays.get("unites", [])) + 1


def deplacer_unite(state: dict, unit_id: str, territoire_cible: str) -> dict:
    """Déplace une unité du JOUEUR d'une région à une région ADJACENTE (1/tour).

    Retourne {ok, raison, state}. Ne change pas la possession du territoire
    (la conquête reste une évolution future) ; gère seulement le mouvement.
    """
    joueur = state.get("meta", {}).get("joueur_pays")
    pays = state.get("pays", {}).get(joueur, {})
    unite = next((u for u in pays.get("unites", []) if u.get("id") == unit_id), None)
    if not unite:
        return {"ok": False, "raison": "Unité introuvable."}
    if unite.get("a_bouge"):
        return {"ok": False, "raison": "Cette unité a déjà bougé ce tour."}
    origine = unite.get("territoire")
    if territoire_cible == origine:
        return {"ok": False, "raison": "L'unité est déjà sur cette région."}

    par_terre = territoire_cible in _adjacents(origine)
    par_mer = territoire_cible in _adjacents_mer(origine)
    if not par_terre and not par_mer:
        return {"ok": False, "raison": "Région non adjacente : déplacement impossible."}
    if par_mer and not par_terre:
        if TECH_NAVIGATION not in pays.get("technologies", []):
            return {"ok": False,
                    "raison": "Traversée maritime impossible : recherchez « Navigation maritime »."}

    proprio = _proprietaire(state, territoire_cible)
    if proprio and proprio != joueur:
        return {"ok": False,
                "raison": "Province étrangère : la conquête de territoires ennemis viendra plus tard."}

    # DÉPLACEMENT LIBRE : on traverse une province neutre sans la conquérir.
    # L'annexion est une action séparée et optionnelle (cf. annexer_province).
    unite["territoire"] = territoire_cible
    unite["a_bouge"] = True
    voisin_neutre = proprio is None
    return {"ok": True,
            "raison": f"Armée déplacée vers {_nom_territoire(territoire_cible)}."
                      + (" (province neutre — annexion possible)" if voisin_neutre else ""),
            "annexable": voisin_neutre, "territoire": territoire_cible}


def annexer_province(state: dict, territoire_cible: str) -> dict:
    """Annexe une province NEUTRE où le joueur a une armée. Coûteux + déstabilisant."""
    joueur = state.get("meta", {}).get("joueur_pays")
    pays = state.get("pays", {}).get(joueur, {})
    if territoire_cible in pays.get("territoires", []):
        return {"ok": False, "raison": "Province déjà sous votre contrôle."}
    if _proprietaire(state, territoire_cible) is not None:
        return {"ok": False, "raison": "Province appartenant déjà à une puissance."}
    if not any(u.get("territoire") == territoire_cible for u in pays.get("unites", [])):
        return {"ok": False, "raison": "Vous devez y stationner une armée pour l'annexer."}
    res = pays.setdefault("ressources", {})
    # Coût EXPONENTIEL avec la taille de l'empire : chaque nouvelle province coûte bien
    # plus cher à intégrer (frein fort à l'expansion en boule de neige) + inflation.
    nb = len(pays.get("territoires", []))
    base = COUT_CONQUETE_OR * (1.3 ** nb) * (1 - effets_dogmes(pays.get("dogmes", []))["cout_annexion_pct"])
    cout = _cout_inflation(pays, base)
    if res.get("or", 0) < cout:
        return {"ok": False, "raison": f"Annexion impossible : il faut {cout} or (empire étendu)."}
    res["or"] = round(res.get("or", 0) - cout, 1)
    pays.setdefault("territoires", []).append(territoire_cible)
    # La province annexée apporte sa POPULATION (sujets locaux).
    pop_gain = _population_territoire(territoire_cible)
    res["population"] = round(res.get("population", 0) + pop_gain, 1)
    # Province fraîchement conquise : stabilité locale basse (agitée), tire la moyenne.
    pays.setdefault("prov_stab", {})[territoire_cible] = 28.0
    calculer_stabilite(pays, state)
    return {"ok": True,
            "raison": f"{_nom_territoire(territoire_cible)} annexée ! "
                      f"({cout} or, +{pop_gain} population ; province agitée, à pacifier)"}


def _ajuster_reputation(state: dict, source: str, cible: str, delta: int) -> None:
    """Ajuste la réputation bilatérale (cible perçoit source)."""
    pays = state.get("pays", {})
    if cible in pays:
        rep = pays[cible].setdefault("reputation", {})
        rep[source] = max(-100, min(100, rep.get(source, 0) + delta))
    if source in pays:
        rep = pays[source].setdefault("reputation", {})
        rep[cible] = max(-100, min(100, rep.get(cible, 0) + delta))
