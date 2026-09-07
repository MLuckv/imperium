"""Guerres façon Age of History 2 : score de guerre, provinces étoilées, traité de paix.

Principe : chaque guerre a un SCORE (−100 à +100) vu du camp `a`. On le gagne en
remportant des batailles, en occupant des provinces, en assiégeant une capitale ; on
le perd symétriquement. Au moment de faire la paix, le vainqueur DÉPENSE son score
pour réclamer des provinces (chacune coûte selon ses ÉTOILES : population, bâtiments,
capitale) ou de l'or. Ce qu'on ne peut pas payer, on ne peut pas l'exiger.

Aucune dépendance à game_engine au chargement (import paresseux) : évite les cycles.
"""
from __future__ import annotations

# Score gagné par fait d'armes (vu du camp qui réussit).
GAIN_BATAILLE_GAGNEE = 8.0     # bataille rangée remportée
GAIN_PROVINCE_PRISE = 14.0     # province ennemie occupée
GAIN_ASSAUT_REPOUSSE = 5.0     # on a brisé un assaut chez soi
GAIN_SIEGE_CAPITALE = 3.0      # attrition devant la capitale ennemie
DERIVE_PAR_TOUR = 0.4          # une guerre qui traîne s'essouffle (retour vers 0)

# Coût, en points de score, pour réclamer une province selon ses étoiles.
COUT_PAR_ETOILE = 14.0
COUT_CAPITALE_SUPP = 25.0      # surcoût : arracher une capitale est une humiliation
OR_PAR_POINT = 12.0            # or exigible par point de score dépensé


def etoiles_province(state: dict, tid: str, proprio: str | None = None) -> int:
    """Valeur d'une province, de 1 à 5 étoiles (population, cité, bâtiments, capitale)."""
    import game_engine as ge
    val = 1.0
    pays = state.get("pays", {}).get(proprio or ge._proprietaire(state, tid) or "", {})
    ville = next((v for v in pays.get("villes", []) if v.get("territoire") == tid), None)
    if ville:
        val += 1.0
        val += min(2.0, len(ville.get("batiments", [])) * 0.25)
        val += min(1.0, ville.get("population", 0) / 20.0)
    else:
        val += min(1.0, ge._population_territoire(tid) / 25.0)
    if tid == ge._capitale_faction(proprio or ""):
        val += 2.0
    if ge._terrain_territoire(tid) == "fertile":
        val += 0.5
    return max(1, min(5, int(round(val))))


def trouver(state: dict, a: str, b: str) -> dict | None:
    """La guerre en cours entre ces deux camps, s'il y en a une."""
    for g in state.get("diplomatie", {}).get("guerres_actives", []):
        if {g.get("a"), g.get("b")} == {a, b}:
            return g
    return None


def ajouter_score(state: dict, gagnant: str, perdant: str, points: float) -> None:
    """Crédite `points` au camp `gagnant` dans sa guerre contre `perdant`."""
    g = trouver(state, gagnant, perdant)
    if not g:
        return
    signe = 1.0 if g.get("a") == gagnant else -1.0
    g["score"] = max(-100.0, min(100.0, round(g.get("score", 0.0) + signe * points, 1)))


def score_de(guerre: dict, faction: str) -> float:
    """Score de guerre vu par `faction` (positif = elle domine)."""
    s = guerre.get("score", 0.0)
    return s if guerre.get("a") == faction else -s


def eroder(state: dict) -> None:
    """Chaque tour, les scores refluent vers 0 : une guerre qui s'enlise n'apporte rien."""
    for g in state.get("diplomatie", {}).get("guerres_actives", []):
        s = g.get("score", 0.0)
        if s > 0:
            g["score"] = round(max(0.0, s - DERIVE_PAR_TOUR), 1)
        elif s < 0:
            g["score"] = round(min(0.0, s + DERIVE_PAR_TOUR), 1)


def offres_possibles(state: dict, demandeur: str, cible: str) -> dict:
    """Ce que `demandeur` peut EXIGER de `cible` avec son score actuel.
    Retourne {score, provinces:[{id,nom,etoiles,cout,capitale}], or_max}."""
    import game_engine as ge
    g = trouver(state, demandeur, cible)
    if not g:
        return {"score": 0.0, "provinces": [], "or_max": 0}
    score = max(0.0, score_de(g, demandeur))
    cp = state.get("pays", {}).get(cible, {})
    cap = ge._capitale_faction(cible)
    provinces = []
    for tid in cp.get("territoires", []):
        et = etoiles_province(state, tid, cible)
        cout = et * COUT_PAR_ETOILE + (COUT_CAPITALE_SUPP if tid == cap else 0.0)
        provinces.append({
            "id": tid, "nom": ge._nom_territoire(tid), "etoiles": et,
            "cout": round(cout, 1), "capitale": tid == cap,
            "abordable": cout <= score,
        })
    provinces.sort(key=lambda p: (p["capitale"], -p["etoiles"]))
    return {
        "score": round(score, 1),
        "provinces": provinces,
        "or_max": int(min(score * OR_PAR_POINT, cp.get("ressources", {}).get("or", 0))),
    }


def conclure_paix(state: dict, demandeur: str, cible: str,
                  provinces: list[str], or_exige: int, evenements: list) -> dict:
    """Applique un traité de paix : transfert des provinces réclamées et de l'or, puis
    fin de la guerre. Refuse ce que le score ne permet pas de payer."""
    import game_engine as ge
    g = trouver(state, demandeur, cible)
    if not g:
        return {"ok": False, "raison": "Aucune guerre en cours avec cette puissance."}
    score = max(0.0, score_de(g, demandeur))
    cp = state.get("pays", {}).get(cible, {})
    dp = state.get("pays", {}).get(demandeur, {})
    cap = ge._capitale_faction(cible)

    # Vérifie le coût total.
    cout = 0.0
    for tid in provinces:
        if tid not in cp.get("territoires", []):
            return {"ok": False, "raison": f"{ge._nom_territoire(tid)} ne lui appartient pas."}
        cout += etoiles_province(state, tid, cible) * COUT_PAR_ETOILE
        if tid == cap:
            cout += COUT_CAPITALE_SUPP
    cout += (or_exige or 0) / OR_PAR_POINT
    if cout > score + 0.01:
        return {"ok": False,
                "raison": f"Vos exigences valent {cout:.0f} points ; vous n'en avez que {score:.0f}."}

    # Transfert des provinces.
    noms = []
    for tid in provinces:
        cp["territoires"] = [t for t in cp.get("territoires", []) if t != tid]
        cp.get("prov_stab", {}).pop(tid, None)
        for v in [v for v in cp.get("villes", []) if v.get("territoire") == tid]:
            cp["villes"].remove(v)
            v["gouverneur"] = False
            v["pacification"] = 10        # une cité cédée par traité reste rétive
            dp.setdefault("villes", []).append(v)
        for u in cp.get("unites", []):     # la garnison se replie
            if u.get("territoire") == tid and cap:
                u["territoire"] = cap
        pop = ge._population_territoire(tid)
        dp.setdefault("territoires", []).append(tid)
        dp.setdefault("prov_stab", {})[tid] = 30.0
        dp["ressources"]["population"] = round(dp["ressources"].get("population", 0) + pop, 1)
        cp["ressources"]["population"] = max(1.0, round(cp["ressources"].get("population", 0) - pop, 1))
        noms.append(ge._nom_territoire(tid))

    # Transfert de l'or.
    if or_exige:
        reel = min(or_exige, cp.get("ressources", {}).get("or", 0))
        cp["ressources"]["or"] = round(cp["ressources"].get("or", 0) - reel, 1)
        dp["ressources"]["or"] = round(dp["ressources"].get("or", 0) + reel, 1)
    else:
        reel = 0

    # Fin de la guerre + apaisement partiel.
    diplo = state.setdefault("diplomatie", {})
    diplo["guerres_actives"] = [x for x in diplo.get("guerres_actives", []) if x is not g]
    for x, y in ((demandeur, cible), (cible, demandeur)):
        rep = state["pays"].get(x, {}).setdefault("reputation", {})
        rep[y] = min(100, rep.get(y, 0) + 15)

    nd, nc = ge._nom_pays(demandeur), ge._nom_pays(cible)
    detail = []
    if noms:
        detail.append("cède " + ", ".join(noms))
    if reel:
        detail.append(f"verse {reel} or")
    texte = (f"🕊 PAIX entre {nd} et {nc}"
             + (f" : {nc} " + " et ".join(detail) + "." if detail else " : paix blanche."))
    evenements.append({"type": "paix", "faction": demandeur, "texte": texte})
    return {"ok": True, "raison": texte, "provinces": noms, "or": reel}
