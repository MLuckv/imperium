"""IA des factions adverses : elles JOUENT réellement leur tour.

Chaque dirigeant a des PRIORITÉS de caractère (Alexandre conquiert, Ptolémée veut le
Nil et l'amitié d'Alexandre, Léonidas forge son armée, Néron bâtit sa gloire). À chaque
tour l'IA : règle ses impôts, construit, recrute, s'étend (annexe des provinces neutres),
mène ses guerres (bataille de provinces, jamais la capitale), signe alliances et paix,
et entreprend des merveilles. Retourne la liste des actions faites (pour la chronique).

Importé PARESSEUSEMENT par game_engine.end_turn (évite l'import circulaire).
"""
from __future__ import annotations

import random

import game_engine as ge
from models.unit import FORCES_UNITES, COUTS_UNITES, COUT_RES_UNITES, COUT_POP_UNITES
from models.city import COUT_BATIMENTS, COUT_RES_BATIMENTS, DUREE_BATIMENTS

# Priorités de caractère (cf. fiches data/leaders). agressivite/expansion ∈ [0,1].
PRIORITES_IA: dict[str, dict] = {
    "rome": {       # Néron : gloire, stabilité, monuments ; expansion mesurée en Italie
        "agressivite": 0.35, "expansion": 0.55, "armee_cible": 3, "merveilles": True,
        "batiments": ["scierie", "ferme", "puits", "carriere", "marche", "aqueduc",
                      "forum", "mine", "grenier"],
        "terrain_prefere": None, "allie": None, "rival": None,
    },
    "macedoine": {  # Alexandre : conquête avant tout, armée de choc
        "agressivite": 0.9, "expansion": 0.95, "armee_cible": 5, "merveilles": False,
        "batiments": ["scierie", "ferme", "puits", "camp_militaire", "carriere",
                      "mine", "grenier"],
        "terrain_prefere": None, "allie": "carthage", "rival": "sparte",
    },
    "sparte": {     # Léonidas : peu de terres, beaucoup de fer ; défense farouche
        "agressivite": 0.5, "expansion": 0.3, "armee_cible": 5, "merveilles": False,
        "batiments": ["scierie", "ferme", "puits", "camp_militaire", "murailles",
                      "carriere", "mine"],
        "terrain_prefere": None, "allie": None, "rival": "macedoine",
    },
    "carthage": {   # Ptolémée : le NIL (terres fertiles), la richesse, l'alliance macédonienne
        "agressivite": 0.15, "expansion": 0.6, "armee_cible": 2, "merveilles": True,
        "batiments": ["ferme", "puits", "scierie", "marche", "grenier", "carriere",
                      "agora", "aqueduc"],
        "terrain_prefere": "fertile", "allie": "macedoine", "rival": None,
    },
}


def jouer(state: dict, fid: str, evenements: list) -> list[str]:
    """Fait jouer la faction IA `fid`. Retourne les actions accomplies (libellés)."""
    pays = state.get("pays", {}).get(fid)
    if not pays:
        return []
    prio = PRIORITES_IA.get(fid, PRIORITES_IA["rome"])
    actions: list[str] = []
    _impots(pays, actions)
    _gouverneurs(pays, fid, actions)
    _fonder_ville(state, fid, pays, actions)
    _construire(pays, actions)
    _recruter(pays, fid, prio, actions)
    if not _mener_guerres(state, fid, pays, prio, actions, evenements):
        _expansion(state, fid, pays, prio, actions, evenements)
    _alliances(state, fid, pays, prio, actions, evenements)
    _declarer_guerre(state, fid, pays, prio, evenements)
    _faire_la_paix(state, fid, pays, evenements)
    if prio.get("merveilles"):
        _merveilles(state, fid, pays, actions, evenements)
    return actions


# ---------------------------------------------------------------- économie
def _impots(pays: dict, actions: list) -> None:
    stab = pays.get("stabilite", 60)
    niveau = "bas" if stab < 40 else ("eleve" if stab > 70 else "normal")
    if pays.get("impots") != niveau:
        pays["impots"] = niveau
        actions.append(f"ajuste ses impôts ({niveau})")


def _fonder_ville(state: dict, fid: str, pays: dict, actions: list) -> None:
    """Fonde une ville sur une province possédée sans ville (mêmes règles que le joueur :
    coût, colons prélevés, longue pacification). Développe l'économie de l'IA."""
    res = pays.get("ressources", {})
    cout = ge._cout_inflation(pays, ge.COUT_FONDER_VILLE_OR)
    if res.get("or", 0) < cout + 200:  # seulement quand l'IA est à l'aise
        return
    terr = next((t for t in pays.get("territoires", [])
                 if not any(v.get("territoire") == t for v in pays.get("villes", []))), None)
    source = max(pays.get("villes", []), key=lambda v: v.get("population", 0), default=None)
    if terr is None or source is None or source.get("population", 0) <= ge.POP_NOUVELLE_VILLE + 6:
        return
    res["or"] = round(res["or"] - cout, 1)
    source["population"] = source.get("population", 0) - ge.POP_NOUVELLE_VILLE
    nom = ge._nom_territoire(terr)
    pays.setdefault("villes", []).append({
        "id": f"{fid}-ville-{len(pays.get('villes', [])) + 1}",
        "nom": nom, "territoire": terr, "population": ge.POP_NOUVELLE_VILLE,
        "batiments": [], "fortifications": 0, "construction": None,
        "pacification": 18,
    })
    pays.setdefault("prov_stab", {})[terr] = min(pays.get("prov_stab", {}).get(terr, 45), 35.0)
    actions.append(f"fonde une ville à {nom}")


def _gouverneurs(pays: dict, fid: str, actions: list) -> None:
    """Quand la stabilité fléchit, nomme un gouverneur (mêmes règles que le joueur :
    jamais dans la capitale, plafond de gouverneurs)."""
    if pays.get("stabilite", 60) >= 55:
        return
    res = pays.get("ressources", {})
    if res.get("or", 0) < ge.COUT_GOUVERNEUR + 80:
        return
    cap = ge._capitale_faction(fid)
    actuels = sum(1 for v in pays.get("villes", []) if v.get("gouverneur"))
    if actuels >= ge._max_gouverneurs(pays):
        return
    ville = next((v for v in pays.get("villes", [])
                  if not v.get("gouverneur") and v.get("territoire") != cap), None)
    if ville is None:
        return
    res["or"] = round(res["or"] - ge.COUT_GOUVERNEUR, 1)
    ville["gouverneur"] = True
    ville["pacification"] = 0
    actions.append(f"nomme un gouverneur à {ville.get('nom')}")


def _construire(pays: dict, actions: list) -> None:
    """Lance un chantier dans la première ville libre (ordre de priorité du dirigeant).
    Les CONQUÉRANTS gardent une grosse réserve d'or : ils épargnent pour annexer."""
    res = pays.get("ressources", {})
    p_ia = PRIORITES_IA.get(pays.get("id"), {})
    prio = p_ia.get("batiments", [])
    reserve = 40
    if p_ia.get("expansion", 0) >= 0.55 and len(pays.get("territoires", [])) < 5:
        nb = len(pays.get("territoires", []))
        reserve = int(ge.COUT_CONQUETE_OR * (1.3 ** nb)) + 60  # de quoi annexer d'abord
    for ville in pays.get("villes", []):
        if ville.get("construction") or ville.get("pacification", 0) > 0:
            continue
        for bat in prio:
            if bat in ville.get("batiments", []):
                continue
            cout = ge._cout_inflation(pays, COUT_BATIMENTS.get(bat, 999))
            cout_res = COUT_RES_BATIMENTS.get(bat, {})
            if res.get("or", 0) < cout + reserve:
                continue
            if any(res.get(r, 0) < v for r, v in cout_res.items()):
                continue
            res["or"] = round(res["or"] - cout, 1)
            for r, v in cout_res.items():
                res[r] = round(res.get(r, 0) - v, 1)
            duree = DUREE_BATIMENTS.get(bat, 3)
            ville["construction"] = {"batiment": bat, "tours_restants": duree,
                                     "duree": duree, "cout": cout}
            actions.append(f"lance un chantier ({bat}) à {ville.get('nom')}")
            return


def _recruter(pays: dict, fid: str, prio: dict, actions: list) -> None:
    res = pays.get("ressources", {})
    nb = sum(u.get("effectif", 1) for u in pays.get("unites", []))
    cible = prio.get("armee_cible", 3)
    # Les conquérants limitent d'abord l'armée à 3 : la solde ne doit pas manger l'or
    # d'annexion tant que l'empire est petit.
    if prio.get("expansion", 0) >= 0.55 and len(pays.get("territoires", [])) < 3:
        cible = min(cible, 3)
    if nb >= cible or not pays.get("territoires"):
        return
    type_u = "legionnaire" if res.get("fer", 0) >= 6 else "levee"
    cout = ge._cout_inflation(pays, COUTS_UNITES.get(type_u, 0))
    cout_pop = COUT_POP_UNITES.get(type_u, 1)
    cout_res = COUT_RES_UNITES.get(type_u, {})
    if res.get("or", 0) < cout + 60 or res.get("population", 0) < cout_pop + 8:
        return
    if any(res.get(r, 0) < v for r, v in cout_res.items()):
        return
    res["or"] = round(res["or"] - cout, 1)
    res["population"] = round(res["population"] - cout_pop, 1)
    for r, v in cout_res.items():
        res[r] = round(res.get(r, 0) - v, 1)
    pays.setdefault("unites", []).append({
        "id": f"{fid}-{type_u}-{random.randint(1000, 999999)}",
        "type": type_u, "territoire": pays["territoires"][0],
        "effectif": 1, "moral": 90, "a_bouge": False,
    })
    actions.append(f"lève des troupes ({type_u})")


# ---------------------------------------------------------------- expansion
def _centre(tid: str) -> tuple[float, float]:
    for t in ge.charger_territoires().get("territoires", []):
        if t["id"] == tid:
            c = t.get("centre") or [0, 0]
            return (c[0], c[1])
    return (0.0, 0.0)


def _expansion(state: dict, fid: str, pays: dict, prio: dict,
               actions: list, evenements: list) -> None:
    """Avance une unité vers la meilleure province NEUTRE voisine et l'annexe si possible.
    Ptolémée privilégie les terres fertiles (le Nil), les autres la proximité."""
    if random.random() > prio.get("expansion", 0.5):
        return
    res = pays.setdefault("ressources", {})
    cap = ge._capitale_faction(fid)
    cx, cy = _centre(cap) if cap else (0, 0)

    def score(tid: str) -> float:
        s = 0.0
        if prio.get("terrain_prefere") and ge._terrain_territoire(tid) == prio["terrain_prefere"]:
            s += 100.0  # le Nil avant tout
        x, y = _centre(tid)
        s -= ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / 60.0  # proche de la capitale
        return s

    # 1) Annexe si une unité campe déjà sur une province neutre (coût croissant + inflation).
    for u in pays.get("unites", []):
        tid = u.get("territoire")
        if tid and ge._proprietaire(state, tid) is None:
            nb = len(pays.get("territoires", []))
            cout = ge._cout_inflation(pays, ge.COUT_CONQUETE_OR * (1.3 ** nb))
            if res.get("or", 0) >= cout + 20:
                res["or"] = round(res["or"] - cout, 1)
                pays.setdefault("territoires", []).append(tid)
                res["population"] = round(res.get("population", 0) + ge._population_territoire(tid), 1)
                pays.setdefault("prov_stab", {})[tid] = 30.0
                actions.append(f"annexe {ge._nom_territoire(tid)}")
                evenements.append({"type": "expansion", "faction": fid,
                                   "texte": f"{ge.META_FACTIONS.get(fid, {}).get('nom', fid)} annexe {ge._nom_territoire(tid)}."})
                return
    # 2) Sinon, déplace une unité libre vers la meilleure cible neutre adjacente.
    libre = next((u for u in pays.get("unites", []) if not u.get("a_bouge")), None)
    if not libre:
        return
    voisins = [t for t in ge._adjacents(libre.get("territoire", ""))
               if ge._proprietaire(state, t) is None]
    if voisins:
        cible = max(voisins, key=score)
        libre["territoire"] = cible
        libre["a_bouge"] = True


# ---------------------------------------------------------------- guerre
def _force_totale(pays: dict) -> float:
    return sum(FORCES_UNITES.get(u.get("type"), 1) * u.get("effectif", 1)
               for u in pays.get("unites", []))


def _guerres_de(state: dict, fid: str) -> list[dict]:
    return [g for g in state.get("diplomatie", {}).get("guerres_actives", [])
            if fid in (g.get("a"), g.get("b"))]


def _allies_entre(state: dict, a: str, b: str) -> bool:
    return any(t.get("type") == "alliance" and {a, b} == {t.get("a"), t.get("b")}
               for t in state.get("diplomatie", {}).get("traites_actifs", []))


def _mener_guerres(state: dict, fid: str, pays: dict, prio: dict,
                   actions: list, evenements: list) -> bool:
    """En guerre : tente de prendre une province ennemie frontalière (JAMAIS la capitale).
    Bataille simple : il faut un net avantage de force ; pertes des deux côtés."""
    guerres = _guerres_de(state, fid)
    if not guerres:
        return False
    nom_fid = ge.META_FACTIONS.get(fid, {}).get("nom", fid)
    for g in guerres:
        ennemi = g["a"] if g.get("b") == fid else g["b"]
        cible = state.get("pays", {}).get(ennemi)
        if not cible:
            continue
        cap_e = ge._capitale_faction(ennemi)
        frontieres = [t for t in cible.get("territoires", []) if t != cap_e
                      and any(v in pays.get("territoires", []) for v in ge._adjacents(t))]
        ma_force, sa_force = _force_totale(pays), _force_totale(cible)
        if not frontieres or ma_force < sa_force * 1.15 or random.random() > 0.6:
            continue
        prov = random.choice(frontieres)
        # Pertes : le défenseur perd sa plus faible unité ; l'attaquant parfois aussi.
        if cible.get("unites"):
            faible = min(cible["unites"], key=lambda u: FORCES_UNITES.get(u.get("type"), 1))
            cible["unites"] = [u for u in cible["unites"] if u is not faible]
        if pays.get("unites") and random.random() < 0.35:
            faible = min(pays["unites"], key=lambda u: FORCES_UNITES.get(u.get("type"), 1))
            pays["unites"] = [u for u in pays["unites"] if u is not faible]
        # Transfert de la province (les défenseurs refluent vers leur capitale).
        cible["territoires"] = [t for t in cible["territoires"] if t != prov]
        cible.get("prov_stab", {}).pop(prov, None)
        for u in cible.get("unites", []):
            if u.get("territoire") == prov and cap_e:
                u["territoire"] = cap_e
        villes_prises = [v for v in cible.get("villes", []) if v.get("territoire") == prov]
        cible["villes"] = [v for v in cible.get("villes", []) if v.get("territoire") != prov]
        for v in villes_prises:
            v["gouverneur"] = False
            v["pacification"] = 8
            pays.setdefault("villes", []).append(v)
        pop = ge._population_territoire(prov)
        pays.setdefault("territoires", []).append(prov)
        pays.setdefault("prov_stab", {})[prov] = 22.0
        pays["ressources"]["population"] = round(pays["ressources"].get("population", 0) + pop, 1)
        cible["ressources"]["population"] = max(0.0, round(cible["ressources"].get("population", 0) - pop, 1))
        actions.append(f"prend {ge._nom_territoire(prov)} à {ge.META_FACTIONS.get(ennemi, {}).get('nom', ennemi)}")
        evenements.append({"type": "guerre", "faction": fid,
                           "texte": f"⚔ Bataille : {nom_fid} arrache {ge._nom_territoire(prov)} "
                                    f"à {ge.META_FACTIONS.get(ennemi, {}).get('nom', ennemi)} !"})
        return True
    return True  # en guerre : on ne s'étend pas en parallèle


def _declarer_guerre(state: dict, fid: str, pays: dict, prio: dict, evenements: list) -> None:
    """Un dirigeant agressif peut déclarer la guerre à son RIVAL (IA↔IA) s'il domine."""
    rival = prio.get("rival")
    if not rival or rival not in state.get("pays", {}):
        return
    joueur = state.get("meta", {}).get("joueur_pays")
    if rival == joueur:  # les guerres contre le joueur passent par les messages spontanés
        return
    if _guerres_de(state, fid) or _allies_entre(state, fid, rival):
        return
    cible = state["pays"][rival]
    if _force_totale(pays) < _force_totale(cible) * 1.3:
        return
    if random.random() > prio.get("agressivite", 0.3) * 0.07:
        return
    state.setdefault("diplomatie", {}).setdefault("guerres_actives", []).append(
        {"a": fid, "b": rival, "depuis": state.get("meta", {}).get("tour", 1)})
    evenements.append({"type": "guerre", "faction": fid,
                       "texte": f"⚔ {ge.META_FACTIONS.get(fid, {}).get('nom', fid)} déclare la GUERRE "
                                f"à {ge.META_FACTIONS.get(rival, {}).get('nom', rival)} !"})


def _faire_la_paix(state: dict, fid: str, pays: dict, evenements: list) -> None:
    """Les guerres qui s'enlisent finissent par une paix blanche."""
    tour = state.get("meta", {}).get("tour", 1)
    diplo = state.get("diplomatie", {})
    for g in list(_guerres_de(state, fid)):
        if tour - g.get("depuis", tour) >= 18 and random.random() < 0.2:
            diplo["guerres_actives"].remove(g)
            autre = g["a"] if g.get("b") == fid else g["b"]
            for x, y in ((fid, autre), (autre, fid)):
                rep = state["pays"].get(x, {}).setdefault("reputation", {})
                rep[y] = min(100, rep.get(y, 0) + 10)
            evenements.append({"type": "paix", "faction": fid,
                               "texte": f"🕊 La guerre entre {ge.META_FACTIONS.get(fid, {}).get('nom', fid)} et "
                                        f"{ge.META_FACTIONS.get(autre, {}).get('nom', autre)} s'achève, épuisée."})


# ---------------------------------------------------------------- diplomatie & merveilles
def _alliances(state: dict, fid: str, pays: dict, prio: dict,
               actions: list, evenements: list) -> None:
    """Scelle l'alliance de cœur du dirigeant (ex. Ptolémée ↔ Alexandre), IA↔IA."""
    allie = prio.get("allie")
    joueur = state.get("meta", {}).get("joueur_pays")
    if (not allie or allie == joueur or allie not in state.get("pays", {})
            or _allies_entre(state, fid, allie)):
        return
    if any(allie in (g.get("a"), g.get("b")) for g in _guerres_de(state, fid)):
        return
    rep = pays.get("reputation", {}).get(allie, 0)
    if state.get("meta", {}).get("tour", 1) < 8:  # les cours s'observent d'abord
        return
    if rep < -10 or random.random() > 0.15:
        return
    state.setdefault("diplomatie", {}).setdefault("traites_actifs", []).append(
        {"type": "alliance", "a": fid, "b": allie,
         "depuis": state.get("meta", {}).get("tour", 1)})
    for x, y in ((fid, allie), (allie, fid)):
        r = state["pays"][x].setdefault("reputation", {})
        r[y] = min(100, r.get(y, 0) + 25)
    n1 = ge.META_FACTIONS.get(fid, {}).get("nom", fid)
    n2 = ge.META_FACTIONS.get(allie, {}).get("nom", allie)
    actions.append(f"scelle une alliance avec {n2}")
    evenements.append({"type": "accord", "faction": fid,
                       "texte": f"🤝 {n1} et {n2} scellent une ALLIANCE."})


def _merveilles(state: dict, fid: str, pays: dict, actions: list, evenements: list) -> None:
    """Les bâtisseurs (Néron, Ptolémée) entreprennent des merveilles quand ils le peuvent."""
    import merveilles as mv
    res = pays.setdefault("ressources", {})
    luxe = pays.setdefault("ressources_luxe", {})
    for wid, w in mv.MERVEILLES.items():
        st = state.setdefault("merveilles", {}).setdefault(wid, {})
        if st.get("chantier"):
            continue
        cout = w.get("cout_or", 0)
        cout_res = w.get("cout_res", {})
        peut_payer = (res.get("or", 0) >= cout + 100
                      and all((luxe if r == "marbre" else res).get(r, 0) >= v
                              for r, v in cout_res.items()))
        prov_ok = (not w.get("province")) or w["province"] in pays.get("territoires", [])
        lancable = ((w["type"] == "construction" and st.get("etat") in (None, "non_construite"))
                    or (w["type"] == "ruine" and st.get("etat") == "ruine" and prov_ok)
                    or (w["type"] == "fouille" and st.get("etat") == "site" and prov_ok))
        if not (peut_payer and lancable):
            continue
        res["or"] = round(res["or"] - cout, 1)
        for r, v in cout_res.items():
            cible = luxe if r == "marbre" else res
            cible[r] = round(cible.get(r, 0) - v, 1)
        etat = {"construction": "en_construction", "ruine": "en_restauration",
                "fouille": "fouille_en_cours"}[w["type"]]
        st.update({"proprietaire": fid, "etat": etat,
                   "chantier": {"tours_restants": w.get("duree", 12), "duree": w.get("duree", 12)}})
        if w["type"] == "construction" and pays.get("villes"):
            st["ville"] = pays["villes"][0].get("id")
        nom_f = ge.META_FACTIONS.get(fid, {}).get("nom", fid)
        actions.append(f"entreprend la merveille « {w['nom']} »")
        evenements.append({"type": "merveille", "faction": fid,
                           "texte": f"✦ {nom_f} entreprend « {w['nom']} » !"})
        return
