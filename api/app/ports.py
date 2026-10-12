"""Puertos del backend (Dependency Inversion).

Los servicios dependen de estas interfaces (Protocol), no de TypeSafe, Mongo ni
PostgreSQL. Los adaptadores concretos viven en `app/adapters/` y se inyectan en
el punto de composicion (`app/container.py` / `main.py`).
"""

from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel, Field

from .domain.types import Agent, Embalse, Period, Resource


class ModelAnswer(BaseModel):
    answered_model: str | None = None
    answers: dict[str, dict] = Field(default_factory=dict)
    input_tokens: int | None = None
    output_tokens: int | None = None


class ModelGateway(Protocol):
    """Puerto hacia el proveedor del modelo (System One)."""

    async def ask(self, *, model: str, state: str, questions: dict, timeout_ms: int) -> ModelAnswer: ...


class SessionRepository(Protocol):
    """Puerto de persistencia del historico."""

    async def save(self, record: dict) -> str | None: ...

    async def list(self, limit: int) -> list[dict]: ...


class MarketData(BaseModel):
    """El MEM crudo de una fuente (embebida o elecdb), antes de subconjunto."""

    resources: list[Resource] = Field(default_factory=list)
    agents: list[Agent] = Field(default_factory=list)
    embalses: list[Embalse] = Field(default_factory=list)
    periods: list[Period] = Field(default_factory=list)


class MarketDataSource(Protocol):
    """Puerto de ingesta del MEM."""

    async def load(self) -> MarketData: ...


class SubsetPolicy(Protocol):
    """Politica de subconjunto (Strategy): reduce el MEM a lo jugable."""

    def select(self, data: MarketData) -> MarketData: ...
