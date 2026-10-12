"""Mapea respuestas crudas del modelo a ofertas concretas (SRP)."""

from __future__ import annotations

from ..domain.constants import fraction_of_band, is_price_band, is_quantity_band, price_of_band
from ..domain.types import Agent, MarketState, Offer, Resource


def _normalize_band(answer: dict, is_valid, fallback: str) -> str:
    choice = answer.get("choice")
    if isinstance(choice, str) and is_valid(choice):
        return choice
    best: str | None = None
    best_probability = -1.0
    for key, value in (answer.get("probabilities") or {}).items():
        if not is_valid(key):
            continue
        try:
            probability = float(value)
        except (TypeError, ValueError):
            continue
        if probability > best_probability:
            best_probability = probability
            best = key
    return best or fallback


def _offer_from_bands(resource: Resource, price_band: str, quantity_band: str) -> Offer:
    quantity = fraction_of_band(quantity_band) * resource.capacity_gwh
    return Offer(price=price_of_band(price_band), quantity_gwh=max(0.0, min(resource.capacity_gwh, quantity)))


def map_answers_to_offers(state: MarketState, agent: Agent, answers: dict[str, dict]) -> dict[str, Offer]:
    resource_by_id = {resource.id: resource for resource in state.resources}
    offers: dict[str, Offer] = {}
    for resource_id in agent.resources:
        resource = resource_by_id.get(resource_id)
        price_answer = answers.get(f"{resource_id}__precio")
        quantity_answer = answers.get(f"{resource_id}__cantidad")
        if resource is None or not price_answer or not quantity_answer:
            continue
        offers[resource_id] = _offer_from_bands(
            resource,
            _normalize_band(price_answer, is_price_band, "media"),
            _normalize_band(quantity_answer, is_quantity_band, "100"),
        )
    return offers
