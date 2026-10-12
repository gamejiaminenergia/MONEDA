"""Prompt de BOLSA: el texto que recibe el modelo para un generador (SRP)."""

from __future__ import annotations

from .constants import PRICE_BANDS, QUANTITY_BANDS
from .hydrology import availability_factor
from .types import Agent, MarketState, Resource

TYPE_LABEL = {"hidro": "hidraulica", "termica": "termica", "solar": "solar", "eolica": "eolica"}


def _round(value: float) -> int:
    return round(value)


def _resource_line(state: MarketState, resource: Resource) -> str:
    available = _round(resource.capacity_gwh * availability_factor(resource, state.embalse_pct))
    return (
        f"{resource.name} ({TYPE_LABEL[resource.type]}, disponible {available} GWh este mes de "
        f"{_round(resource.capacity_gwh)} GWh, costo {_round(resource.cost)} COP/kWh, "
        f"ENFICC {_round(resource.enfi)} GWh, emisiones {_round(resource.emissions)} kg/MWh)"
    )


def build_generator_state(state: MarketState, agent: Agent) -> str:
    period = state.periods[state.month_index] if state.month_index < len(state.periods) else None
    month = period.month if period else "—"
    history = ", ".join(str(_round(value)) for value in state.price_history[-4:]) or "sin datos aun"
    marginal = "sin dato" if state.marginal_price is None else f"{_round(state.marginal_price)} COP/kWh"
    resource_by_id = {resource.id: resource for resource in state.resources}
    lines = [_resource_line(state, resource_by_id[rid]) for rid in agent.resources if rid in resource_by_id]
    portfolio = f"Tu cartera: {'; '.join(lines)}." if lines else "No tienes plantas."

    return (
        f"Mercado mayorista de energia (BOLSA), mes {month} ({state.month_index + 1} de {state.months}). "
        f"Demanda del mes: {_round(state.demand_gwh)} GWh. Embalse del sistema al {state.embalse_pct * 100:.0f}% "
        f"(aporta {period.aporte_pct if period else 1}x la media historica). "
        f"Precio de escasez del mes: {_round(state.escasez)} COP/kWh. "
        f"Precio de bolsa real del mes (referencia): {_round(period.bolsa_ref if period else 0)} COP/kWh. "
        f"Precio marginal del mes anterior: {marginal}. Ultimos precios: {history}. "
        f"El sistema tiene TIE para importar hasta {_round(state.tie_capacity_gwh)} GWh a {_round(state.tie_price)} COP/kWh. "
        f"Costo de carbono {_round(state.carbon_price)} COP/kg. "
        f"Eres {agent.name} (generador). {portfolio} Caja acumulada {_round(agent.cash)} millones de COP. "
        "El operador ordena las ofertas de barata a cara y despacha hasta cubrir la demanda; el precio de la ultima "
        "unidad lo reciben TODAS. Si no alcanza, entra el TIE; si aun falta, hay racionamiento. En un mes estresado, "
        "quien tenga ENFICC y no la entregue paga multa. Si tu caja queda muy negativa, sales del mercado. "
        "Ganar es terminar los 72 meses con al menos un generador solvente. "
        "Ofrece por encima del costo de cada planta o pierdes dinero; guarda agua si el embalse esta bajo; "
        "tu oferta mueve el precio que cobran todos."
    )


def build_generator_questions(agent: Agent, state: MarketState) -> dict[str, dict]:
    price_criteria = {band_id: f"{price} COP/kWh ({band_id})" for band_id, price in PRICE_BANDS}
    quantity_criteria = {band_id: f"{fraction:g} de tu disponibilidad" for band_id, fraction in QUANTITY_BANDS}
    resource_by_id = {resource.id: resource for resource in state.resources}
    questions: dict[str, dict] = {}
    for resource_id in agent.resources:
        resource = resource_by_id.get(resource_id)
        if resource is None:
            continue
        questions[f"{resource_id}__precio"] = {
            "type": "choice",
            "instructions": f"A que precio ofertas {resource.name} este mes? Elige la banda de precio.",
            "criteria": price_criteria,
        }
        questions[f"{resource_id}__cantidad"] = {
            "type": "choice",
            "instructions": f"Cuanta energia ofertas de {resource.name}, como fraccion de su disponibilidad?",
            "criteria": quantity_criteria,
        }
    return questions
