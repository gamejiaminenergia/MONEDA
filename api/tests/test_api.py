"""Pruebas de la API (controladores) con TestClient."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.domain.engine import create_market
from app.domain.scenario import EMBEDDED_SCENARIO
from app.main import create_app
from app.ports import ModelAnswer
from app.services.offer_service import OfferService


class FakeGateway:
    async def ask(self, *, model: str, state: str, questions: dict, timeout_ms: int) -> ModelAnswer:
        answers: dict[str, dict] = {}
        for key in questions:
            if key.endswith("__precio"):
                answers[key] = {"choice": "barata"}
            elif key.endswith("__cantidad"):
                answers[key] = {"choice": "100"}
        return ModelAnswer(answered_model="fake", answers=answers, input_tokens=10, output_tokens=2)


def test_health() -> None:
    client = TestClient(create_app())
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_scenario_embedded() -> None:
    client = TestClient(create_app())
    response = client.get("/scenario")
    assert response.status_code == 200
    assert len(response.json()["periods"]) == 72


def test_decision() -> None:
    app = create_app()
    app.state.container.offers = OfferService(FakeGateway(), "fake", 1000)
    client = TestClient(app)
    market = create_market(EMBEDDED_SCENARIO).model_dump(mode="json")
    response = client.post("/decision", json={"market": market})
    assert response.status_code == 200
    body = response.json()
    assert body["offers"]["azul"]["guavio"]["price"] == 100


def test_session_save_and_list() -> None:
    app = create_app()
    client = TestClient(app)
    response = client.post(
        "/session",
        json={"session_id": "t1", "model": "fake", "outcome": "agentes", "months": [{"month_index": 0}]},
    )
    assert response.status_code == 200
    # Sin MONGO_URL no se guarda, pero la ruta responde.
    assert "stored" in response.json()
