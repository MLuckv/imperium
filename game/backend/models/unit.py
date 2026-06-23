"""Modèle d'unité militaire.

Forces et coûts repris du cahier des charges §8.1.

| Unité               | Coût (or) | Force | Spécialité      |
|---------------------|-----------|-------|-----------------|
| Levée paysanne      | 10        | 2     | Aucune          |
| Infanterie légère   | 25        | 4     | Vitesse         |
| Légionnaire / Hoplite | 50      | 7     | Discipline      |
| Phalange macédonienne | 60      | 8     | Mur de lances   |
| Cavalerie           | 70        | 6     | Flanc, poursuite|
| Éléphant de guerre  | 150       | 12    | Terreur         |
| Trirème             | 80        | —     | Naval           |

CHOIX DE CONCEPTION — Trirème : le cahier indique une force « — » (pas de force
terrestre, c'est une unité navale). Pour qu'elle compte dans le calcul de
puissance (§10.2 : Puissance = Unités × Force + ...) on lui attribue une FORCE
NAVALE NOMINALE de 5. Cette valeur est utilisée partout où une « force » est
nécessaire (puissance, combats navals). Elle n'a pas de force terrestre.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# Force navale nominale attribuée à la trirème (cf. docstring ci-dessus).
FORCE_NAVALE_TRIREME = 5

# Forces de combat par type d'unité (cahier §8.1).
FORCES_UNITES: dict[str, int] = {
    "levee": 2,
    "infanterie_legere": 4,
    "legionnaire": 7,
    "hoplite": 7,
    "phalange": 8,
    "cavalerie": 6,
    "elephant": 12,
    "trireme": FORCE_NAVALE_TRIREME,  # force navale nominale (cf. docstring)
}

# Coûts en or par type d'unité (cahier §8.1).
COUTS_UNITES: dict[str, int] = {
    "levee": 10,
    "infanterie_legere": 25,
    "legionnaire": 50,
    "hoplite": 50,
    "phalange": 60,
    "cavalerie": 70,
    "elephant": 150,
    "trireme": 80,
}

# Coût en AUTRES ressources par effectif (le fer arme les soldats ; le bois, les navires).
COUT_RES_UNITES: dict[str, dict[str, int]] = {
    "infanterie_legere": {"fer": 2},
    "legionnaire": {"fer": 6},
    "hoplite": {"fer": 6},
    "phalange": {"fer": 6},
    "cavalerie": {"fer": 5},
    "elephant": {"fer": 12},
    "trireme": {"bois": 20},
    # levee : pas de fer (paysans armés de fortune)
}

# Coût en POPULATION par effectif recruté (l'armée se lève dans la population).
# Recruter consomme de l'or ET de la population (cf. demande v5).
COUT_POP_UNITES: dict[str, int] = {
    "levee": 1,
    "infanterie_legere": 1,
    "legionnaire": 2,
    "hoplite": 2,
    "phalange": 2,
    "cavalerie": 2,
    "elephant": 3,
    "trireme": 2,
}

# Types d'unités navales (n'ont pas de force terrestre).
UNITES_NAVALES: set[str] = {"trireme"}

# Tech requise pour débloquer certaines unités (cf. tech_tree / cahier §12).
TECH_REQUISE_UNITE: dict[str, str] = {
    "elephant": "tactique_elephants",
}


def force_unite(type_unite: str) -> int:
    """Retourne la force d'un type d'unité (0 si inconnu)."""
    return FORCES_UNITES.get(type_unite, 0)


@dataclass
class Unit:
    """Une unité militaire (regroupement d'effectifs du même type)."""

    id: str
    type: str
    territoire: str
    effectif: int = 1
    moral: int = 100

    @property
    def force_unitaire(self) -> int:
        """Force de combat d'un seul effectif de ce type."""
        return force_unite(self.type)

    @property
    def est_navale(self) -> bool:
        return self.type in UNITES_NAVALES

    def force_totale(self) -> int:
        """Force totale = force unitaire × effectif (utilisée pour la puissance)."""
        return self.force_unitaire * self.effectif

    @classmethod
    def from_dict(cls, d: dict) -> "Unit":
        return cls(
            id=d["id"],
            type=d["type"],
            territoire=d.get("territoire", ""),
            effectif=int(d.get("effectif", 1)),
            moral=int(d.get("moral", 100)),
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "territoire": self.territoire,
            "effectif": self.effectif,
            "moral": self.moral,
        }
