"""Modèle de pays (faction) — agrégat de l'état d'une civilisation.

Conforme au schéma GameState d'ARCHITECTURE §3. Le modèle est volontairement
souple (round-trip dict <-> Country) pour rester aligné avec le JSON échangé via
l'API sans perdre de champs inconnus.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .unit import Unit, force_unite
from .city import City

# Métadonnées canoniques des factions (ARCHITECTURE §1).
META_FACTIONS: dict[str, dict[str, str]] = {
    "rome": {"nom": "Rome", "couleur": "#b03a2e"},
    "carthage": {"nom": "Égypte", "couleur": "#c9a227"},
    "macedoine": {"nom": "Macédoine", "couleur": "#1e8449"},
    "sparte": {"nom": "Sparte", "couleur": "#2e6da4"},
}

# Ressources de base et de luxe (cahier §7).
RESSOURCES_BASE = ["or", "nourriture", "eau", "pierre", "bois", "fer", "population"]
RESSOURCES_LUXE = ["vin", "epices", "ivoire", "marbre", "grain_egyptien"]


@dataclass
class Country:
    """État complet d'une faction."""

    id: str
    nom: str
    couleur: str
    est_joueur: bool = False
    ressources: dict[str, float] = field(default_factory=dict)
    ressources_luxe: dict[str, float] = field(default_factory=dict)
    production: dict[str, float] = field(default_factory=dict)
    villes: list[City] = field(default_factory=list)
    unites: list[Unit] = field(default_factory=list)
    territoires: list[str] = field(default_factory=list)
    technologies: list[str] = field(default_factory=list)
    recherche_en_cours: dict | None = None
    reputation: dict[str, int] = field(default_factory=dict)
    stabilite: int = 70
    puissance: int = 0

    def force_militaire_totale(self) -> int:
        """Somme des forces de toutes les unités (Unités × Force, cf. §10.2)."""
        return sum(u.force_totale() for u in self.unites)

    @classmethod
    def from_dict(cls, fid: str, d: dict) -> "Country":
        meta = META_FACTIONS.get(fid, {})
        return cls(
            id=d.get("id", fid),
            nom=d.get("nom", meta.get("nom", fid.capitalize())),
            couleur=d.get("couleur", meta.get("couleur", "#7f8c8d")),
            est_joueur=bool(d.get("est_joueur", False)),
            ressources=dict(d.get("ressources", {})),
            ressources_luxe=dict(d.get("ressources_luxe", {})),
            production=dict(d.get("production", {})),
            villes=[City.from_dict(v) for v in d.get("villes", [])],
            unites=[Unit.from_dict(u) for u in d.get("unites", [])],
            territoires=list(d.get("territoires", [])),
            technologies=list(d.get("technologies", [])),
            recherche_en_cours=d.get("recherche_en_cours"),
            reputation=dict(d.get("reputation", {})),
            stabilite=int(d.get("stabilite", 70)),
            puissance=int(d.get("puissance", 0)),
        )

    def to_dict(self, inclure_puissance: bool = True) -> dict:
        d = {
            "id": self.id,
            "nom": self.nom,
            "couleur": self.couleur,
            "est_joueur": self.est_joueur,
            "ressources": self.ressources,
            "ressources_luxe": self.ressources_luxe,
            "production": self.production,
            "villes": [v.to_dict() for v in self.villes],
            "unites": [u.to_dict() for u in self.unites],
            "territoires": list(self.territoires),
            "technologies": list(self.technologies),
            "recherche_en_cours": self.recherche_en_cours,
            "reputation": self.reputation,
            "stabilite": self.stabilite,
        }
        if inclure_puissance:
            d["puissance"] = self.puissance
        return d
