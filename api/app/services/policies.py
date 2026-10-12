"""Politicas de subconjunto (Strategy, OCP).

`jev-gateway` (confianza 0.95) sugirio seleccionar por **agente sistemico**
combinado con cuota por tecnologia; aqui vive la implementacion, intercambiable
detras del puerto `SubsetPolicy`.
"""

from __future__ import annotations

from ..ports import MarketData


class IdentityPolicy:
    """No reduce nada: lo que trae la fuente ya es jugable (fuente embebida)."""

    def select(self, data: MarketData) -> MarketData:
        return data


class SystemicAgentsPolicy:
    """Top `generators` por capacidad total + top `comercializadores` por demanda."""

    def __init__(self, generators: int = 12, comercializadores: int = 10) -> None:
        self._generators = generators
        self._comercializadores = comercializadores

    def select(self, data: MarketData) -> MarketData:
        capacity_by_owner: dict[str, float] = {}
        for resource in data.resources:
            capacity_by_owner[resource.owner] = capacity_by_owner.get(resource.owner, 0.0) + resource.capacity_gwh
        owners = {
            owner
            for owner, _ in sorted(capacity_by_owner.items(), key=lambda item: item[1], reverse=True)[: self._generators]
        }
        resources = [resource for resource in data.resources if resource.owner in owners]
        generators = [agent for agent in data.agents if agent.role == "generador" and agent.id in owners]
        comercializadores = sorted(
            (agent for agent in data.agents if agent.role == "comercializador"),
            key=lambda agent: agent.demand_gwh,
            reverse=True,
        )[: self._comercializadores]
        return MarketData(
            resources=resources,
            agents=generators + comercializadores,
            embalses=data.embalses,
            periods=data.periods,
        )
