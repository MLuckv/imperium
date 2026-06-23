#!/usr/bin/env python3
"""Test des prompts IA sur scénarios réels (dégradation gracieuse).

Lancement (depuis backend/prompts/) :
    ../.venv/bin/python test_prompts.py
ou en module (depuis backend/) :
    python -m prompts.test_prompts

Ce script charge les VRAIES fonctions de ai_director.py et realism_validator.py,
charge un état de partie de test (saves/save_slot_exemple.json), puis exécute :
  (a) un message diplomatique du joueur (Rome) à Hamilcar (Carthage) ;
  (b) la validation d'une action réaliste (recruter des légionnaires) et de
      deux actions irréalistes/anachroniques (« je construis des canons »,
      « j'envoie un télégramme ») ;
  (c) la génération d'un extrait narratif de world_state.

Il fonctionne que le modèle llama3.1:8b soit présent (source "ollama") ou
absent (source "fallback"), affiche la source et un extrait pour chaque
scénario, et ne lève JAMAIS d'exception : tout échec est rapporté, jamais fatal.
"""

from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path

# --- Résolution des chemins (indépendante du cwd) ---
ICI = Path(__file__).resolve().parent          # .../backend/prompts
BACKEND = ICI.parent                           # .../backend
RACINE = BACKEND.parent                         # .../game
SAVE_EXEMPLE = RACINE / "saves" / "save_slot_exemple.json"

# Le validateur et le directeur importent en chemin plat (import ai_director,
# import tech_tree, from models...). On ajoute donc backend/ au sys.path.
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

import ai_director           # noqa: E402
import realism_validator     # noqa: E402


# ---------------------------------------------------------------------------
#  Utilitaires d'affichage
# ---------------------------------------------------------------------------
SEP = "=" * 72


def titre(txt: str) -> None:
    print("\n" + SEP)
    print(txt)
    print(SEP)


def extrait(texte: str, n: int = 280) -> str:
    texte = (texte or "").strip()
    texte = " ".join(texte.split())  # compacte les espaces/sauts de ligne
    return texte if len(texte) <= n else texte[:n].rstrip() + " […]"


def charger_state() -> dict:
    """Charge l'état de test, ou construit un GameState minimal de secours."""
    try:
        if SAVE_EXEMPLE.exists():
            return json.loads(SAVE_EXEMPLE.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"  (avertissement : lecture de {SAVE_EXEMPLE.name} impossible : {e})")
    # GameState minimal conforme au schéma ARCHITECTURE §3.
    return {
        "meta": {"date_jeu": "264-03", "tour": 1, "joueur_pays": "rome"},
        "pays": {
            "rome": {
                "id": "rome", "est_joueur": True,
                "ressources": {"or": 350, "nourriture": 320, "fer": 150},
                "unites": [{"id": "rome-leg-1", "type": "legionnaire",
                            "territoire": "latium", "effectif": 3, "moral": 100}],
                "technologies": ["legion_tactique"],
                "reputation": {"carthage": -30, "macedoine": 0},
            },
            "carthage": {"id": "carthage", "est_joueur": False,
                         "reputation": {"rome": -70}},
        },
        "diplomatie": {"traites_actifs": [], "guerres_actives": []},
        "historique_actions": [],
    }


# ---------------------------------------------------------------------------
#  Diagnostic Ollama
# ---------------------------------------------------------------------------
def diagnostic() -> None:
    titre("DIAGNOSTIC OLLAMA")
    try:
        statut = ai_director.statut_ollama()
    except Exception as e:
        statut = {"erreur": str(e)}
    print(f"  Serveur Ollama joignable : {statut.get('ollama')}")
    print(f"  Modèle cible             : {statut.get('modele')}")
    print(f"  Modèle prêt (téléchargé) : {statut.get('modele_pret')}")
    if not statut.get("modele_pret"):
        print("  -> Mode FALLBACK attendu (le modèle n'est pas encore disponible).")
    else:
        print("  -> Mode OLLAMA attendu (le modèle répondra aux prompts).")


# ---------------------------------------------------------------------------
#  Scénario (a) : message diplomatique du joueur à Hamilcar (Carthage)
# ---------------------------------------------------------------------------
def scenario_diplomatie(state: dict) -> bool:
    titre("SCÉNARIO (a) — Message diplomatique : Rome -> Hamilcar (Carthage)")
    message = ("Suffète de Carthage, Rome te propose un pacte de non-agression "
               "de cinq ans en échange d'un libre accès aux routes de Sicile.")
    print(f"  Message joueur : {message}")
    try:
        date_jeu = state.get("meta", {}).get("date_jeu", "264-03")
        historique = [
            {"acteur": "rome", "texte": "Rome a déplacé une légion vers la Campanie."},
            {"acteur": "carthage", "texte": "Carthage a renforcé sa flotte."},
        ]
        res = ai_director.reponse_diplomatique(
            faction_cible="carthage",
            message_joueur=message,
            etat_monde="Tension élevée entre Rome et Carthage autour de la Sicile.",
            historique=historique,
            date_jeu=date_jeu,
            pays_joueur="rome",
        )
        print(f"  Auteur  : {res.get('auteur')}")
        print(f"  Source  : {res.get('source')}")
        print(f"  Réponse : {extrait(res.get('reponse', ''))}")
        # Validation minimale : on a bien un auteur, une source connue, un texte.
        ok = (
            bool(res.get("reponse", "").strip())
            and res.get("source") in ("ollama", "fallback")
            and bool(res.get("auteur"))
        )
        print(f"  [OK] réponse en personnage reçue." if ok
              else "  [ÉCHEC] réponse vide ou mal formée.")
        return ok
    except Exception:
        print("  [ÉCHEC] exception (ne devrait jamais arriver) :")
        traceback.print_exc()
        return False


# ---------------------------------------------------------------------------
#  Scénario (b) : validation réaliste vs irréaliste/anachronique
# ---------------------------------------------------------------------------
def _verifier_forme_verdict(v: dict) -> bool:
    """Vérifie la forme {valide, raison, suggestion}."""
    return (
        isinstance(v, dict)
        and isinstance(v.get("valide"), bool)
        and "raison" in v
        and "suggestion" in v
    )


def scenario_validation(state: dict) -> bool:
    titre("SCÉNARIO (b) — Validation de réalisme")
    pays = state.get("pays", {}).get("rome", {})
    tous_ok = True

    actions = [
        ("Réaliste (structurée) : recruter 2 légionnaires",
         {"type": "recruter", "params": {"type": "legionnaire", "quantite": 2}}),
        ("Anachronique (texte libre) : « je construis des canons »",
         {"type": "texte_libre", "texte": "Je construis des canons pour bombarder Carthage."}),
        ("Anachronique (texte libre) : « j'envoie un télégramme »",
         {"type": "texte_libre", "texte": "J'envoie un télégramme urgent au Sénat de Carthage."}),
        ("Réaliste (texte libre) : envoyer un émissaire",
         {"type": "texte_libre", "texte": "J'envoie un émissaire à cheval négocier un traité commercial avec Carthage."}),
    ]

    for libelle, action in actions:
        print(f"\n  - {libelle}")
        try:
            v = realism_validator.valider_action(action, pays, state)
            forme = _verifier_forme_verdict(v)
            print(f"      valide     : {v.get('valide')}")
            print(f"      raison     : {extrait(v.get('raison', ''), 160)}")
            print(f"      suggestion : {extrait(v.get('suggestion', ''), 160)}")
            print(f"      forme {{valide,raison,suggestion}} : "
                  + ("OK" if forme else "INVALIDE"))
            tous_ok = tous_ok and forme
        except Exception:
            print("      [ÉCHEC] exception (ne devrait jamais arriver) :")
            traceback.print_exc()
            tous_ok = False

    print("\n  [OK] toutes les validations renvoient la forme attendue." if tous_ok
          else "\n  [ÉCHEC] au moins un verdict mal formé.")
    print("  Note : sans le modèle llama3.1:8b, le texte libre est validé en")
    print("  mode permissif (tolérance) — c'est le comportement attendu du backend.")
    return tous_ok


# ---------------------------------------------------------------------------
#  Scénario (c) : génération d'un extrait de world_state narratif
# ---------------------------------------------------------------------------
def scenario_monde(state: dict) -> bool:
    titre("SCÉNARIO (c) — Génération de world_state narratif")
    date_jeu = state.get("meta", {}).get("date_jeu", "264-03")
    # Données factuelles compactes tirées de l'état (sans dépendre de world_state.py).
    pays = state.get("pays", {})
    lignes = ["Factions et relations :"]
    for fid, p in pays.items():
        rep = p.get("reputation", {})
        rep_txt = ", ".join(f"{a}:{s}" for a, s in rep.items()) or "aucune"
        lignes.append(f"- {fid} (territoires: {len(p.get('territoires', []))}) "
                      f"réputation -> {rep_txt}")
    lignes.append("Faits récents : Rome a envoyé une légion vers la Campanie ; "
                  "Carthage a renforcé sa flotte ; émissaires carthaginois à Pella.")
    donnees = "\n".join(lignes)

    try:
        res = ai_director.generer_monde_narratif(donnees, date_jeu=date_jeu)
        source = res.get("source")
        texte = res.get("texte", "")
        print(f"  Source : {source}")
        if texte:
            print(f"  Extrait : {extrait(texte, 400)}")
        else:
            print("  Extrait : (vide — repli déterministe géré par world_state.py côté backend)")
        # La fonction renvoie toujours un dict {texte, source} sans exception.
        ok = isinstance(res, dict) and source in ("ollama", "fallback")
        print("  [OK] générateur narratif appelé sans erreur." if ok
              else "  [ÉCHEC] sortie inattendue.")
        if source == "fallback":
            print("  Note : en l'absence du modèle, ai_director renvoie texte='' et")
            print("  laisse world_state.py produire le snapshot déterministe.")
        return ok
    except Exception:
        print("  [ÉCHEC] exception (ne devrait jamais arriver) :")
        traceback.print_exc()
        return False


# ---------------------------------------------------------------------------
#  Vérification que les templates personnalisés sont bien chargés
# ---------------------------------------------------------------------------
def verifier_templates() -> bool:
    titre("VÉRIFICATION — Chargement des templates personnalisés")
    attendus = {
        "systeme_dirigeant.md": ["{NOM_DIRIGEANT}", "{PAYS}", "{PAYS_JOUEUR}",
                                 "{DATE_JEU}", "{PROFIL}", "{ETAT_MONDE}",
                                 "{HISTORIQUE}", "{MESSAGE}"],
        "validateur_realisme.md": ["{DATE_JEU}", "{ACTION_JOUEUR}",
                                   "{RESSOURCES}", "{ETAT_MILITAIRE}"],
        "monde_narratif.md": ["{DATE_JEU}", "{DONNEES}"],
        "profil_joueur.md": ["{PAYS_JOUEUR}", "{DATE_JEU}",
                             "{HISTORIQUE}", "{REPUTATION}", "{PROFIL_ACTUEL}"],
    }
    tous_ok = True
    for fichier, placeholders in attendus.items():
        chemin = ICI / fichier
        existe = chemin.exists()
        contenu = chemin.read_text(encoding="utf-8") if existe else ""
        manquants = [p for p in placeholders if p not in contenu]
        statut = "OK" if (existe and not manquants) else "PROBLÈME"
        print(f"  {fichier:<26} présent={existe}  placeholders={statut}")
        if manquants:
            print(f"      -> placeholders manquants : {manquants}")
            tous_ok = False
        if not existe:
            tous_ok = False
    return tous_ok


# ---------------------------------------------------------------------------
#  Point d'entrée
# ---------------------------------------------------------------------------
def main() -> int:
    print("Test des prompts IA — jeu de grande stratégie historique")
    print(f"backend = {BACKEND}")
    print(f"prompts = {ICI}")
    print(f"save    = {SAVE_EXEMPLE} (présent={SAVE_EXEMPLE.exists()})")

    diagnostic()
    state = charger_state()

    resultats = {
        "templates": verifier_templates(),
        "(a) diplomatie": scenario_diplomatie(state),
        "(b) validation": scenario_validation(state),
        "(c) world_state": scenario_monde(state),
    }

    titre("RÉCAPITULATIF")
    for nom, ok in resultats.items():
        print(f"  {nom:<18} : {'OK' if ok else 'ÉCHEC'}")
    tout_ok = all(resultats.values())
    print("\nRÉSULTAT GLOBAL : " + ("TOUS LES SCÉNARIOS PASSENT"
                                    if tout_ok else "DES SCÉNARIOS ONT ÉCHOUÉ"))
    # On retourne 0 même si Ollama est absent : le mode fallback est un succès.
    return 0 if tout_ok else 1


if __name__ == "__main__":
    sys.exit(main())
