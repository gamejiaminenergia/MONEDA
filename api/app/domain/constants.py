"""Constantes del dominio de BOLSA (mensual)."""

from __future__ import annotations

INSOLVENCY_CASH = -400.0
RATIONING_COST = 1200.0
SOLAR_CF = 0.25
WIND_CF = 0.4

PRICE_BANDS: list[tuple[str, int]] = [
    ("barata", 100),
    ("media", 230),
    ("cara", 420),
    ("escasez", 780),
]

QUANTITY_BANDS: list[tuple[str, float]] = [
    ("25", 0.25),
    ("50", 0.5),
    ("75", 0.75),
    ("100", 1.0),
]

_PRICE_BY_ID = {band_id: price for band_id, price in PRICE_BANDS}
_FRACTION_BY_ID = {band_id: fraction for band_id, fraction in QUANTITY_BANDS}


def price_of_band(band_id: str) -> int:
    return _PRICE_BY_ID.get(band_id, 100)


def fraction_of_band(band_id: str) -> float:
    return _FRACTION_BY_ID.get(band_id, 1.0)


def is_price_band(value: str) -> bool:
    return value in _PRICE_BY_ID


def is_quantity_band(value: str) -> bool:
    return value in _FRACTION_BY_ID
