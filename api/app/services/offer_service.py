"""Caso de uso: decidir las ofertas de un mes. Depende del puerto ModelGateway."""

from __future__ import annotations

import asyncio
import logging
import time

from pydantic import BaseModel, Field

from ..domain.prompt import build_generator_questions, build_generator_state
from ..domain.types import Agent, MarketState, Offer
from ..errors import ModelError
from ..ports import ModelGateway
from .offer_mapper import map_answers_to_offers

log = logging.getLogger("bolsa.offer")


class Usage(BaseModel):
    input_tokens: int | None = None
    output_tokens: int | None = None


class DecisionResponse(BaseModel):
    model: str
    latency_ms: int
    offers: dict[str, dict[str, Offer]] = Field(default_factory=dict)
    usage: Usage = Field(default_factory=Usage)


class OfferService:
    def __init__(self, gateway: ModelGateway, default_model: str, timeout_ms: int) -> None:
        self._gateway = gateway
        self._default_model = default_model
        self._timeout_ms = timeout_ms

    async def decide(self, state: MarketState, model: str | None = None) -> DecisionResponse:
        started = time.monotonic()
        requested = (model or "").strip()
        use_model = requested if requested and requested != "auto" else self._default_model

        generators = [agent for agent in state.agents if agent.role == "generador" and agent.alive]
        if not generators:
            return DecisionResponse(model=use_model, latency_ms=0)

        results = await asyncio.gather(*(self._decide_for(use_model, state, agent) for agent in generators))

        offers: dict[str, dict[str, Offer]] = {}
        input_tokens = 0
        output_tokens = 0
        answered = 0
        for item in results:
            if item is None:
                continue
            agent_id, agent_offers, input_count, output_count = item
            offers[agent_id] = agent_offers
            answered += 1
            input_tokens += input_count or 0
            output_tokens += output_count or 0

        if answered == 0:
            raise ModelError("model-malformed", "Ningun generador obtuvo oferta del modelo")

        elapsed = int((time.monotonic() - started) * 1000)
        log.info("ofertas model=%s mes=%s generadores=%s in=%s ms=%s", use_model, state.month_index, answered, input_tokens, elapsed)
        return DecisionResponse(
            model=use_model,
            latency_ms=elapsed,
            offers=offers,
            usage=Usage(input_tokens=input_tokens, output_tokens=output_tokens),
        )

    async def _decide_for(
        self, model: str, state: MarketState, agent: Agent
    ) -> tuple[str, dict[str, Offer], int | None, int | None] | None:
        try:
            answer = await self._gateway.ask(
                model=model,
                state=build_generator_state(state, agent),
                questions=build_generator_questions(agent, state),
                timeout_ms=self._timeout_ms,
            )
            offers = map_answers_to_offers(state, agent, answer.answers)
            if not offers:
                raise ModelError("model-malformed", f"Sin ofertas para {agent.name}")
            return (agent.id, offers, answer.input_tokens, answer.output_tokens)
        except Exception as cause:  # un generador sin respuesta no detiene el mes
            log.warning("generador sin oferta id=%s error=%s", agent.id, cause)
            return None
