"""Rutas (controladores) de la API de BOLSA. Validan, delegan y responden."""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from ..domain.types import MarketState
from ..services.offer_service import DecisionResponse

router = APIRouter()


class DecisionRequest(BaseModel):
    market: MarketState
    model: str | None = None


class SessionRequest(BaseModel):
    session_id: str
    model: str
    scenario: str | None = None
    outcome: str
    months: list = Field(default_factory=list)
    periods: list | None = None
    resources: list = Field(default_factory=list)
    agents: list = Field(default_factory=list)
    embalses: list = Field(default_factory=list)
    score: dict | None = None
    log: list[str] = Field(default_factory=list)


def _container(request: Request):
    return request.app.state.container


@router.get("/health")
async def health(request: Request) -> dict:
    container = _container(request)
    return {
        "status": "ok",
        "typesafe_configured": bool(container.settings.typesafe_api_key),
        "mongo_configured": container.sessions.configured,
        "elecdb_url": container.settings.elecdb_url,
    }


@router.get("/scenario")
async def get_scenario(request: Request, source: str = "embedded"):
    """Arma un escenario jugable. `source=elecdb` lo construye desde el MEM real."""
    container = _container(request)
    assembler = container.elecdb_assembler() if source == "elecdb" else container.embedded_assembler()
    return await assembler.assemble()


@router.post("/decision", response_model=DecisionResponse)
async def post_decision(request: Request, body: DecisionRequest) -> DecisionResponse:
    container = _container(request)
    return await container.offers.decide(body.market, body.model)


@router.post("/session")
async def post_session(request: Request, body: SessionRequest) -> dict:
    container = _container(request)
    stored_id = await container.sessions.save(body.model_dump())
    if stored_id is None:
        return {"stored": False, "reason": "mongo-no-configurado"}
    return {"stored": True, "id": stored_id}


@router.get("/session")
async def list_sessions(request: Request, limit: int = 50) -> dict:
    container = _container(request)
    bounded = min(max(limit, 1), 200)
    return {"sessions": await container.sessions.list(bounded)}
