"""Errores de dominio del backend."""

from __future__ import annotations


class ModelError(Exception):
    """Fallo del proveedor del modelo, con codigo estable para la API."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class DataSourceError(Exception):
    """Fallo al leer el MEM (elecdb) o al armar el escenario."""
