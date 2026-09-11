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
        "agressivite": 0.35, "expansion": 0.55, "armee_cible": 4, "merveilles": True,
        "unite": "legionnaire",
        "batiments": ["scierie", "ferme", "puits", "carriere", "marche", "aqueduc",
                      "forum", "mine", "grenier", "port", "murailles", "camp_militaire",
                      "agora"],
        "terrain_prefere": None, "allie": None, "rival": None,
    },
    "macedoine": {  # Alexandre : conquête avant tout, armée de choc
        "agressivite": 0.9, "expansion": 0.95, "armee_cible": 7, "merveilles": False,
        "unite": "phalange",
        "batiments": ["scierie", "ferme", "puits", "camp_militaire", "carriere",
                      "mine", "grenier", "murailles", "marche", "aqueduc", "agora",
                      "forum", "port"],
        "terrain_prefere": None, "allie": "carthage", "rival": "sparte",
    },
    "sparte": {     # Léonidas : peu de terres, beaucoup de fer ; défense farouche
        "agressivite": 0.5, "expansion": 0.3, "armee_cible": 6, "merveilles": False,
        "unite": "hoplite",
        "batiments": ["scierie", "ferme", "puits", "camp_militaire", "murailles",
                      "carriere", "mine", "grenier", "marche", "agora", "aqueduc",
                      "forum", "port"],
        "terrain_prefere": None, "allie": None, "rival": "macedoine",
    },
    "carthage": {   # Ptolémée : le NIL (terres fertiles), la richesse, l'alliance macédonienne
        "agressivite": 0.15, "expansion": 0.5, "armee_cible": 3, "merveilles": True,
        "unite": "infanterie_legere",
        "batiments": ["ferme", "puits", "scierie", "marche", "grenier", "carriere",
                      "agora", "aqueduc", "port", "forum", "mine", "murailles",
                      "camp_militaire"],
        "terrain_prefere": "fertile", "allie": "macedoine", "rival": None,
    },
    "francs": {     # Jeanne : délivrer et tenir le royaume, foi et discipline, peu de conquête
        "agressivite": 0.45, "expansion": 0.6, "armee_cible": 6, "merveilles": True,
        "unite": "legionnaire",
        "batiments": ["ferme", "puits", "scierie", "camp_militaire", "grenier", "carriere",
                      "murailles", "marche", "mine", "aqueduc", "forum", "agora", "port"],
        "terrain_prefere": "fertile", "allie": None, "rival": "bretons",
    },
    "bretons": {    # Arthur : unir l'île, peu d'hommes mais irréprochables, défense
        "agressivite": 0.35, "expansion": 0.45, "armee_cible": 5, "merveilles": True,
        "unite": "hoplite",
        "batiments": ["ferme", "puits", "scierie", "murailles", "camp_militaire", "grenier",
                      "carriere", "port", "marche", "mine", "aqueduc", "forum", "agora"],
        "terrain_prefere": None, "allie": None, "rival": "francs",
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
    en_guerre = bool(_guerres_de(state, fid))
    if en_guerre:
        # En guerre, l'ARMÉE passe avant les chantiers, et l'on garde un trésor de
        # guerre : sinon l'IA dépensait tout en fermes et restait à une unité.
        _recruter(pays, fid, prio, actions, en_guerre=True)
        _construire(pays, actions, reserve_min=160)
    else:
        _construire(pays, actions)
        _recruter(pays, fid, prio, actions, en_guerre=False)
    if _chasser_hordes(state, fid, pays, prio, actions, evenements):
        pass  # la horde aux portes passe avant tout le reste
    elif not _mener_guerres(state, fid, pays, prio, actions, evenements):
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


def _construire(pays: dict, actions: list, reserve_min: int = 40) -> None:
    """Lance un chantier dans la première ville libre (ordre de priorité du dirigeant).
    Les CONQUÉRANTS gardent une grosse réserve d'or : ils épargnent pour annexer."""
    res = pays.get("ressources", {})
    p_ia = PRIORITES_IA.get(pays.get("id"), {})
    prio = p_ia.get("batiments", [])
    reserve = reserve_min
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


def _recruter(pays: dict, fid: str, prio: dict, actions: list,
              en_guerre: bool = False) -> None:
    res = pays.get("ressources", {})
    nb = sum(u.get("effectif", 1) for u in pays.get("unites", []))
    # L'ambition militaire se plie à la BASE ÉCONOMIQUE : on ne nourrit que ce que
    # les provinces peuvent porter, sinon la solde ruine le royaume et il se révolte.
    nb_terr = len(pays.get("territoires", []))
    cible = min(prio.get("armee_cible", 3), 2 + int(nb_terr * 1.5))
    # Les conquérants gardent en plus leur or pour annexer tant qu'ils sont petits.
    if prio.get("expansion", 0) >= 0.55 and nb_terr < 3:
        cible = min(cible, 3)
    # Trésor exsangue ou revenus négatifs : on cesse de recruter (en guerre, on
    # racle le fond du coffre : la levée coûte 10 or).
    if res.get("or", 0) < (40 if en_guerre else 120) or pays.get("production", {}).get("or", 0) < 0:
        return
    # TRÉSOR QUI DÉBORDE : même en paix, un royaume opulent solde des garnisons
    # (puits d'or crédible ; sinon l'IA thésaurise sans fin).
    if res.get("or", 0) > 2500 and nb < cible + 6:
        cout_m = ge._cout_inflation(pays, COUTS_UNITES.get("mercenaire", 160))
        if res["or"] > cout_m * 3:
            res["or"] = round(res["or"] - cout_m, 1)
            pays.setdefault("unites", []).append({
                "id": f"{fid}-mercenaire-{random.randint(1000, 999999)}",
                "type": "mercenaire", "territoire": pays["territoires"][0],
                "effectif": 1, "moral": 80, "a_bouge": False,
            })
            actions.append("solde une garnison de mercenaires")
            return

    if en_guerre:  # en GUERRE, on mobilise davantage (l'IA se bat pour de bon)
        cible += 3
        # Trésor de guerre : les riches soldent des MERCENAIRES (or pur, pas de pop).
        if res.get("or", 0) >= 700:
            cout_m = ge._cout_inflation(pays, COUTS_UNITES.get("mercenaire", 160))
            res["or"] = round(res["or"] - cout_m, 1)
            pays.setdefault("unites", []).append({
                "id": f"{fid}-mercenaire-{random.randint(1000, 999999)}",
                "type": "mercenaire", "territoire": pays["territoires"][0],
                "effectif": 1, "moral": 80, "a_bouge": False,
            })
            actions.append("solde des mercenaires")
    if nb >= cible or not pays.get("territoires"):
        return
    # Unité fétiche du dirigeant (phalange d'Alexandre, hoplites de Léonidas…) si le
    # fer le permet, sinon levée.
    from models.unit import TECH_REQUISE_UNITE
    prefere = prio.get("unite", "legionnaire")
    tech_req = TECH_REQUISE_UNITE.get(prefere)
    besoin_fer = COUT_RES_UNITES.get(prefere, {}).get("fer", 0)
    ok_tech = not tech_req or tech_req in pays.get("technologies", [])
    type_u = prefere if (ok_tech and res.get("fer", 0) >= besoin_fer) else "levee"
    cout = ge._cout_inflation(pays, COUTS_UNITES.get(type_u, 0))
    cout_pop = COUT_POP_UNITES.get(type_u, 1)
    cout_res = COUT_RES_UNITES.get(type_u, {})
    if res.get("or", 0) < cout + (10 if en_guerre else 60) or res.get("population", 0) < cout_pop + 8:
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


def _distance(a: str, b: str) -> float:
    ca, cb = _centre(a), _centre(b)
    return ((ca[0] - cb[0]) ** 2 + (ca[1] - cb[1]) ** 2) ** 0.5


# ---------------------------------------------------------------- marche des armées
def _a_navigation(pays: dict) -> bool:
    return "navigation_maritime" in pays.get("technologies", [])


def _voisins(tid: str, naval: bool) -> list[str]:
    v = list(ge._adjacents(tid))
    if naval:
        v += [m for m in ge._adjacents_mer(tid) if m not in v]
    return v


def _chemin_vers(state: dict, fid: str, depart: str, cibles: set[str], naval: bool,
                 limite: int = 14) -> list[str] | None:
    """Plus court chemin (en pas) de `depart` vers l'une des `cibles`, en ne traversant
    que des provinces NEUTRES ou à soi — la cible elle-même peut être ennemie (c'est
    la bataille). Retourne la liste des pas (sans le départ), ou None si hors d'atteinte.
    Remplace l'ancienne marche « à vol d'oiseau » qui s'échouait sur les côtes."""
    if depart in cibles:
        return []
    parents = {depart: None}
    file = [depart]
    for _ in range(limite):
        suivante = []
        for cur in file:
            for v in _voisins(cur, naval):
                if v in parents:
                    continue
                parents[v] = cur
                if v in cibles:
                    chemin = [v]
                    while parents[chemin[-1]] not in (None, depart):
                        chemin.append(parents[chemin[-1]])
                    return list(reversed(chemin))
                if ge._proprietaire(state, v) in (None, fid):
                    suivante.append(v)
        file = suivante
        if not file:
            break
    return None


def portee_guerre(state: dict, fid: str, cible: str, limite: int = 14) -> int | None:
    """Nombre de pas séparant les forces de `fid` des terres de `cible` (None = hors
    d'atteinte : pas de chemin terrestre, ni maritime sans navigation). Sert à ne
    déclarer que des guerres que l'on peut MENER, et à clore celles qu'on ne peut pas."""
    pays = state.get("pays", {}).get(fid, {})
    cp = state.get("pays", {}).get(cible, {})
    cibles = set(cp.get("territoires", []))
    if not cibles:
        return None
    naval = _a_navigation(pays)
    positions = set(pays.get("territoires", []))
    positions.update(u.get("territoire") for u in pays.get("unites", []))
    meilleur = None
    for pos in positions:
        ch = _chemin_vers(state, fid, pos, cibles, naval, limite)
        if ch is not None and (meilleur is None or len(ch) < meilleur):
            meilleur = len(ch)
    return meilleur


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
    # 2) Sinon, déplace une unité libre vers la meilleure cible neutre adjacente —
    # ou, si elle est ENFERMÉE dans l'empire, vers la frontière (province possédée
    # qui touche une neutre), pour ne jamais rester coincée.
    libre = next((u for u in pays.get("unites", []) if not u.get("a_bouge")), None)
    if not libre:
        return
    voisins = [t for t in ge._adjacents(libre.get("territoire", ""))
               if ge._proprietaire(state, t) is None]
    if voisins:
        cible = max(voisins, key=score)
        libre["territoire"] = cible
        libre["a_bouge"] = True
        return
    frontiere = [t for t in ge._adjacents(libre.get("territoire", ""))
                 if t in pays.get("territoires", [])
                 and any(ge._proprietaire(state, v) is None for v in ge._adjacents(t))]
    if frontiere:
        libre["territoire"] = random.choice(frontiere)
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


def _chasser_hordes(state: dict, fid: str, pays: dict, prio: dict,
                    actions: list, evenements: list) -> bool:
    """Une horde campée aux portes du royaume est une urgence : l'IA envoie ses
    troupes si elle se sent assez forte. True si elle a agi ce tour."""
    mes_terres = set(pays.get("territoires", []))
    if not mes_terres:
        return False
    menaces = [h for h in state.get("hordes", [])
               if h.get("territoire") in mes_terres
               or any(v in mes_terres for v in ge._adjacents(h.get("territoire", "")))]
    if not menaces:
        return False
    horde = max(menaces, key=lambda h: h.get("force", 0))
    ma_force = _force_totale(pays)
    if ma_force <= horde.get("force", 10) * 1.1:
        return False  # trop faible : on se terre derrière les murs
    if ge.combattre_horde(state, fid, horde, evenements):
        actions.append(f"écrase les {horde.get('nom', 'barbares')}")
        libre = next((u for u in pays.get("unites", []) if not u.get("a_bouge")), None)
        if libre:
            libre["territoire"] = horde.get("territoire", libre["territoire"])
            libre["a_bouge"] = True
    else:
        actions.append(f"affronte les {horde.get('nom', 'barbares')}")
    return True


def _mener_guerres(state: dict, fid: str, pays: dict, prio: dict,
                   actions: list, evenements: list) -> bool:
    """En guerre : attaque une province ennemie frontalière via le système de bataille
    commun. La CAPITALE est visée en dernier (elle se défend x2.5) : il faut un
    écrasant avantage — sa chute élimine le royaume."""
    guerres = _guerres_de(state, fid)
    if not guerres:
        return False
    for g in guerres:
        ennemi = g["a"] if g.get("b") == fid else g["b"]
        cible = state.get("pays", {}).get(ennemi)
        if not cible or cible.get("elimine"):
            continue
        cap_e = ge._capitale_faction(ennemi)
        # Le front = provinces ennemies adjacentes à MES territoires OU à MES armées
        # (une armée en marche peut donc porter la guerre chez l'ennemi).
        naval = _a_navigation(pays)
        positions = set(pays.get("territoires", []))
        positions.update(u.get("territoire") for u in pays.get("unites", []))
        frontieres = [t for t in cible.get("territoires", [])
                      if any(v in positions for v in _voisins(t, naval))]
        provinces = [t for t in frontieres if t != cap_e]
        ma_force, sa_force = _force_totale(pays), _force_totale(cible)
        if provinces:  # d'abord les provinces ordinaires
            if ma_force >= sa_force * 1.15 and random.random() < 0.6:
                prov = random.choice(provinces)
                if ge.resoudre_bataille(state, fid, ennemi, prov, evenements):
                    actions.append(f"prend {ge._nom_territoire(prov)}")
                return True
        elif cap_e in frontieres:  # il ne reste que la capitale : SIÈGE puis assaut final
            seuil = sa_force * (ge.BONUS_DEF_CAPITALE + 0.6) + 3
            if ma_force > seuil and random.random() < prio.get("agressivite", 0.3):
                if ge.resoudre_bataille(state, fid, ennemi, cap_e, evenements):
                    actions.append(f"renverse {ge.META_FACTIONS.get(ennemi, {}).get('nom', ennemi)}")
                return True
            # Attrition du siège : la garnison assiégée fond lentement (famine,
            # désertions) → les guerres de forteresse finissent par se dénouer.
            if ma_force > sa_force and random.random() < 0.30:
                ge._perdre_unite(cible)
                cible.setdefault("prov_stab", {})[cap_e] = max(
                    0.0, cible.get("prov_stab", {}).get(cap_e, 50) - 4)
                import guerre as gr
                gr.ajouter_score(state, fid, ennemi, gr.GAIN_SIEGE_CAPITALE)
                evenements.append({"type": "guerre", "faction": fid,
                                   "texte": f"⚔ {ge.META_FACTIONS.get(fid, {}).get('nom', fid)} assiège "
                                            f"{ge._nom_territoire(cap_e)} : la garnison s'épuise."})
                return True
        else:  # pas de front : les armées MARCHENT vers la province ennemie la plus proche
            cibles = set(cible.get("territoires", []))
            marche = 0
            for u in [x for x in pays.get("unites", []) if not x.get("a_bouge")]:
                ch = _chemin_vers(state, fid, u.get("territoire", ""), cibles, naval)
                if not ch:
                    continue
                pas = ch[0]
                if pas in cibles:  # l'ennemi est à portée : on s'arrête au contact,
                    continue        # la bataille se joue au prochain tour (front établi)
                u["territoire"] = pas
                u["a_bouge"] = True
                marche += 1
            if marche:
                actions.append(f"fait marcher {marche} unité(s) vers {ge.META_FACTIONS.get(ennemi, {}).get('nom', ennemi)}")
    return True  # en guerre : on ne s'étend pas en parallèle


def _declarer_guerre(state: dict, fid: str, pays: dict, prio: dict, evenements: list) -> None:
    """Un dirigeant agressif déclare la guerre à une proie IA : son RIVAL de cœur en
    priorité, sinon la faction la plus FAIBLE qu'il domine nettement. (Les guerres
    contre le joueur passent par les messages spontanés + escalade des silences.)"""
    if _guerres_de(state, fid):
        return
    joueur = state.get("meta", {}).get("joueur_pays")
    ma_force = _force_totale(pays)
    candidats = []
    rival = prio.get("rival")
    for cid, cp in state.get("pays", {}).items():
        if cid in (fid, joueur) or cp.get("elimine") or _allies_entre(state, fid, cid):
            continue
        # Pas de guerre sans FRONT : il faut une frontière commune (ou presque).
        proche = any(v in pays.get("territoires", [])
                     for t in cp.get("territoires", []) for v in ge._adjacents(t))
        if not proche:
            continue
        seuil = 1.15 if cid == rival else 1.35  # on ose plus facilement contre le rival
        if ma_force >= _force_totale(cp) * seuil:
            candidats.append((0 if cid == rival else 1, _force_totale(cp), cid))
    if not candidats:
        return
    if random.random() > prio.get("agressivite", 0.3) * 0.12:
        return
    candidats.sort()
    proie = candidats[0][2]
    state.setdefault("diplomatie", {}).setdefault("guerres_actives", []).append(
        {"a": fid, "b": proie, "depuis": state.get("meta", {}).get("tour", 1), "score": 0.0})
    evenements.append({"type": "guerre", "faction": fid,
                       "texte": f"⚔ {ge.META_FACTIONS.get(fid, {}).get('nom', fid)} déclare la GUERRE "
                                f"à {ge.META_FACTIONS.get(proie, {}).get('nom', proie)} !"})


def _faire_la_paix(state: dict, fid: str, pays: dict, evenements: list) -> None:
    """Les guerres qui s'enlisent finissent par une paix blanche — mais SEULEMENT en
    cas de vraie impasse : un belligérant qui domine nettement continue la guerre."""
    tour = state.get("meta", {}).get("tour", 1)
    diplo = state.get("diplomatie", {})
    for g in list(_guerres_de(state, fid)):
        autre_id = g["a"] if g.get("b") == fid else g["b"]
        autre = state.get("pays", {}).get(autre_id, {})
        # Guerre HORS D'ATTEINTE (pas de chemin, ni terrestre ni maritime) : au bout de
        # six mois sans pouvoir porter le fer, on y renonce — plus de guerres nominales
        # qui traînent trente tours sans un seul combat.
        if tour - g.get("depuis", tour) >= 6 and portee_guerre(state, fid, autre_id) is None \
                and abs(g.get("score", 0.0)) < 5 and random.random() < 0.5:
            diplo["guerres_actives"].remove(g)
            for x, y in ((fid, autre_id), (autre_id, fid)):
                rep = state["pays"].get(x, {}).setdefault("reputation", {})
                rep[y] = min(100, rep.get(y, 0) + 5)
            evenements.append({"type": "paix", "faction": fid,
                               "texte": f"🕊 {ge.META_FACTIONS.get(fid, {}).get('nom', fid)}, ne pouvant porter le fer "
                                        f"jusqu'à {ge.META_FACTIONS.get(autre_id, {}).get('nom', autre_id)}, renonce à la guerre."})
            continue
        f1, f2 = _force_totale(pays), _force_totale(autre)
        if max(f1, f2) > min(f1, f2) * 1.5 + 2:
            continue  # quelqu'un domine : pas de paix, la guerre se poursuit
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
         "depuis": state.get("meta", {}).get("tour", 1), "score": 0.0})
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
