"""Punto de composicion: une servicios con adaptadores concretos (inyeccion)."""

from __future__ import annotations

from .adapters.elecdb import ElecdbDataSource
from .adapters.embedded import EmbeddedDataSource
from .adapters.mongo import MongoSessionRepository
from .adapters.typesafe import TypeSafeGateway
from .config import Settings
from .services.offer_service import OfferService
from .services.policies import IdentityPolicy, SystemicAgentsPolicy
from .services.scenario_assembler import ScenarioAssembler, ScenarioParams


class Container:
    """El unico sitio que decide "TypeSafe", "Mongo" y "elecdb"."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.offers = OfferService(
            TypeSafeGateway(settings.typesafe_api_key, settings.typesafe_url, settings.typesafe_timeout_ms),
            settings.typesafe_model,
            settings.typesafe_timeout_ms,
        )
        self.sessions = MongoSessionRepository(settings.mongo_url, settings.mongo_db, settings.mongo_collection)

    def embedded_assembler(self) -> ScenarioAssembler:
        return ScenarioAssembler(
            EmbeddedDataSource(),
            IdentityPolicy(),
            ScenarioParams(),
        )

    def elecdb_assembler(self) -> ScenarioAssembler:
        source = ElecdbDataSource(
            self.settings.elecdb_url,
            resources_limit=max(40, self.settings.subset_generators * 4),
            comercializadores_limit=self.settings.subset_comercializadores,
        )
        policy = SystemicAgentsPolicy(self.settings.subset_generators, self.settings.subset_comercializadores)
        return ScenarioAssembler(
            source,
            policy,
            ScenarioParams(
                id="real",
                name="MEM real (elecdb)",
                description="Recursos, agentes y series 2020-2025 leidos de la base de XM.",
            ),
        )
