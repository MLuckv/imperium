"""Historique des conversations privées entre le joueur et chaque dirigeant IA.

Chaque IA dispose de son propre fil de discussion. La source de vérité vit dans
le GameState (`state["conversations"][faction]`) pour que la sauvegarde/chargement
fonctionne naturellement ; on miroite EN PLUS chaque fil dans un fichier JSON
dédié `saves/conversations/<faction>.json` (exigence : « chaque IA doit disposer
d'un fichier JSON regroupant l'historique complet de ses conversations »).

Format d'un message :
    {"role": "joueur"|"ia", "auteur": "Hamilcar Barca", "texte": "...",
     "tour": 3, "ts": 1718560000.0, "analyse": false}

`analyse` indique si le message a déjà été pris en compte par l'analyse de fin de
tour (détection d'accords). Les messages non analysés du tour courant sont
examinés à chaque fin de tour, puis marqués `analyse=true`.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
DOSSIER_CONV = RACINE / "saves" / "conversations"


def _assurer_dossier() -> None:
    DOSSIER_CONV.mkdir(parents=True, exist_ok=True)


def chemin_fichier(faction: str) -> Path:
    return DOSSIER_CONV / f"{faction}.json"


def _conversations(state: dict) -> dict:
    return state.setdefault("conversations", {})


def get_conversation(state: dict, faction: str) -> list[dict]:
    """Retourne la liste des messages échangés avec `faction` (vide si aucun)."""
    return list(_conversations(state).get(faction, []))


def _ecrire_fichier(faction: str, messages: list[dict]) -> None:
    """Miroir disque du fil d'une IA (best-effort, ne lève jamais)."""
    try:
        _assurer_dossier()
        chemin_fichier(faction).write_text(
            json.dumps({"faction": faction, "messages": messages},
                       ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception:
        pass


def ajouter_message(state: dict, faction: str, role: str, auteur: str,
                    texte: str, tour: int | None = None) -> dict:
    """Ajoute un message au fil de `faction` (état + fichier). Retourne le message."""
    conv = _conversations(state).setdefault(faction, [])
    msg = {
        "role": role,
        "auteur": auteur,
        "texte": texte,
        "tour": tour,
        "ts": round(time.time(), 3),
        "analyse": False,
    }
    conv.append(msg)
    _ecrire_fichier(faction, conv)
    return msg


def messages_non_analyses(state: dict, faction: str) -> list[dict]:
    """Messages du fil de `faction` pas encore pris en compte par l'analyse."""
    return [m for m in _conversations(state).get(faction, []) if not m.get("analyse")]


def marquer_analyses(state: dict, faction: str) -> None:
    """Marque tous les messages de `faction` comme analysés et réécrit le fichier."""
    conv = _conversations(state).get(faction, [])
    for m in conv:
        m["analyse"] = True
    _ecrire_fichier(faction, conv)


def historique_pour_prompt(state: dict, faction: str, limite: int = 12) -> list[dict]:
    """Derniers messages formatés pour nourrir le prompt de l'IA (cohérence)."""
    conv = _conversations(state).get(faction, [])
    return conv[-limite:]


def reinitialiser(state: dict, factions: list[str]) -> None:
    """Vide tous les fils (nouvelle partie) et efface les fichiers miroir."""
    state["conversations"] = {fid: [] for fid in factions}
    for fid in factions:
        _ecrire_fichier(fid, [])
