"""Pruebas del motor mensual (dispatch, liquidacion, deficit, fin)."""

from __future__ import annotations

from app.domain.engine import create_market, effective_quantity, step_market
from app.domain.market import Bid, dispatch
from app.domain.types import Agent, Embalse, Offer, Period, Resource, Scenario


def _resource(**overrides) -> Resource:
    base = dict(
        id="h",
        name="Hidro",
        type="hidro",
        owner="azul",
        capacity_gwh=1000.0,
        cost=50.0,
        enfi=0.0,
        embalse="e",
    )
    base.update(overrides)
    return Resource(**base)


def _period(month: str) -> Period:
    return Period(month=month, demand_gwh=100.0, bolsa_ref=200.0, escasez=800.0, embalse_pct=1.0, aporte_pct=1.0)


def _scenario(**overrides) -> Scenario:
    base = dict(
        id="test",
        name="test",
        description="",
        tie_capacity_gwh=0.0,
        tie_price=750.0,
        carbon_price=0.0,
        reconciliation_per_gwh=0.0,
        oef_penalty=120.0,
        periods=[_period("2020-01"), _period("2020-02")],
        resources=[_resource()],
        embalses=[Embalse(id="e", name="E", region="r", river="rio")],
        agents=[
            Agent(id="azul", name="Gen", color="#000", role="generador", resources=["h"]),
            Agent(id="cian", name="Com", color="#111", role="comercializador", demand_gwh=100.0, coverage=1.0, contract_price=50.0, tariff=100.0),
        ],
    )
    base.update(overrides)
    return Scenario(**base)


def test_dispatch_merit_and_marginal() -> None:
    result = dispatch(
        [
            Bid(resource_id="a", agent_id="azul", price=100, quantity_gwh=100),
            Bid(resource_id="b", agent_id="rojo", price=300, quantity_gwh=100),
        ],
        150,
        900,
        0,
        0,
    )
    assert result.marginal_price == 300
    assert result.served_gwh == 150
    assert next(u for u in result.dispatched if u.resource_id == "b").quantity_gwh == 50


def test_dispatch_tie_covers_deficit() -> None:
    result = dispatch([Bid(resource_id="a", agent_id="azul", price=100, quantity_gwh=100)], 200, 900, 60, 760)
    assert result.imported_gwh == 60
    assert result.deficit_gwh == 40
    assert result.marginal_price == 900


def test_effective_quantity_follows_embalse() -> None:
    market = create_market(_scenario())
    market.embalse_pct = 0.3
    assert effective_quantity(market, market.resources[0], Offer(price=100, quantity_gwh=1000)) == 300


def test_step_liquidates_and_scores() -> None:
    market = create_market(_scenario())
    step_market(market, {"azul": {"h": Offer(price=420, quantity_gwh=1000)}})
    gen = next(a for a in market.agents if a.id == "azul")
    com = next(a for a in market.agents if a.id == "cian")
    assert round(gen.cash) == 37000  # (420 - 50) * 100 GWh
    assert round(com.cash) == 5000  # (100 - 50) * 100 GWh
    assert market.marginal_price == 420
    assert market.score.months_served == 1


def test_deficit_penalizes_but_continues() -> None:
    market = create_market(_scenario(resources=[_resource(capacity_gwh=50)]))
    events = step_market(market, {"azul": {"h": Offer(price=100, quantity_gwh=50)}})
    assert market.deficit_months == 1
    assert any(event.type == "deficit" for event in events)
    assert market.finished is False


def test_oef_penalty_when_stressed() -> None:
    market = create_market(_scenario(resources=[_resource(enfi=200)]))
    market.periods[0].escasez = 400
    market.escasez = 400
    step_market(market, {"azul": {"h": Offer(price=420, quantity_gwh=1000)}})
    gen = next(a for a in market.agents if a.id == "azul")
    # bruto (420-50)*100 = 37000; multa (200-100)*120 = 12000 -> 25000
    assert round(gen.cash) == 25000


def test_agents_win_at_horizon() -> None:
    market = create_market(_scenario())
    step_market(market, {"azul": {"h": Offer(price=420, quantity_gwh=1000)}})
    events = step_market(market, {"azul": {"h": Offer(price=420, quantity_gwh=1000)}})
    assert market.winner == "agentes"
    assert any(event.type == "fin" and event.winner == "agentes" for event in events)
