"""Adaptador del `ModelGateway` sobre TypeSafe (System One), con httpx."""

from __future__ import annotations

import httpx

from ..errors import ModelError
from ..ports import ModelAnswer


class TypeSafeGateway:
    def __init__(self, api_key: str, base_url: str, default_timeout_ms: int = 30000) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._default_timeout_ms = default_timeout_ms

    async def ask(self, *, model: str, state: str, questions: dict, timeout_ms: int | None = None) -> ModelAnswer:
        if not self._api_key:
            raise ModelError("model-not-configured", "TypeSafe no esta configurado: falta TYPESAFE_API_KEY")
        body = {"model": model, "state": state, "questions": questions}
        headers = {"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"}
        timeout = (timeout_ms or self._default_timeout_ms) / 1000.0
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(f"{self._base_url}/v1/systemone", json=body, headers=headers)
        except httpx.TimeoutException as cause:
            raise ModelError("model-timeout", f"TypeSafe no respondio en {timeout_ms or self._default_timeout_ms} ms") from cause
        except httpx.HTTPError as cause:
            raise ModelError("model-unreachable", f"No se pudo contactar TypeSafe en {self._base_url}") from cause

        if response.status_code in (401, 403):
            raise ModelError("model-unauthorized", f"TypeSafe rechazo la API key ({response.status_code})")
        if response.status_code >= 400:
            raise ModelError("model-http", f"TypeSafe respondio {response.status_code}")
        try:
            data = response.json()
        except ValueError as cause:
            raise ModelError("model-malformed", "La respuesta de TypeSafe no era JSON") from cause

        usage = data.get("usage") or {}
        answers = data.get("answers")
        if not isinstance(answers, dict):
            raise ModelError("model-malformed", "La respuesta de TypeSafe no cumple el contrato esperado")
        return ModelAnswer(
            answered_model=data.get("model"),
            answers=answers,
            input_tokens=usage.get("input_tokens"),
            output_tokens=usage.get("output_tokens"),
        )
