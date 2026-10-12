"""Configuracion del backend, desde variables de entorno (pydantic-settings)."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # TypeSafe (System One)
    typesafe_api_key: str = ""
    typesafe_url: str = "https://api.typesafe.ai"
    typesafe_model: str = "jev-latest"
    typesafe_timeout_ms: int = 30000

    # MongoDB (historico)
    mongo_url: str = ""
    mongo_db: str = "nimble"
    mongo_collection: str = "sessions"

    # PostgreSQL de XM (elecdb)
    elecdb_url: str = "postgresql://postgres:postgres@localhost:5432/postgres"

    # Subconjunto del MEM
    subset_generators: int = 12
    subset_comercializadores: int = 10

    # CORS
    cors_origins: str = "*"


def get_settings() -> Settings:
    return Settings()
