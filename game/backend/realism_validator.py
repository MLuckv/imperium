"""Validateur de réalisme des actions joueur (cahier §11.2, §14.2).

Stratégie en deux temps :
  1. Vérifications DÉTERMINISTES (toujours exécutées, jamais bloquantes pour le
     jeu) : ressources suffisantes, technologie requise, cohérence de base.
  2. Pour le texte libre : appel optionnel à Ollama qui renvoie le JSON
     {valide, raison, suggestion}. Si Ollama est absent/timeout/erreur, repli
     déterministe PERMISSIF (on laisse passer avec une raison neutre).

Le validateur NE bloque JAMAIS le jeu par une exception : toute erreur interne
se traduit par un verdict permissif.
"""

from __future__ import annotations

import json
import re

import httpx

import ai_director
import tech_tree
from models.unit import COUTS_UNITES, TECH_REQUISE_UNITE
from models.city import COUT_BATIMENTS

# Coût de référence pour fonder une ville — DOIT rester cohérent avec
# game_engine.COUT_FONDER_VILLE_OR (sinon l'UI propose l'action mais le validateur
# la refuse). Volontairement permissif (la déduction réelle se fait dans le moteur).
COUT_FONDATION_VILLE = {"or": 200}


def _verdict(valide: bool, raison: str = "", suggestion: str = "") -> dict:
    return {"valide": bool(valide), "raison": raison, "suggestion": suggestion}


def valider_action(action: dict, pays: dict, state: dict) -> dict:
    """Valide une action structurée.

    `action` : {type, cible, texte, params}
    `pays`   : dict du pays joueur (ressources, technologies, ...)
    `state`  : GameState complet (pour cohérence cible/diplomatie).
    Retourne {valide, raison, suggestion}.
    """
    try:
        return _valider_action_interne(action, pays, state)
    except Exception as e:  # filet de sécurité : jamais bloquant
        return _verdict(True, f"Validation tolérante (erreur interne ignorée : {e}).")


def _valider_action_interne(action: dict, pays: dict, state: dict) -> dict:
    type_action = (action or {}).get("type", "texte_libre")
    params = (action or {}).get("params") or {}
    cible = (action or {}).get("cible")
    ressources = pays.get("ressources", {})
    technologies = pays.get("technologies", [])

    # --- Recrutement ---
    if type_action == "recruter":
        type_unite = params.get("type")
        quantite = int(params.get("quantite", 1) or 1)
        if type_unite not in COUTS_UNITES:
            return _verdict(False, f"Type d'unité inconnu : {type_unite}.",
                            f"Unités possibles : {', '.join(sorted(COUTS_UNITES))}.")
        tech_requise = TECH_REQUISE_UNITE.get(type_unite)
        if tech_requise and tech_requise not in technologies:
            t = tech_tree.tech_par_id(tech_requise)
            nom = t["nom"] if t else tech_requise
            return _verdict(False,
                            f"L'unité « {type_unite} » nécessite la technologie « {nom} ».",
                            f"Recherche d'abord {nom}.")
        cout = COUTS_UNITES[type_unite] * quantite
        if ressources.get("or", 0) < cout:
            return _verdict(False,
                            f"Or insuffisant : {cout} requis, {int(ressources.get('or', 0))} disponible.",
                            "Recrute moins d'unités ou attends d'avoir plus d'or.")
        return _verdict(True, f"Recrutement de {quantite} × {type_unite} pour {cout} or.")

    # --- Construction de bâtiment ---
    if type_action == "construire":
        batiment = params.get("batiment")
        ville_id = params.get("ville")
        if batiment not in COUT_BATIMENTS:
            return _verdict(False, f"Bâtiment inconnu : {batiment}.",
                            f"Bâtiments possibles : {', '.join(sorted(set(COUT_BATIMENTS)))}.")
        villes = pays.get("villes", [])
        if ville_id and not any(v.get("id") == ville_id for v in villes):
            return _verdict(False, f"Ville inconnue : {ville_id}.",
                            "Choisis une de tes villes existantes.")
        cout = COUT_BATIMENTS[batiment]
        # Réductions liées aux technologies (murailles / aqueduc).
        eff = tech_tree.effets_technologies(technologies)
        if batiment == "murailles":
            cout = int(cout * (1 - eff.get("cout_muraille_pct", 0)))
        if batiment == "aqueduc":
            cout = int(cout * (1 - eff.get("cout_aqueduc_pct", 0)))
        if ressources.get("or", 0) < cout:
            return _verdict(False,
                            f"Or insuffisant : {cout} requis, {int(ressources.get('or', 0))} disponible.",
                            "Attends d'accumuler plus d'or.")
        return _verdict(True, f"Construction de « {batiment} » pour {cout} or.")

    # --- Recherche technologique ---
    if type_action == "rechercher":
        tech_id = params.get("tech")
        ok, raison = tech_tree.peut_rechercher(tech_id, technologies)
        if not ok:
            dispo = tech_tree.technologies_disponibles(technologies)
            sugg = ""
            if dispo:
                sugg = "Disponibles : " + ", ".join(t["id"] for t in dispo[:5]) + "."
            return _verdict(False, raison, sugg)
        return _verdict(True, f"Recherche de « {tech_id} » lancée.")

    # --- Envoi de ressources (aide) ---
    if type_action == "envoyer_ressources":
        montant = params.get("ressources") or {}
        for res, val in montant.items():
            if ressources.get(res, 0) < val:
                return _verdict(False,
                                f"Ressource « {res} » insuffisante pour l'envoi.",
                                "Réduis le montant envoyé.")
        return _verdict(True, "Aide envoyée.")

    # --- Fondation de ville (texte ou action) ---
    if type_action in ("fonder_ville",):
        for res, val in COUT_FONDATION_VILLE.items():
            if ressources.get(res, 0) < val:
                return _verdict(False,
                                f"Or insuffisant pour fonder une ville ({val} requis).",
                                "Accumule davantage d'or, puis fonde depuis une ville assez peuplée.")
        return _verdict(True, "Conditions de fondation réunies.")

    # --- Actions diplomatiques structurées (validité de la cible) ---
    if type_action in ("envoyer_ambassadeur", "traite_commercial", "declarer_guerre",
                       "demander_paix", "organiser_jeux"):
        if type_action != "organiser_jeux":
            if cible and cible not in state.get("pays", {}):
                return _verdict(False, f"Cible diplomatique inconnue : {cible}.",
                                "Choisis carthage ou macedoine.")
        if type_action == "organiser_jeux":
            cout_jeux = 150
            if ressources.get("or", 0) < cout_jeux:
                return _verdict(False,
                                f"Or insuffisant pour organiser des Jeux ({cout_jeux} requis).",
                                "Attends d'avoir plus d'or.")
        return _verdict(True, "Action diplomatique recevable.")

    # --- Texte libre : validation par Ollama avec repli permissif ---
    if type_action == "texte_libre":
        texte = (action or {}).get("texte", "") or params.get("texte", "")
        return _valider_texte_libre(texte, pays, state)

    # Type inconnu : on tolère mais on prévient.
    return _verdict(True, f"Action « {type_action} » acceptée (validation générique).")


def _valider_texte_libre(texte: str, pays: dict, state: dict) -> dict:
    """Valide une action en langage naturel via Ollama, repli permissif sinon."""
    if not texte.strip():
        return _verdict(False, "Action vide.", "Décris l'action que tu souhaites entreprendre.")

    if not ai_director.modele_pret():
        # Repli déterministe permissif (le jeu n'est jamais bloqué).
        return _verdict(True, "Action plausible (validation IA indisponible, tolérance appliquée).")

    date_jeu = state.get("meta", {}).get("date_jeu", "264-03")
    ressources = pays.get("ressources", {})
    unites = pays.get("unites", [])
    template = ai_director._charger_template("validateur_realisme.md", _TEMPLATE_VALIDATEUR)
    prompt = ai_director._remplir(
        template,
        {
            "DATE_JEU": ai_director._date_lisible(date_jeu),
            "ACTION_JOUEUR": texte,
            "RESSOURCES": json.dumps(ressources, ensure_ascii=False),
            "ETAT_MILITAIRE": json.dumps(
                [{"type": u.get("type"), "territoire": u.get("territoire"),
                  "effectif": u.get("effectif")} for u in unites],
                ensure_ascii=False),
        },
    )
    try:
        payload = {"model": ai_director.MODELE, "prompt": prompt, "stream": False,
                   "format": "json", "options": {"temperature": 0.3}}
        r = httpx.post(ai_director.OLLAMA_GENERATE, json=payload, timeout=ai_director.TIMEOUT_S)
        if r.status_code == 200:
            brut = (r.json().get("response") or "").strip()
            verdict = _extraire_json(brut)
            if verdict is not None:
                return _verdict(
                    bool(verdict.get("valide", True)),
                    str(verdict.get("raison", "")),
                    str(verdict.get("suggestion", "")),
                )
    except Exception:
        pass

    # Repli permissif si l'IA n'a pas répondu correctement.
    return _verdict(True, "Action plausible (validation IA indisponible, tolérance appliquée).")


def _extraire_json(brut: str) -> dict | None:
    """Extrait un objet JSON d'une réponse potentiellement bruitée."""
    try:
        return json.loads(brut)
    except Exception:
        pass
    m = re.search(r"\{.*\}", brut, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            return None
    return None


_TEMPLATE_VALIDATEUR = """Tu es un arbitre historique pour un jeu de stratégie situé en {DATE_JEU}.

ACTION PROPOSÉE : "{ACTION_JOUEUR}"
RESSOURCES DISPONIBLES : {RESSOURCES}
ÉTAT MILITAIRE : {ETAT_MILITAIRE}

Évalue si cette action est réalisable, plausible et logistiquement cohérente à cette époque.

Réponds UNIQUEMENT en JSON :
{
  "valide": true,
  "raison": "explication courte",
  "suggestion": "alternative si refusé, sinon vide"
}"""
