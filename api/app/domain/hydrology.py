"""Hidrologia mensual: el clima es exogeno (dato real) y fija la disponibilidad."""

from __future__ import annotations

from .constants import SOLAR_CF, WIND_CF
from .types import Resource


def hydro_factor(embalse_pct: float) -> float:
    """Una hidro solo puede usar la fraccion de su capacidad que dice el embalse."""
    return min(1.0, max(0.05, embalse_pct))


def availability_factor(resource: Resource, embalse_pct: float) -> float:
    if resource.type == "hidro":
        return hydro_factor(embalse_pct)
    if resource.type == "solar":
        return SOLAR_CF
    if resource.type == "eolica":
        return WIND_CF
    return 1.0
