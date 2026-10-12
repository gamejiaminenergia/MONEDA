"""Pruebas del OfferService con un doble del ModelGateway (inversion de dependencias)."""

from __future__ import annotations

import asyncio

import pytest

from app.domain.engine import create_market
from app.domain.scenario import EMBEDDED_SCENARIO
from app.ports import ModelAnswer
from app.services.offer_service import OfferService


class FakeGateway:
    async def ask(self, *, model: str, state: str, questions: dict, timeout_ms: int) -> ModelAnswer:
        answers: dict[str, dict] = {}
        for key in questions:
            if key.endswith("__precio"):
                answers[key] = {"choice": "barata", "probabilities": {"barata": 1}}
            elif key.endswith("__cantidad"):
                answers[key] = {"choice": "100", "probabilities": {"100": 1}}
        return ModelAnswer(answered_model="fake", answers=answers, input_tokens=10, output_tokens=2)


class DeadGateway:
    async def ask(self, **_kwargs) -> ModelAnswer:
        raise RuntimeError("boom")


def test_offers_by_portfolio() -> None:
    market = create_market(EMBEDDED_SCENARIO)
    service = OfferService(FakeGateway(), "fake-model", 1000)
    result = asyncio.run(service.decide(market))
    assert result.model == "fake-model"
    assert result.offers["azul"]["guavio"].price == 100
    assert result.offers["azul"]["guavio"].quantity_gwh == 1400
    assert result.usage.input_tokens and result.usage.input_tokens > 0


def test_respects_requested_model() -> None:
    service = OfferService(FakeGateway(), "default", 1000)
    result = asyncio.run(service.decide(create_market(EMBEDDED_SCENARIO), model="otro"))
    assert result.model == "otro"


def test_all_fail_raises() -> None:
    service = OfferService(DeadGateway(), "m", 1000)
    with pytest.raises(Exception):
        asyncio.run(service.decide(create_market(EMBEDDED_SCENARIO)))
