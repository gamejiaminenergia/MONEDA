"""Adaptador embebido: los 72 meses reales ya cargados. Corre sin PostgreSQL."""

from __future__ import annotations

from ..domain.scenario import AGENTS, EMBALSES, PERIODS, RESOURCES
from ..ports import MarketData


class EmbeddedDataSource:
    """`MarketDataSource` por defecto (doble de prueba y modo sin DB)."""

    async def load(self) -> MarketData:
        return MarketData(
            resources=[resource.model_copy(deep=True) for resource in RESOURCES],
            agents=[agent.model_copy(deep=True) for agent in AGENTS],
            embalses=[embalse.model_copy(deep=True) for embalse in EMBALSES],
            periods=[period.model_copy(deep=True) for period in PERIODS],
        )
