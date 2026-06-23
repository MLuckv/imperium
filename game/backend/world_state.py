"""Persistance de l'état du jeu et génération du world_state narratif.

- Chargement/sauvegarde du GameState en JSON (schéma ARCHITECTURE §3).
- Gestion des slots de sauvegarde (saves/save_slot_N.json).
- Génération/écriture du world_state.md (narratif §14.3) tous les 6 tours :
  via ai_director si Ollama est prêt, sinon via un template déterministe.

Tous les chemins sont résolus depuis game/ (Path(__file__).parent.parent), donc
indépendants du répertoire de travail courant.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import ai_director

# game/ = parent du dossier backend/.
RACINE = Path(__file__).resolve().parent.parent
DOSSIER_SAVES = RACINE / "saves"
DOSSIER_DATA = RACINE / "data"

# Sauvegarde « courante » (partie en cours), distincte des slots numérotés.
FICHIER_ETAT_COURANT = DOSSIER_SAVES / "save_courant.json"

MOIS_NOMS = [
    "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]


def _assurer_dossier() -> None:
    DOSSIER_SAVES.mkdir(parents=True, exist_ok=True)


# =====================================================================
#  État courant
# =====================================================================
def etat_courant_existe() -> bool:
    return FICHIER_ETAT_COURANT.exists()


def charger_etat_courant() -> dict | None:
    if not FICHIER_ETAT_COURANT.exists():
        return None
    try:
        return json.loads(FICHIER_ETAT_COURANT.read_text(encoding="utf-8"))
    except Exception:
        return None


def sauver_etat_courant(state: dict) -> None:
    _assurer_dossier()
    FICHIER_ETAT_COURANT.write_text(
        json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8"
    )


# =====================================================================
#  Slots de sauvegarde
# =====================================================================
def chemin_slot(slot: int) -> Path:
    return DOSSIER_SAVES / f"save_slot_{int(slot)}.json"


def sauver_slot(state: dict, slot: int) -> str:
    """Écrit le GameState dans saves/save_slot_N.json. Retourne le chemin relatif."""
    _assurer_dossier()
    chemin = chemin_slot(slot)
    chemin.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    return f"saves/save_slot_{int(slot)}.json"


def charger_slot(slot: int) -> dict | None:
    chemin = chemin_slot(slot)
    if not chemin.exists():
        return None
    try:
        return json.loads(chemin.read_text(encoding="utf-8"))
    except Exception:
        return None


def lister_slots() -> list[dict]:
    """Liste les slots existants avec leurs métadonnées (tour, date, pays)."""
    _assurer_dossier()
    slots = []
    for chemin in sorted(DOSSIER_SAVES.glob("save_slot_*.json")):
        m = re.match(r"save_slot_(\d+)\.json", chemin.name)
        if not m:
            continue
        slot_num = int(m.group(1))
        try:
            data = json.loads(chemin.read_text(encoding="utf-8"))
            meta = data.get("meta", {})
            slots.append({
                "slot": slot_num,
                "tour": meta.get("tour"),
                "date_jeu": meta.get("date_jeu"),
                "joueur_pays": meta.get("joueur_pays"),
            })
        except Exception:
            slots.append({"slot": slot_num, "tour": None,
                          "date_jeu": None, "joueur_pays": None})
    slots.sort(key=lambda s: s["slot"])
    return slots


# =====================================================================
#  world_state.md narratif (§14.3)
# =====================================================================
def date_lisible(date_jeu: str, annee: int | None = None) -> str:
    try:
        a, mois = date_jeu.split("-")
        suffixe = "ap. J.-C." if (annee is not None and annee >= 0) else "av. J.-C."
        return f"{MOIS_NOMS[int(mois)]} {int(a)} {suffixe}"
    except Exception:
        return f"{date_jeu}"


def chemin_world_state(date_jeu: str) -> Path:
    """saves/world_state_AAAA_MM.md à partir de la date de jeu '264-03'."""
    try:
        annee, mois = date_jeu.split("-")
        return DOSSIER_SAVES / f"world_state_{int(annee):03d}_{int(mois):02d}.md"
    except Exception:
        return DOSSIER_SAVES / "world_state_courant.md"


def _donnees_factuelles(state: dict) -> str:
    """Synthèse factuelle du monde pour nourrir la génération narrative."""
    lignes = []
    meta = state.get("meta", {})
    lignes.append(f"Date : {date_lisible(meta.get('date_jeu', '5-03'), meta.get('annee'))}, tour {meta.get('tour')}.")
    for fid, pays in state.get("pays", {}).items():
        terr = ", ".join(pays.get("territoires", []))
        nb_unites = sum(u.get("effectif", 1) for u in pays.get("unites", []))
        lignes.append(
            f"- {pays.get('nom', fid)} : {len(pays.get('villes', []))} ville(s), "
            f"{nb_unites} unité(s), territoires [{terr}], "
            f"or {int(pays.get('ressources', {}).get('or', 0))}, "
            f"stabilité {pays.get('stabilite')}."
        )
    # Relations bilatérales.
    rels = []
    pays = state.get("pays", {})
    for fid, p in pays.items():
        for autre, score in p.get("reputation", {}).items():
            rels.append(f"{fid}->{autre}: {score}")
    if rels:
        lignes.append("Relations : " + " ; ".join(rels) + ".")
    # Événements récents (historique).
    hist = state.get("historique_actions", [])[-6:]
    if hist:
        lignes.append("Actions récentes :")
        for h in hist:
            lignes.append(f"  * [{h.get('acteur')}] {h.get('texte')}")
    return "\n".join(lignes)


def _template_deterministe(state: dict) -> str:
    """world_state.md déterministe (secours si Ollama indisponible)."""
    meta = state.get("meta", {})
    date_txt = date_lisible(meta.get("date_jeu", "5-03"), meta.get("annee"))
    pays = state.get("pays", {})

    # Situation générale.
    noms = [p.get("nom", fid) for fid, p in pays.items()]
    situation = (
        f"Au {date_txt} (tour {meta.get('tour')}), la Méditerranée centrale demeure "
        f"un échiquier disputé entre {', '.join(noms)}. Chaque puissance manœuvre "
        f"pour ses ressources, ses villes et le contrôle des routes."
    )

    # Événements récents : depuis l'historique et les événements du tour.
    evenements = []
    for h in state.get("historique_actions", [])[-6:]:
        evenements.append(f"- {h.get('texte')}")
    for ev in state.get("evenements_tour", [])[-6:]:
        txt = ev.get("texte") if isinstance(ev, dict) else str(ev)
        if txt:
            evenements.append(f"- {txt}")
    if not evenements:
        evenements.append("- Le calme précaire se maintient sur les frontières.")

    # Tensions actives : relations bilatérales.
    tensions = []
    vus = set()
    for fid, p in pays.items():
        for autre, score in p.get("reputation", {}).items():
            paire = tuple(sorted([fid, autre]))
            if paire in vus:
                continue
            vus.add(paire)
            score_inverse = pays.get(autre, {}).get("reputation", {}).get(fid, score)
            if score <= -50:
                qualif = "Tension élevée"
            elif score < 0:
                qualif = "Relations tendues"
            elif score >= 30:
                qualif = "Relations amicales"
            else:
                qualif = "Neutralité"
            n1 = pays.get(fid, {}).get("nom", fid)
            n2 = pays.get(autre, {}).get("nom", autre)
            tensions.append(
                f"- **{n1} / {n2}** : {qualif} ({n1} {score} / {n2} {score_inverse})."
            )
    if not tensions:
        tensions.append("- Aucune tension majeure recensée.")

    return (
        f"# État du Monde — {date_txt}\n\n"
        f"## Situation Générale\n{situation}\n\n"
        f"## Événements récents\n" + "\n".join(evenements) + "\n\n"
        f"## Tensions actives\n" + "\n".join(tensions) + "\n"
    )


def generer_world_state(state: dict) -> tuple[str, str]:
    """Génère le contenu Markdown du world_state.

    Retourne (contenu_markdown, source) où source ∈ {"ollama", "fallback"}.
    Tente Ollama si prêt ; complète l'en-tête daté ; sinon template déterministe.
    """
    meta = state.get("meta", {})
    date_jeu = meta.get("date_jeu", "5-03")
    date_txt = date_lisible(date_jeu, meta.get("annee"))

    res = ai_director.generer_monde_narratif(_donnees_factuelles(state), date_jeu)
    if res.get("source") == "ollama" and res.get("texte"):
        corps = res["texte"]
        if not corps.lstrip().startswith("#"):
            corps = f"# État du Monde — {date_txt}\n\n{corps}"
        return corps, "ollama"

    return _template_deterministe(state), "fallback"


def ecrire_world_state(state: dict, ecraser: bool = True) -> dict:
    """Génère et écrit le world_state.md. Retourne {fichier, source}.

    Si `ecraser` est False et qu'un fichier existe déjà pour cette date, on le
    préserve (cas du world_state initial fourni par l'agent DATA : on ne veut pas
    l'écraser au démarrage d'une nouvelle partie).
    """
    _assurer_dossier()
    chemin = chemin_world_state(state.get("meta", {}).get("date_jeu", "264-03"))
    if not ecraser and chemin.exists():
        return {"fichier": str(chemin.relative_to(RACINE)), "source": "existant"}
    contenu, source = generer_world_state(state)
    try:
        chemin.write_text(contenu, encoding="utf-8")
    except Exception:
        pass
    return {"fichier": str(chemin.relative_to(RACINE)), "source": source}


def lire_world_state_courant(state: dict) -> str:
    """Lit le world_state.md correspondant à la date courante (ou le plus récent)."""
    chemin = chemin_world_state(state.get("meta", {}).get("date_jeu", "264-03"))
    if chemin.exists():
        try:
            return chemin.read_text(encoding="utf-8")
        except Exception:
            pass
    # Sinon, le plus récent disponible.
    candidats = sorted(DOSSIER_SAVES.glob("world_state_*.md"))
    if candidats:
        try:
            return candidats[-1].read_text(encoding="utf-8")
        except Exception:
            pass
    return ""
