"""Caso de uso: armar un `Scenario` jugable desde el MEM y una politica."""

from __future__ import annotations

from dataclasses import dataclass

from ..domain.types import Scenario
from ..ports import MarketDataSource, SubsetPolicy


@dataclass
class ScenarioParams:
    id: str = "historico"
    name: str = "Historico (2020-2025, dato real)"
    description: str = "Setenta y dos meses con las series reales de XM."
    tie_capacity_gwh: float = 1200
    tie_price: float = 750
    carbon_price: float = 25
    reconciliation_per_gwh: float = 6
    oef_penalty: float = 120


class ScenarioAssembler:
    def __init__(self, source: MarketDataSource, policy: SubsetPolicy, params: ScenarioParams) -> None:
        self._source = source
        self._policy = policy
        self._params = params

    async def assemble(self) -> Scenario:
        data = await self._source.load()
        data = self._policy.select(data)
        params = self._params
        return Scenario(
            id=params.id,
            name=params.name,
            description=params.description,
            tie_capacity_gwh=params.tie_capacity_gwh,
            tie_price=params.tie_price,
            carbon_price=params.carbon_price,
            reconciliation_per_gwh=params.reconciliation_per_gwh,
            oef_penalty=params.oef_penalty,
            periods=data.periods,
            resources=data.resources,
            embalses=data.embalses,
            agents=data.agents,
        )
