"""Orden de merito + precio marginal + valvula TIE. Puro (SRP)."""

from __future__ import annotations

from dataclasses import dataclass, field

from .types import DispatchedUnit


@dataclass
class Bid:
    resource_id: str
    agent_id: str
    price: float
    quantity_gwh: float


@dataclass
class DispatchOutcome:
    dispatched: list[DispatchedUnit] = field(default_factory=list)
    marginal_price: float = 0.0
    served_gwh: float = 0.0
    imported_gwh: float = 0.0
    deficit_gwh: float = 0.0


def dispatch(
    bids: list[Bid],
    demand_gwh: float,
    scarcity_price: float,
    tie_capacity_gwh: float,
    tie_price: float,
) -> DispatchOutcome:
    """Apila de barata a cara, despacha hasta cubrir la demanda y fija el marginal.

    Si hay deficit, primero importa por TIE; si aun falta, el precio salta al de
    escasez y queda racionamiento.
    """
    ordered = sorted((bid for bid in bids if bid.quantity_gwh > 0), key=lambda bid: bid.price)
    dispatched: list[DispatchedUnit] = []
    served = 0.0
    marginal = 0.0
    for bid in ordered:
        if served >= demand_gwh:
            break
        quantity = min(bid.quantity_gwh, demand_gwh - served)
        if quantity <= 0:
            continue
        dispatched.append(
            DispatchedUnit(resource_id=bid.resource_id, agent_id=bid.agent_id, price=bid.price, quantity_gwh=quantity)
        )
        served += quantity
        marginal = bid.price

    deficit = max(0.0, demand_gwh - served)
    imported = 0.0
    if deficit > 0 and tie_capacity_gwh > 0:
        imported = min(deficit, tie_capacity_gwh)
        deficit -= imported
        marginal = max(marginal, tie_price)
    if deficit > 0:
        marginal = scarcity_price

    return DispatchOutcome(
        dispatched=dispatched,
        marginal_price=marginal,
        served_gwh=served,
        imported_gwh=imported,
        deficit_gwh=deficit,
    )
