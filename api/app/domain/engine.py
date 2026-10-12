"""Motor mensual de BOLSA: crea el mercado y avanza un mes. Puro y testeable."""

from __future__ import annotations

from .constants import INSOLVENCY_CASH, RATIONING_COST
from .hydrology import availability_factor
from .market import Bid, dispatch
from .types import Event, MarketState, MonthRecord, Offer, Resource, Scenario


def create_market(scenario: Scenario) -> MarketState:
    """Un mercado fresco desde un escenario. Determinista."""
    resources = [resource.model_copy(deep=True) for resource in scenario.resources]
    embalses = [embalse.model_copy(deep=True) for embalse in scenario.embalses]
    agents = [agent.model_copy(deep=True) for agent in scenario.agents]
    periods = [period.model_copy(deep=True) for period in scenario.periods]

    resource_by_id = {resource.id: resource for resource in resources}
    for agent in agents:
        agent.cash = 0.0
        agent.alive = True
        agent.last_offers = {}
        if agent.role != "generador":
            continue
        for resource_id in agent.resources:
            resource = resource_by_id.get(resource_id)
            if resource is None:
                continue
            agent.last_offers[resource_id] = Offer(price=round(resource.cost * 1.4), quantity_gwh=resource.capacity_gwh)

    first = periods[0]
    return MarketState(
        month_index=0,
        months=len(periods),
        periods=periods,
        demand_gwh=first.demand_gwh,
        embalse_pct=first.embalse_pct,
        escasez=first.escasez,
        resources=resources,
        embalses=embalses,
        agents=agents,
        tie_capacity_gwh=scenario.tie_capacity_gwh,
        tie_price=scenario.tie_price,
        carbon_price=scenario.carbon_price,
        reconciliation_per_gwh=scenario.reconciliation_per_gwh,
        oef_penalty=scenario.oef_penalty,
    )


def available_energy(state: MarketState, resource: Resource) -> float:
    return resource.capacity_gwh * availability_factor(resource, state.embalse_pct)


def effective_quantity(state: MarketState, resource: Resource, offer: Offer) -> float:
    return max(0.0, min(offer.quantity_gwh, available_energy(state, resource)))


def _profit_millions(marginal_price: float, cost: float, quantity_gwh: float) -> float:
    """(marginal - costo) COP/kWh x GWh = millones de COP."""
    return (marginal_price - cost) * quantity_gwh


def step_market(state: MarketState, offers: dict[str, dict[str, Offer]]) -> list[Event]:
    """Avanza un mes: ofertas, despacho, liquidacion, OEF, racionamiento, fin."""
    if state.finished or state.month_index >= len(state.periods):
        return []

    period = state.periods[state.month_index]
    state.demand_gwh = period.demand_gwh
    state.embalse_pct = period.embalse_pct
    state.escasez = period.escasez

    resource_by_id = {resource.id: resource for resource in state.resources}
    agent_by_id = {agent.id: agent for agent in state.agents}

    bids: list[Bid] = []
    for agent in state.agents:
        if agent.role != "generador" or not agent.alive:
            continue
        for resource_id in agent.resources:
            resource = resource_by_id.get(resource_id)
            if resource is None:
                continue
            offer = (offers.get(agent.id) or {}).get(resource_id) or agent.last_offers.get(resource_id)
            if offer is None:
                offer = Offer(price=resource.cost, quantity_gwh=0.0)
            agent.last_offers[resource_id] = offer
            bids.append(
                Bid(
                    resource_id=resource_id,
                    agent_id=agent.id,
                    price=offer.price,
                    quantity_gwh=effective_quantity(state, resource, offer),
                )
            )

    outcome = dispatch(bids, state.demand_gwh, period.escasez, state.tie_capacity_gwh, state.tie_price)
    marginal = outcome.marginal_price
    state.marginal_price = marginal
    state.price_history.append(marginal)
    state.bolsa_history.append(period.bolsa_ref)

    emissions_ton = 0.0
    produced: dict[str, float] = {}
    for unit in outcome.dispatched:
        resource = resource_by_id.get(unit.resource_id)
        agent = agent_by_id.get(resource.owner) if resource else None
        if resource is None or agent is None:
            continue
        carbon = state.carbon_price * resource.emissions * unit.quantity_gwh / 1000.0
        agent.cash += _profit_millions(marginal, resource.cost, unit.quantity_gwh) - carbon
        emissions_ton += resource.emissions * unit.quantity_gwh
        produced[unit.resource_id] = produced.get(unit.resource_id, 0.0) + unit.quantity_gwh

    stressed = outcome.deficit_gwh > 0 or marginal >= period.escasez
    if stressed:
        for resource in state.resources:
            if resource.enfi <= 0:
                continue
            shortfall = max(0.0, resource.enfi - produced.get(resource.id, 0.0))
            if shortfall <= 0:
                continue
            agent = agent_by_id.get(resource.owner)
            if agent:
                agent.cash -= shortfall * state.oef_penalty

    weight = sum(a.demand_gwh for a in state.agents if a.role == "comercializador" and a.alive)
    comercializadores = [a for a in state.agents if a.role == "comercializador" and a.alive]
    recon_millions = state.reconciliation_per_gwh * state.demand_gwh
    ration_millions = RATIONING_COST * outcome.deficit_gwh
    for agent in comercializadores:
        share = agent.demand_gwh / weight if weight > 0 else 0.0
        demand = share * state.demand_gwh
        energy = demand * 1_000_000.0  # GWh -> kWh
        revenue = agent.tariff * energy
        contracted = agent.coverage * agent.contract_price * energy
        spot = (1.0 - agent.coverage) * marginal * energy
        overheads = (recon_millions + ration_millions) * share
        agent.cash += (revenue - contracted - spot) / 1_000_000.0 - overheads

    record = MonthRecord(
        month_index=state.month_index,
        month=period.month,
        demand_gwh=state.demand_gwh,
        marginal_price=marginal,
        deficit_gwh=outcome.deficit_gwh,
        imported_gwh=outcome.imported_gwh,
        emissions_ton=emissions_ton,
        dispatched=outcome.dispatched,
    )
    state.last_month = record
    events = [Event(type="mes", month_index=state.month_index, record=record)]

    if outcome.deficit_gwh > 0:
        state.deficit_months += 1
        state.score.deficit_months += 1
        events.append(Event(type="deficit", month_index=state.month_index, deficit_gwh=outcome.deficit_gwh))
    else:
        state.score.months_served += 1

    for agent in state.agents:
        if agent.alive and agent.cash < INSOLVENCY_CASH:
            agent.alive = False
            state.score.insolvencies += 1
            events.append(Event(type="insolvente", month_index=state.month_index, agent_id=agent.id, role=agent.role))

    if state.price_history:
        state.score.avg_marginal = sum(state.price_history) / len(state.price_history)
        state.score.avg_bolsa_ref = sum(state.bolsa_history) / len(state.bolsa_history)
    state.score.emissions_ton += emissions_ton

    any_generator = any(a.role == "generador" and a.alive for a in state.agents)
    state.month_index += 1
    if not any_generator:
        state.finished = True
        state.winner = "escasez"
        events.append(Event(type="fin", month_index=state.month_index, winner="escasez"))
        return events
    if state.month_index >= state.months:
        state.finished = True
        state.winner = "agentes"
        events.append(Event(type="fin", month_index=state.month_index, winner="agentes"))
        return events
    nxt = state.periods[state.month_index]
    state.demand_gwh = nxt.demand_gwh
    state.embalse_pct = nxt.embalse_pct
    state.escasez = nxt.escasez
    return events
