"""Ressources de LUXE : gisements semés au hasard sur la carte à chaque partie.

Règles :
- Au début d'une partie, ~un tiers des provinces reçoit UN gisement (jamais une
  capitale de départ : une richesse se conquiert, elle n'est pas offerte).
- Le type de gisement tient compte du terrain et de la latitude (ivoire et épices
  au sud, ambre au nord, marbre et fer en montagne, sel et or au désert, pourpre
  sur les côtes…), pour que la carte « raconte » quelque chose.
- Un gisement ne rapporte rien tant qu'il n'est pas EXPLOITÉ : il faut, dans la
  province, une cité dotée du bâtiment adéquat (mine, carrière, ferme, marché,
  port). Une province sans cité reste donc à coloniser avant d'en tirer profit.
- Le marbre s'ACCUMULE (il sert aux merveilles) ; les autres luxes donnent un
  revenu ou un bonus tant que le gisement est exploité.

L'emplacement des gisements vit dans state["gisements"] = {province: luxe}.
"""
from __future__ import annotations
import random

# Registre statique des luxes.
LUXES: dict[str, dict] = {
    "vin": {"nom": "Vin", "icone": "🍇", "batiment": "ferme",
            "effet": {"or": 3, "stabilite": 2},
            "desc": "Des coteaux qui donnent un vin recherché de toutes les cours."},
    "grain": {"nom": "Grain", "icone": "🌾", "batiment": "ferme",
              "effet": {"nourriture": 5},
              "desc": "Une plaine d'une fertilité rare : les greniers débordent."},
    "epices": {"nom": "Épices", "icone": "🌶", "batiment": "marche",
               "effet": {"or": 5},
               "desc": "Poivre, cannelle, safran : leur commerce vaut de l'or."},
    "ivoire": {"nom": "Ivoire", "icone": "🐘", "batiment": "marche",
               "effet": {"or": 4, "prestige": 1},
               "desc": "Les défenses des grands éléphants, prisées des sculpteurs."},
    "ambre": {"nom": "Ambre", "icone": "🟠", "batiment": "marche",
              "effet": {"or": 4},
              "desc": "L'or du Nord, rejeté par la mer et vendu jusqu'en Orient."},
    "pourpre": {"nom": "Pourpre", "icone": "🐚", "batiment": "port",
                "effet": {"or": 5, "prestige": 1},
                "desc": "Le murex des côtes : la teinture des rois, hors de prix."},
    "or": {"nom": "Filon d'or", "icone": "✨", "batiment": "mine",
           "effet": {"or": 6},
           "desc": "Un filon qui affleure : de quoi frapper monnaie."},
    "fer": {"nom": "Fer riche", "icone": "⛏", "batiment": "mine",
            "effet": {"fer": 3},
            "desc": "Un minerai abondant : les forges n'en manqueront jamais."},
    "sel": {"nom": "Sel", "icone": "🧂", "batiment": "mine",
            "effet": {"or": 2, "nourriture": 2},
            "desc": "Le sel conserve les vivres et se vend au poids de l'argent."},
    "marbre": {"nom": "Marbre", "icone": "⬜", "batiment": "carriere",
               "effet": {"marbre": 1.2},
               "desc": "Un marbre blanc sans veine : la matière des merveilles."},
}

PART_PROVINCES = 0.20   # fraction des provinces qui reçoivent un gisement (~36 sur 182)


def _pool(terrain: str, y: float, cotier: bool, y_min: float, y_max: float) -> list[str]:
    """Types possibles pour une province, pondérés par terrain, latitude et côte."""
    nord = y < y_min + (y_max - y_min) * 0.33
    sud = y > y_min + (y_max - y_min) * 0.66
    pool: list[str] = []
    if terrain == "montagne":
        pool += ["marbre"] * 3 + ["fer"] * 3 + ["or"] * 2
    elif terrain == "desert":
        pool += ["sel"] * 3 + ["or"] * 2 + ["epices"] * 2
    elif terrain == "fertile":
        pool += ["grain"] * 4 + ["vin"] * 2
    else:  # plaine
        pool += ["vin"] * 3 + ["grain"] * 2 + ["fer"] * 2 + ["marbre"] * 2 + ["sel"] * 1 + ["or"] * 1 + ["epices"] * 1
    if nord:
        pool += ["ambre"] * 3 + ["fer"] * 1
    if sud:
        pool += ["ivoire"] * 3 + ["epices"] * 3
    if cotier:
        pool += ["pourpre"] * 3
    return pool


def semer(territoires: list[dict], exclure: set[str], rng: random.Random | None = None) -> dict[str, str]:
    """Tire les gisements d'une nouvelle partie. `exclure` = capitales de départ."""
    rng = rng or random.Random()
    ys = [t.get("centre", [0, 0])[1] for t in territoires]
    y_min, y_max = min(ys), max(ys)
    candidats = [t for t in territoires if t["id"] not in exclure]
    nb = int(round(len(territoires) * PART_PROVINCES))
    choisis = rng.sample(candidats, min(nb, len(candidats)))
    gisements: dict[str, str] = {}
    for t in choisis:
        pool = _pool(t.get("terrain", "plaine"), t.get("centre", [0, 0])[1],
                     bool(t.get("adjacents_mer")), y_min, y_max)
        gisements[t["id"]] = rng.choice(pool)
    return gisements


def exploites(pays: dict, state: dict) -> list[dict]:
    """Gisements de cette faction dont la province abrite une cité pacifiée avec le
    bâtiment requis. Retourne [{province, luxe}]."""
    gis = state.get("gisements") or {}
    out = []
    for v in pays.get("villes", []):
        tid = v.get("territoire")
        luxe = gis.get(tid)
        if not luxe or tid not in pays.get("territoires", []):
            continue
        if v.get("pacification", 0) > 0:
            continue
        if LUXES[luxe]["batiment"] in v.get("batiments", []):
            out.append({"province": tid, "luxe": luxe})
    return out


def appliquer(pays: dict, state: dict, prod: dict, note) -> dict:
    """Ajoute à `prod` le revenu des gisements exploités et mémorise les luxes
    actifs (affichage, stabilité, prestige). Retourne {stabilite, prestige, marbre}
    pour les autres calculs (sans effet de bord sur les stocks)."""
    actifs = exploites(pays, state)
    pays["luxes_actifs"] = [a["luxe"] for a in actifs]
    # `marbre` = quantité à AJOUTER au stock ce tour (fait une seule fois par le
    # moteur, car le calcul de production est appelé plusieurs fois par tour).
    agg = {"stabilite": 0, "prestige": 0, "marbre": 0.0}
    if not actifs:
        return agg
    par_res: dict[str, float] = {}
    for a in actifs:
        for k, v in LUXES[a["luxe"]]["effet"].items():
            if k in ("stabilite", "prestige", "marbre"):
                agg[k] += v
            else:
                par_res[k] = par_res.get(k, 0) + v
    noms = ", ".join(sorted({LUXES[a["luxe"]]["nom"].lower() for a in actifs}))
    for k, v in par_res.items():
        prod[k] = prod.get(k, 0) + v
        note(k, f"Gisements ({noms})", v)
    return agg


def info_publique() -> list[dict]:
    return [{"id": lid, "nom": l["nom"], "icone": l["icone"], "batiment": l["batiment"],
             "effet": l["effet"], "desc": l["desc"]} for lid, l in LUXES.items()]
