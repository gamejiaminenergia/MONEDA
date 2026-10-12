"""Pruebas del escenario embebido."""

from __future__ import annotations

from app.domain.scenario import EMBEDDED_SCENARIO, PERIODS


def test_72_months_real() -> None:
    assert len(PERIODS) == 72
    assert PERIODS[0].month == "2020-01"
    assert PERIODS[-1].month == "2025-12"


def test_peak_matches_history() -> None:
    peak = max(PERIODS, key=lambda period: period.bolsa_ref)
    assert peak.month == "2024-10"


def test_scenario_has_both_roles() -> None:
    roles = {agent.role for agent in EMBEDDED_SCENARIO.agents}
    assert roles == {"generador", "comercializador"}
    assert EMBEDDED_SCENARIO.embalses
    assert EMBEDDED_SCENARIO.resources
