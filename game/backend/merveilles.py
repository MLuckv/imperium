"""Merveilles du monde (54 ap. J.-C.).

Quatre façons de les obtenir (une merveille par type pour cette 1re version) :
- antique     : déjà debout sur la carte → bonus passif si tu CONTRÔLES la province.
- ruine       : à RESTAURER (or + marbre + tours) si tu contrôles la province.
- fouille     : site archéologique → FOUILLER (or + tours) → relique aléatoire.
- construction: grand CHANTIER anticipé bâti dans une de tes villes (or + marbre).

L'état vivant (qui possède quoi, chantiers en cours) est stocké dans
state["merveilles"]. Le registre ci-dessous est, lui, statique.
"""
from __future__ import annotations
import random

# Registre statique des merveilles.
MERVEILLES: dict[str, dict] = {
    "parthenon": {
        "nom": "Parthénon", "type": "antique", "province": "sterea_ellada",
        "desc": "Le temple d'Athéna domine Athènes. Le contrôler éclaire la civilisation.",
        "bonus": {"recherche_pct": 0.15, "stabilite": 6}, "prestige": 3,
    },
    "colosse_rhodes": {
        "nom": "Colosse de Rhodes", "type": "ruine", "province": "notio_aigaio",
        "desc": "Le géant de bronze, abattu par un séisme, gît dans le port de Rhodes.",
        "cout_or": 300, "cout_res": {"marbre": 30, "pierre": 40}, "duree": 30,
        "bonus": {"or": 8, "stabilite": 3}, "prestige": 4,
    },
    "knossos": {
        "nom": "Palais de Cnossos", "type": "fouille", "province": "kriti",
        "desc": "Le labyrinthe minoen dort sous la terre de Crète. Les fouilles peuvent livrer des trésors.",
        "cout_or": 120, "duree": 18, "prestige": 2,
    },
    "colisee": {
        "nom": "Colisée", "type": "construction", "ville": True,
        "desc": "Amphithéâtre colossal : du pain et des jeux pour tout l'empire.",
        "tech_requise": None, "cout_or": 400, "cout_res": {"marbre": 50, "pierre": 60},
        "duree": 48, "bonus": {"stabilite": 12}, "prestige": 5,
    },
}

# Récompenses possibles d'une campagne de fouille (relique = bonus ponctuel).
RELIQUES = [
    {"texte": "un trésor d'or minoen", "ressource": "or", "valeur": 250},
    {"texte": "des tablettes savantes (Linéaire B)", "ressource": "recherche", "valeur": 1},
    {"texte": "un filon de marbre antique", "ressource": "marbre", "valeur": 40},
    {"texte": "des reliques sacrées (ferveur populaire)", "ressource": "stabilite", "valeur": 12},
]


def etat_initial() -> dict:
    """État de départ des merveilles pour une nouvelle partie."""
    etats = {"antique": "intacte", "ruine": "ruine", "fouille": "site",
             "construction": "non_construite"}
    return {wid: {"etat": etats[w["type"]], "proprietaire": None,
                  "ville": None, "chantier": None}
            for wid, w in MERVEILLES.items()}


def _controle(prov: str, state: dict) -> str | None:
    for fid, p in state.get("pays", {}).items():
        if prov in p.get("territoires", []):
            return fid
    return None


def proprietaire(wid: str, state: dict) -> str | None:
    """Faction qui bénéficie de la merveille (None si personne)."""
    w = MERVEILLES[wid]
    st = state.get("merveilles", {}).get(wid, {})
    if w["type"] == "antique":
        return _controle(w["province"], state)
    if w["type"] == "ruine":
        return _controle(w["province"], state) if st.get("etat") == "restauree" else None
    if w["type"] == "construction":
        return st.get("proprietaire") if st.get("etat") == "construite" else None
    return None  # fouille : pas de bonus passif (relique ponctuelle)


def bonus_actif(pays: dict, state: dict) -> dict:
    """Somme des bonus des merveilles actives pour cette faction."""
    agg = {"or": 0.0, "nourriture": 0.0, "eau": 0.0, "recherche_pct": 0.0,
           "stabilite": 0, "prestige": 0, "nb": 0}
    for wid, w in MERVEILLES.items():
        if proprietaire(wid, state) == pays.get("id"):
            for k, v in w.get("bonus", {}).items():
                agg[k] = agg.get(k, 0) + v
            agg["prestige"] += w.get("prestige", 0)
            agg["nb"] += 1
    return agg


def avancer_chantiers(state: dict, evenements: list) -> None:
    """Décrémente les chantiers de merveilles et applique les achèvements."""
    merv = state.setdefault("merveilles", {})
    for wid, st in merv.items():
        ch = st.get("chantier")
        if not ch:
            continue
        ch["tours_restants"] -= 1
        if ch["tours_restants"] > 0:
            continue
        w = MERVEILLES[wid]
        fid = st.get("proprietaire")
        st["chantier"] = None
        if w["type"] == "ruine":
            st["etat"] = "restauree"
            evenements.append({"type": "merveille", "faction": fid,
                               "texte": f"Merveille restaurée : {w['nom']} renaît de ses ruines !"})
        elif w["type"] == "construction":
            st["etat"] = "construite"
            evenements.append({"type": "merveille", "faction": fid,
                               "texte": f"Merveille achevée : le {w['nom']} s'élève, à la gloire de l'empire !"})
        elif w["type"] == "fouille":
            st["etat"] = "fouillee"
            rel = random.choice(RELIQUES)
            pays = state.get("pays", {}).get(fid)
            if pays is not None:
                _appliquer_relique(pays, rel)
            evenements.append({"type": "merveille", "faction": fid,
                               "texte": f"Fouilles de {w['nom']} : on exhume {rel['texte']} !"})


def _appliquer_relique(pays: dict, rel: dict) -> None:
    res = pays.setdefault("ressources", {})
    r, v = rel["ressource"], rel["valeur"]
    if r == "stabilite":
        pays["stabilite"] = min(100, pays.get("stabilite", 60) + v)
    elif r == "recherche":
        # Débloque immédiatement la recherche en cours (ou accélère fortement).
        rec = pays.get("recherche_en_cours")
        if rec:
            rec["points_accumules"] = rec.get("cout", 9999)
    else:
        pays.setdefault("ressources_luxe" if r == "marbre" else "ressources", {})
        cible = pays["ressources_luxe"] if r == "marbre" else res
        cible[r] = round(cible.get(r, 0) + v, 1)


def info_publique() -> list[dict]:
    """Registre exposé au frontend (sans l'état vivant)."""
    return [{"id": wid, "nom": w["nom"], "type": w["type"],
             "province": w.get("province"), "desc": w["desc"],
             "cout_or": w.get("cout_or"), "cout_res": w.get("cout_res", {}),
             "duree": w.get("duree"), "tech_requise": w.get("tech_requise"),
             "bonus": w.get("bonus", {}), "prestige": w.get("prestige", 0),
             "ville": w.get("ville", False)}
            for wid, w in MERVEILLES.items()]
