"""Adaptador del `SessionRepository` sobre MongoDB (pymongo)."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from pymongo import MongoClient


class MongoSessionRepository:
    def __init__(self, url: str, db_name: str, collection: str) -> None:
        self._collection_name = collection
        self._client = MongoClient(url, serverSelectionTimeoutMS=3000) if url else None
        self._db = self._client[db_name] if self._client is not None else None

    @property
    def configured(self) -> bool:
        return self._db is not None

    async def save(self, record: dict) -> str | None:
        if self._db is None:
            return None
        document = {**record, "at": datetime.now(timezone.utc).isoformat()}

        def _insert() -> str:
            return str(self._db[self._collection_name].insert_one(document).inserted_id)

        try:
            return await asyncio.to_thread(_insert)
        except Exception:
            return None

    async def list(self, limit: int) -> list[dict]:
        if self._db is None:
            return []

        def _find() -> list[dict]:
            return list(self._db[self._collection_name].find().sort("at", -1).limit(limit))

        try:
            docs = await asyncio.to_thread(_find)
        except Exception:
            return []
        result = []
        for doc in docs:
            item = dict(doc)
            item["id"] = str(item.pop("_id"))
            result.append(item)
        return result
