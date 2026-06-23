"""Modèles de données du backend (dataclasses).

Regroupe les modèles métier : unités militaires, villes, pays.
Les forces d'unités proviennent du cahier des charges §8.1.
"""

from .unit import (
    Unit,
    FORCES_UNITES,
    COUTS_UNITES,
    FORCE_NAVALE_TRIREME,
    force_unite,
)
from .city import City, BATIMENTS, COUT_BATIMENTS
from .country import Country

__all__ = [
    "Unit",
    "City",
    "Country",
    "FORCES_UNITES",
    "COUTS_UNITES",
    "FORCE_NAVALE_TRIREME",
    "force_unite",
    "BATIMENTS",
    "COUT_BATIMENTS",
]
