"""Modèle de ville et améliorations (cahier §9.1).

| Amélioration   | Coût (or) | Effet                               |
|----------------|-----------|-------------------------------------|
| Marché         | 100       | +20% or produit                     |
| Grenier        | 80        | +30% nourriture                     |
| Aqueduc        | 120       | +Eau, +Pop max                      |
| Murailles      | 150       | +50% défense ville                  |
| Forum / Agora  | 200       | +Culture, +Diplomatie               |
| Port           | 180       | Accès naval, +Commerce              |
| Camp militaire | 100       | -20% coût recrutement               |
"""

from __future__ import annotations

from dataclasses import dataclass, field

# Identifiants canoniques des bâtiments.
BATIMENTS: list[str] = [
    "ferme", "puits", "scierie", "carriere", "mine", "aqueduc",
    "marche", "grenier", "forum", "agora", "port", "camp_militaire", "murailles",
]

# Coût en OR de chaque bâtiment.
COUT_BATIMENTS: dict[str, int] = {
    # Extraction (production de base : RIEN n'est produit sans ces bâtiments)
    "ferme": 50, "puits": 40, "scierie": 60, "carriere": 70, "mine": 90, "aqueduc": 120,
    # Économie / société
    "marche": 100, "grenier": 80, "forum": 200, "agora": 200, "port": 180,
    # Militaire / défense
    "camp_militaire": 100, "murailles": 150,
}

# Coût en AUTRES ressources (les bâtiments avancés exigent bois/pierre).
# Les bâtiments de base (ferme/puits/scierie) ne coûtent que de l'or (amorçage).
COUT_RES_BATIMENTS: dict[str, dict[str, int]] = {
    "carriere": {"bois": 15}, "mine": {"bois": 20}, "aqueduc": {"pierre": 25},
    "grenier": {"bois": 15}, "marche": {"pierre": 20, "bois": 10},
    "murailles": {"pierre": 50}, "camp_militaire": {"bois": 20},
    "forum": {"pierre": 40}, "agora": {"pierre": 40}, "port": {"bois": 30},
}

# PRODUCTION FIXE (par tour) ajoutée par un bâtiment d'extraction.
PROD_BATIMENTS: dict[str, dict[str, float]] = {
    "ferme": {"nourriture": 5, "eau": -2},   # une ferme consomme de l'eau (irrigation)
    "puits": {"eau": 4},
    "aqueduc": {"eau": 6},
    "scierie": {"bois": 5},
    "carriere": {"pierre": 5},
    "mine": {"fer": 4, "pierre": 2},
    "port": {"or": 3},
}

# Effets MULTIPLICATIFS (% sur la prod de la ressource).
EFFETS_BATIMENTS: dict[str, dict[str, float]] = {
    "marche": {"or": 0.25},
    "grenier": {"nourriture": 0.30},
    "forum": {"or": 0.12},
    "agora": {"or": 0.12},
}

# Bonus de stabilité (cible) apporté par certains bâtiments.
STABILITE_BATIMENTS: dict[str, int] = {"forum": 4, "agora": 4, "aqueduc": 1, "grenier": 1}

# Durée de construction (tours).
# Durées en MOIS (1 tour = 1 mois) — réalistes : petits ouvrages rapides, aqueduc
# ~1 an, grands monuments civiques longs. Les merveilles (plusieurs années) sont
# définies dans merveilles.py.
DUREE_BATIMENTS: dict[str, int] = {
    "ferme": 3, "puits": 3, "scierie": 4, "carriere": 5, "mine": 6, "aqueduc": 12,
    "grenier": 5, "camp_militaire": 4, "marche": 7, "murailles": 10, "port": 9, "forum": 14, "agora": 12,
}

# Catalogue lisible servi au frontend (/api/catalog). Ordre = ordre d'affichage.
CATALOGUE_BATIMENTS: list[dict] = [
    {"id": "ferme", "nom": "Ferme", "cout": 50, "duree": 3, "effet": "+5 nourriture (−2 eau)", "categorie": "Extraction"},
    {"id": "puits", "nom": "Puits", "cout": 40, "duree": 3, "effet": "+4 eau", "categorie": "Extraction"},
    {"id": "scierie", "nom": "Scierie", "cout": 60, "duree": 4, "effet": "+5 bois", "categorie": "Extraction"},
    {"id": "carriere", "nom": "Carrière", "cout": 70, "duree": 5, "effet": "+5 pierre", "cout_res": {"bois": 15}, "categorie": "Extraction"},
    {"id": "mine", "nom": "Mine", "cout": 90, "duree": 6, "effet": "+4 fer, +2 pierre", "cout_res": {"bois": 20}, "categorie": "Extraction"},
    {"id": "aqueduc", "nom": "Aqueduc", "cout": 120, "duree": 12, "effet": "+6 eau, +stabilité", "cout_res": {"pierre": 25}, "categorie": "Extraction"},
    {"id": "grenier", "nom": "Grenier", "cout": 80, "duree": 5, "effet": "+30% nourriture", "cout_res": {"bois": 15}, "categorie": "Économie"},
    {"id": "marche", "nom": "Marché", "cout": 100, "duree": 7, "effet": "+25% or", "cout_res": {"pierre": 20, "bois": 10}, "categorie": "Économie"},
    {"id": "forum", "nom": "Forum", "cout": 200, "duree": 14, "effet": "+12% or, +stabilité", "cout_res": {"pierre": 40}, "categorie": "Économie"},
    {"id": "agora", "nom": "Agora", "cout": 200, "duree": 12, "effet": "+12% or, +stabilité", "cout_res": {"pierre": 40}, "categorie": "Économie"},
    {"id": "port", "nom": "Port", "cout": 180, "duree": 9, "effet": "+3 or, accès naval", "cout_res": {"bois": 30}, "categorie": "Économie"},
    {"id": "camp_militaire", "nom": "Camp militaire", "cout": 100, "duree": 4, "effet": "−20% coût recrutement", "cout_res": {"bois": 20}, "categorie": "Militaire"},
    {"id": "murailles", "nom": "Murailles", "cout": 150, "duree": 10, "effet": "+50% défense", "cout_res": {"pierre": 50}, "categorie": "Militaire"},
]


@dataclass
class City:
    """Une ville contrôlée par une faction."""

    id: str
    nom: str
    territoire: str
    population: int = 10
    batiments: list[str] = field(default_factory=list)
    fortifications: int = 0
    # Compteur de pacification après capture (cahier §9.3, 5 tours).
    pacification: int = 0

    def a_batiment(self, batiment: str) -> bool:
        return batiment in self.batiments

    @classmethod
    def from_dict(cls, d: dict) -> "City":
        return cls(
            id=d["id"],
            nom=d.get("nom", d["id"].capitalize()),
            territoire=d.get("territoire", ""),
            population=int(d.get("population", 10)),
            batiments=list(d.get("batiments", [])),
            fortifications=int(d.get("fortifications", 0)),
            pacification=int(d.get("pacification", 0)),
        )

    def to_dict(self) -> dict:
        d = {
            "id": self.id,
            "nom": self.nom,
            "territoire": self.territoire,
            "population": self.population,
            "batiments": list(self.batiments),
            "fortifications": self.fortifications,
        }
        if self.pacification > 0:
            d["pacification"] = self.pacification
        return d
