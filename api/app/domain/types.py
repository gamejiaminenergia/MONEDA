"""Tipos del dominio de BOLSA (MEM en miniatura, mensual 2020-2025).

Modelos pydantic mutables: el motor los modifica en el `step`. Sirven a la vez
de contrato de la API (se serializan solos).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ResourceType = Literal["hidro", "termica", "solar", "eolica"]
AgentRole = Literal["generador", "comercializador"]
Fuel = Literal["gas", "carbon", "acpm"]
Winner = Literal["agentes", "escasez"]


class Period(BaseModel):
    """Un mes del horizonte, con las series reales de XM."""

    month: str
    demand_gwh: float
    bolsa_ref: float
    escasez: float
    embalse_pct: float
    aporte_pct: float


class Resource(BaseModel):
    """Una planta (espeja dim_recurso + fact_daily_recurso)."""

    id: str
    name: str
    type: ResourceType
    owner: str
    capacity_gwh: float
    cost: float
    enfi: float
    fuel: Fuel | None = None
    embalse: str | None = None
    emissions: float = 0.0


class Embalse(BaseModel):
    id: str
    name: str
    region: str
    river: str


class Offer(BaseModel):
    price: float
    quantity_gwh: float


class Agent(BaseModel):
    id: str
    name: str
    color: str
    role: AgentRole
    cash: float = 0.0
    alive: bool = True
    resources: list[str] = Field(default_factory=list)
    last_offers: dict[str, Offer] = Field(default_factory=dict)
    demand_gwh: float = 0.0
    coverage: float = 0.0
    contract_price: float = 0.0
    tariff: float = 0.0


class DispatchedUnit(BaseModel):
    resource_id: str
    agent_id: str
    price: float
    quantity_gwh: float


class MonthRecord(BaseModel):
    month_index: int
    month: str
    demand_gwh: float
    marginal_price: float
    deficit_gwh: float
    imported_gwh: float
    emissions_ton: float
    dispatched: list[DispatchedUnit] = Field(default_factory=list)


class Score(BaseModel):
    months_served: int = 0
    deficit_months: int = 0
    avg_marginal: float = 0.0
    avg_bolsa_ref: float = 0.0
    emissions_ton: float = 0.0
    insolvencies: int = 0


class MarketState(BaseModel):
    month_index: int
    months: int
    periods: list[Period]
    demand_gwh: float
    embalse_pct: float
    escasez: float
    marginal_price: float | None = None
    price_history: list[float] = Field(default_factory=list)
    bolsa_history: list[float] = Field(default_factory=list)
    resources: list[Resource]
    embalses: list[Embalse] = Field(default_factory=list)
    agents: list[Agent]
    tie_capacity_gwh: float = 0.0
    tie_price: float = 0.0
    carbon_price: float = 0.0
    reconciliation_per_gwh: float = 0.0
    oef_penalty: float = 0.0
    deficit_months: int = 0
    last_month: MonthRecord | None = None
    winner: Winner | None = None
    finished: bool = False
    score: Score = Field(default_factory=Score)


class Scenario(BaseModel):
    id: str
    name: str
    description: str
    tie_capacity_gwh: float
    tie_price: float
    carbon_price: float
    reconciliation_per_gwh: float
    oef_penalty: float
    periods: list[Period]
    resources: list[Resource]
    embalses: list[Embalse] = Field(default_factory=list)
    agents: list[Agent]


class Event(BaseModel):
    """Evento de un mes (despacho, racionamiento, insolvencia o fin)."""

    type: Literal["mes", "deficit", "insolvente", "fin"]
    month_index: int
    record: MonthRecord | None = None
    deficit_gwh: float | None = None
    agent_id: str | None = None
    role: AgentRole | None = None
    winner: Winner | None = None
