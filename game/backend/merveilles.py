"""Merveilles du monde.

Cinq façons de les obtenir :
- antique     : monument déjà debout → bonus passif si tu CONTRÔLES la province.
- naturelle   : site naturel (volcan, forêt, dune…) → bonus passif si tu contrôles
                la province. Ne se bâtit ni ne se détruit.
- ruine       : à RESTAURER (or + ressources + tours) si tu contrôles la province.
- fouille     : site archéologique → FOUILLER (or + tours) → relique aléatoire.
- construction: grand CHANTIER, unique au monde, bâti dans une de tes villes.

L'état vivant (qui possède quoi, chantiers en cours) est stocké dans
state["merveilles"]. Le registre ci-dessous est, lui, statique.

Clés de bonus comprises par le moteur :
  or / nourriture / eau  (production plate par tour)   recherche_pct   stabilite
  attaque_pct / defense_pct (force en bataille, propriétaire attaquant / défenseur)
"""
from __future__ import annotations
import random

# Registre statique des merveilles. Les capitales de départ n'en abritent aucune :
# une merveille se gagne (province voisine, chantier), elle n'est pas offerte.
MERVEILLES: dict[str, dict] = {
    # ------------------------------------------------------------ ANTIQUES
    "parthenon": {
        "nom": "Parthénon", "type": "antique", "province": "sterea_ellada",
        "desc": "Le temple d'Athéna domine Athènes. Le contrôler éclaire la civilisation.",
        "bonus": {"recherche_pct": 0.15, "stabilite": 6}, "prestige": 3,
    },
    "stonehenge": {
        "nom": "Stonehenge", "type": "antique", "province": "devon",
        "desc": "Le cercle de pierres levées observe le ciel depuis l'aube des temps. "
                "Les druides y lisent les saisons et les présages.",
        "bonus": {"recherche_pct": 0.10, "stabilite": 5}, "prestige": 3,
    },
    "pyramides": {
        "nom": "Pyramides de Gizeh", "type": "antique", "province": "al_jizah",
        "desc": "Trois montagnes de pierre bâties par les dieux-rois. Le monde entier "
                "vient s'incliner devant elles — et paie le passage.",
        "bonus": {"stabilite": 5, "or": 4}, "prestige": 5,
    },
    # ---------------------------------------------------------- NATURELLES
    "chaine_des_puys": {
        "nom": "Chaîne des Puys", "type": "naturelle", "province": "puy_de_dome",
        "desc": "Les volcans endormis d'Auvergne : leurs cendres font la terre la plus "
                "grasse du royaume, et leurs sommets sont sacrés.",
        "bonus": {"nourriture": 6, "stabilite": 2}, "prestige": 2,
    },
    "broceliande": {
        "nom": "Forêt de Brocéliande", "type": "naturelle", "province": "maine_et_loire",
        "desc": "Brume, sources et chênes millénaires : la forêt de Merlin. Ceux qui "
                "savent l'écouter en reviennent plus sages.",
        "bonus": {"recherche_pct": 0.10, "stabilite": 3}, "prestige": 2,
    },
    "dune_du_pilat": {
        "nom": "Dune du Pilat", "type": "naturelle", "province": "gironde",
        "desc": "La plus haute dune du monde connu, entre l'océan et la forêt des Landes. "
                "Marchands et pèlerins y font halte.",
        "bonus": {"or": 6}, "prestige": 2,
    },
    "cote_d_opale": {
        "nom": "Falaises de la Côte d'Opale", "type": "naturelle", "province": "pas_de_calais",
        "desc": "Les falaises blanches face à l'île des Bretons. Qui tient ce rivage "
                "tient le détroit et son commerce.",
        "bonus": {"or": 5}, "prestige": 1,
    },
    "loch_ness": {
        "nom": "Loch Ness", "type": "naturelle", "province": "highland",
        "desc": "Un lac noir et sans fond, où l'on dit qu'une bête veille. La crainte "
                "qu'il inspire tient les clans tranquilles.",
        "bonus": {"stabilite": 4}, "prestige": 2,
    },
    "etna": {
        "nom": "Etna", "type": "naturelle", "province": "palermo",
        "desc": "Le volcan vivant de Sicile : ses cendres nourrissent des vergers sans "
                "pareils, mais sa colère fait trembler les villes.",
        "bonus": {"nourriture": 8, "stabilite": -2}, "prestige": 3,
    },
    "vesuve": {
        "nom": "Vésuve", "type": "naturelle", "province": "foggia",
        "desc": "La montagne qui fume au-dessus de la baie. Vignes et oliviers "
                "prospèrent sur ses pentes — tant qu'elle dort.",
        "bonus": {"nourriture": 5, "or": 3}, "prestige": 2,
    },
    "cataractes_du_nil": {
        "nom": "Cataractes du Nil", "type": "naturelle", "province": "al_minya",
        "desc": "Là où le fleuve gronde entre les rochers. Chaque crue dépose le limon "
                "qui nourrit un peuple entier.",
        "bonus": {"nourriture": 8, "eau": 4}, "prestige": 2,
    },
    # -------------------------------------------------------------- RUINES
    "colosse_rhodes": {
        "nom": "Colosse de Rhodes", "type": "ruine", "province": "notio_aigaio",
        "desc": "Le géant de bronze, abattu par un séisme, gît dans le port de Rhodes.",
        "cout_or": 300, "cout_res": {"marbre": 30, "pierre": 40}, "duree": 30,
        "bonus": {"or": 8, "stabilite": 3}, "prestige": 4,
    },
    "mur_d_hadrien": {
        "nom": "Mur du Nord", "type": "ruine", "province": "north_yorkshire",
        "desc": "Un rempart éboulé court d'une mer à l'autre. Relevé, il ferme l'île "
                "aux envahisseurs.",
        "cout_or": 260, "cout_res": {"pierre": 80}, "duree": 28,
        "bonus": {"defense_pct": 0.25, "stabilite": 3}, "prestige": 3,
    },
    "pont_du_gard": {
        "nom": "Pont du Gard", "type": "ruine", "province": "aveyron",
        "desc": "Trois étages d'arches abandonnés au-dessus du fleuve. Restauré, "
                "l'aqueduc abreuve tout le pays.",
        "cout_or": 240, "cout_res": {"pierre": 60}, "duree": 24,
        "bonus": {"eau": 8, "stabilite": 2}, "prestige": 3,
    },
    # ------------------------------------------------------------ FOUILLES
    "knossos": {
        "nom": "Palais de Cnossos", "type": "fouille", "province": "kriti",
        "desc": "Le labyrinthe minoen dort sous la terre de Crète. Les fouilles peuvent livrer des trésors.",
        "cout_or": 120, "duree": 18, "prestige": 2,
        "reliques": [
            {"texte": "un trésor d'or minoen", "ressource": "or", "valeur": 250},
            {"texte": "des tablettes savantes (Linéaire B)", "ressource": "recherche", "valeur": 1},
            {"texte": "un filon de marbre antique", "ressource": "marbre", "valeur": 40},
            {"texte": "des reliques sacrées (ferveur populaire)", "ressource": "stabilite", "valeur": 12},
        ],
    },
    "tombe_de_vix": {
        "nom": "Tombe de Vix", "type": "fouille", "province": "cote_d_or",
        "desc": "Sous un tumulus de Bourgogne repose une princesse celte, et l'on parle "
                "d'un cratère de bronze grand comme un homme.",
        "cout_or": 110, "duree": 16, "prestige": 2,
        "reliques": [
            {"texte": "le cratère de bronze de la princesse", "ressource": "or", "valeur": 220},
            {"texte": "un torque d'or pur", "ressource": "or", "valeur": 160},
            {"texte": "des amphores grecques (savoir des marchands)", "ressource": "recherche", "valeur": 1},
            {"texte": "la dépouille d'une reine (ferveur populaire)", "ressource": "stabilite", "valeur": 10},
        ],
    },
    "troie": {
        "nom": "Troie", "type": "fouille", "province": "balikesir_2",
        "desc": "Sous la colline d'Hisarlık dorment neuf cités superposées. Le trésor "
                "de Priam attend son Schliemann.",
        "cout_or": 140, "duree": 20, "prestige": 3,
        "reliques": [
            {"texte": "le trésor de Priam", "ressource": "or", "valeur": 300},
            {"texte": "des armes de bronze (art de la guerre)", "ressource": "recherche", "valeur": 1},
            {"texte": "un filon de marbre antique", "ressource": "marbre", "valeur": 40},
            {"texte": "le masque d'un roi (ferveur populaire)", "ressource": "stabilite", "valeur": 12},
        ],
    },
    # ------------------------------------------------------- CONSTRUCTIONS
    "colisee": {
        "nom": "Colisée", "type": "construction", "ville": True,
        "desc": "Amphithéâtre colossal : du pain et des jeux pour tout l'empire.",
        "tech_requise": None, "cout_or": 400, "cout_res": {"marbre": 50, "pierre": 60},
        "duree": 48, "bonus": {"stabilite": 12}, "prestige": 5,
    },
    "grande_bibliotheque": {
        "nom": "Grande Bibliothèque", "type": "construction", "ville": True,
        "desc": "Tous les rouleaux du monde sous un même toit. Les savants du royaume "
                "s'y pressent.",
        "tech_requise": "philosophie_grecque", "cout_or": 350, "cout_res": {"marbre": 30, "pierre": 40},
        "duree": 36, "bonus": {"recherche_pct": 0.25}, "prestige": 4,
    },
    "grand_phare": {
        "nom": "Grand Phare", "type": "construction", "ville": True,
        "desc": "Une tour de feu visible à trente lieues en mer. Les navires marchands "
                "affluent, et les pêcheurs rentrent au port.",
        "tech_requise": "navigation_maritime", "cout_or": 300, "cout_res": {"pierre": 60, "bois": 30},
        "duree": 30, "bonus": {"or": 10, "nourriture": 3}, "prestige": 4,
    },
    "jardins_suspendus": {
        "nom": "Jardins suspendus", "type": "construction", "ville": True,
        "desc": "Des terrasses de verdure irriguées jusqu'au ciel, au cœur de la cité.",
        "tech_requise": "ingenierie_hydraulique", "cout_or": 350, "cout_res": {"pierre": 40, "bois": 40},
        "duree": 36, "bonus": {"nourriture": 8, "eau": 5, "stabilite": 3}, "prestige": 4,
    },
    "pantheon": {
        "nom": "Panthéon", "type": "construction", "ville": True,
        "desc": "Un temple à tous les dieux sous la plus vaste coupole jamais coulée.",
        "tech_requise": "architecture_pierre", "cout_or": 400, "cout_res": {"marbre": 50, "pierre": 50},
        "duree": 42, "bonus": {"stabilite": 8}, "prestige": 5,
    },
    "grande_muraille": {
        "nom": "Grande Muraille", "type": "construction", "ville": True,
        "desc": "Un rempart continu qui court sur les crêtes. Nul envahisseur ne "
                "surprend plus le royaume.",
        "tech_requise": "genie_militaire", "cout_or": 450, "cout_res": {"pierre": 120},
        "duree": 48, "bonus": {"defense_pct": 0.30, "stabilite": 2}, "prestige": 4,
    },
    "cathedrale": {
        "nom": "Grande Cathédrale", "type": "construction", "ville": True,
        "desc": "Des voûtes de pierre qui montent vers la lumière. Le peuple entier "
                "s'y rassemble et s'y apaise.",
        "tech_requise": "architecture_pierre", "cout_or": 420, "cout_res": {"marbre": 40, "pierre": 70},
        "duree": 48, "bonus": {"stabilite": 10}, "prestige": 5,
    },
    "table_ronde": {
        "nom": "Salle de la Table Ronde", "type": "construction", "ville": True,
        "desc": "Une table sans tête ni bout : les chevaliers y jurent fidélité et "
                "marchent au combat d'un seul cœur.",
        "tech_requise": None, "cout_or": 260, "cout_res": {"bois": 60, "pierre": 30},
        "duree": 24, "bonus": {"attaque_pct": 0.15, "stabilite": 4}, "prestige": 3,
    },
    "mausolee": {
        "nom": "Mausolée", "type": "construction", "ville": True,
        "desc": "Le tombeau d'un souverain, si somptueux qu'il donne son nom à tous "
                "les autres. On vient de loin pour le voir.",
        "tech_requise": "architecture_pierre", "cout_or": 380, "cout_res": {"marbre": 60},
        "duree": 40, "bonus": {"stabilite": 3}, "prestige": 6,
    },
}

# Récompenses génériques d'une campagne de fouille (si la merveille n'en définit pas).
RELIQUES = [
    {"texte": "un trésor d'or enfoui", "ressource": "or", "valeur": 250},
    {"texte": "des tablettes savantes", "ressource": "recherche", "valeur": 1},
    {"texte": "un filon de marbre antique", "ressource": "marbre", "valeur": 40},
    {"texte": "des reliques sacrées (ferveur populaire)", "ressource": "stabilite", "valeur": 12},
]

ETAT_INITIAL = {"antique": "intacte", "naturelle": "intacte", "ruine": "ruine",
                "fouille": "site", "construction": "non_construite"}


def etat_initial() -> dict:
    """État de départ des merveilles pour une nouvelle partie."""
    return {wid: {"etat": ETAT_INITIAL[w["type"]], "proprietaire": None,
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
    if w["type"] in ("antique", "naturelle"):
        return _controle(w["province"], state)
    if w["type"] == "ruine":
        return _controle(w["province"], state) if st.get("etat") == "restauree" else None
    if w["type"] == "construction":
        return st.get("proprietaire") if st.get("etat") == "construite" else None
    return None  # fouille : pas de bonus passif (relique ponctuelle)


def bonus_actif(pays: dict, state: dict) -> dict:
    """Somme des bonus des merveilles actives pour cette faction."""
    agg = {"or": 0.0, "nourriture": 0.0, "eau": 0.0, "recherche_pct": 0.0,
           "stabilite": 0, "attaque_pct": 0.0, "defense_pct": 0.0,
           "prestige": 0, "nb": 0, "tourisme": 0, "liste": []}
    for wid, w in MERVEILLES.items():
        if proprietaire(wid, state) == pays.get("id"):
            for k, v in w.get("bonus", {}).items():
                agg[k] = agg.get(k, 0) + v
            agg["prestige"] += w.get("prestige", 0)
            agg["nb"] += 1
            # Un site naturel ne coûte rien à entretenir ; un monument, si.
            if w["type"] != "naturelle":
                agg["nb_entretien"] = agg.get("nb_entretien", 0) + 1
            agg["liste"].append(w["nom"])
            # Tourisme : un site HÉRITÉ (antique) attire peu (1 pt/mois), un site
            # naturel un peu plus (2) ; une merveille BÂTIE ou RESTAURÉE par tes
            # soins attire son plein prestige.
            agg["tourisme"] += {"antique": 1, "naturelle": 2}.get(w["type"], w.get("prestige", 0))
    return agg


def completer_etat(state: dict) -> dict:
    """Parties sauvegardées avant l'ajout de nouvelles merveilles : on complète
    l'état vivant avec les entrées manquantes (idempotent)."""
    merv = state.setdefault("merveilles", {})
    for wid, w in MERVEILLES.items():
        merv.setdefault(wid, {"etat": ETAT_INITIAL[w["type"]], "proprietaire": None,
                              "ville": None, "chantier": None})
    return state


def avancer_chantiers(state: dict, evenements: list) -> None:
    """Décrémente les chantiers de merveilles et applique les achèvements."""
    merv = completer_etat(state)["merveilles"]
    for wid, st in merv.items():
        ch = st.get("chantier")
        if not ch:
            continue
        ch["tours_restants"] -= 1
        if ch["tours_restants"] > 0:
            continue
        w = MERVEILLES.get(wid)
        if not w:
            continue
        fid = st.get("proprietaire")
        st["chantier"] = None
        if w["type"] == "ruine":
            st["etat"] = "restauree"
            evenements.append({"type": "merveille", "faction": fid, "territoire": w.get("province"), "icone": "✦",
                               "texte": f"Merveille restaurée : {w['nom']} renaît de ses ruines !"})
        elif w["type"] == "construction":
            st["etat"] = "construite"
            evenements.append({"type": "merveille", "faction": fid, "icone": "✦",
                               "texte": f"Merveille achevée : {w['nom']} s'élève, à la gloire de l'empire !"})
        elif w["type"] == "fouille":
            st["etat"] = "fouillee"
            rel = random.choice(w.get("reliques") or RELIQUES)
            pays = state.get("pays", {}).get(fid)
            if pays is not None:
                _appliquer_relique(pays, rel)
            evenements.append({"type": "merveille", "faction": fid, "territoire": w.get("province"), "icone": "✦",
                               "texte": f"Fouilles de {w['nom']} : on exhume {rel['texte']} !"})


def _appliquer_relique(pays: dict, rel: dict) -> None:
    res = pays.setdefault("ressources", {})
    r, v = rel["ressource"], rel["valeur"]
    if r == "stabilite":
        pays["stabilite"] = min(100, pays.get("stabilite", 60) + v)
    elif r == "recherche":
        # Achève d'un coup la recherche en cours (le moteur la validera au tour suivant).
        rec = pays.get("recherche_en_cours")
        if rec:
            rec["progres"] = rec.get("cout", 9999)
    else:
        pays.setdefault("ressources_luxe", {})
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
