"""Adaptador del `MarketDataSource` sobre el MEM real (PostgreSQL de XM, elecdb).

Lee recursos, agentes (con su cartera), embalses y las series mensuales 2020-2025.
Es un adaptador **best-effort**: las unidades y el mapeo fino se calibran despues;
el proposito es que el backend traiga el MEM real detras del mismo puerto que la
fuente embebida.
"""

from __future__ import annotations

import psycopg

from ..domain.types import Agent, Embalse, Period, Resource
from ..errors import DataSourceError
from ..ports import MarketData

PALETTE = ["#5b8dff", "#38ff9c", "#2ee6c5", "#ff5c5c", "#ff9f43", "#ffd93d", "#b06bff", "#ff5cf0", "#39d8ff", "#a6ff4d", "#9b6bff", "#c08a5a"]

TYPE_MAP = {"HIDRAULICA": "hidro", "TERMICA": "termica", "SOLAR": "solar", "EOLICA": "eolica", "COGENERADOR": "termica"}
FUEL_MAP = {"GAS": "gas", "CARBON": "carbon", "ACPM": "acpm", "COMBUSTOLEO": "acpm"}


class ElecdbDataSource:
    def __init__(
        self,
        dsn: str,
        *,
        from_date: str = "2020-01-01",
        to_date: str = "2026-01-01",
        resources_limit: int = 40,
        comercializadores_limit: int = 12,
    ) -> None:
        self._dsn = dsn
        self._from = from_date
        self._to = to_date
        self._resources_limit = resources_limit
        self._comercializadores_limit = comercializadores_limit

    async def load(self) -> MarketData:
        try:
            async with await psycopg.AsyncConnection.connect(self._dsn) as conn:
                periods = await self._periods(conn)
                resources = await self._resources(conn)
                embalses = await self._embalses(conn)
                comercializadores = await self._comercializadores(conn)
        except psycopg.Error as cause:
            raise DataSourceError(f"No se pudo leer elecdb: {cause}") from cause

        generators = self._generators(resources)
        return MarketData(
            resources=resources,
            agents=generators + comercializadores,
            embalses=embalses,
            periods=periods,
        )

    async def _periods(self, conn: psycopg.AsyncConnection) -> list[Period]:
        sql = """
            SELECT to_char(date_trunc('month', fecha), 'YYYY-MM') AS month,
                   SUM("DemaSIN") / 1e6 AS demand_gwh,
                   AVG("PPPrecBolsNaci") AS bolsa_ref,
                   AVG("PrecEsca") AS escasez,
                   AVG("PorcVoluUtilDiar") AS embalse_pct,
                   AVG("PorcApor") AS aporte_pct
            FROM fact_daily_sistema
            WHERE fecha >= %s AND fecha < %s
            GROUP BY 1 ORDER BY 1
        """
        async with conn.cursor() as cur:
            await cur.execute(sql, (self._from, self._to))
            rows = await cur.fetchall()
        return [
            Period(
                month=row[0],
                demand_gwh=float(row[1] or 0),
                bolsa_ref=float(row[2] or 0),
                escasez=float(row[3] or 0),
                embalse_pct=float(row[4] or 0),
                aporte_pct=float(row[5] or 0),
            )
            for row in rows
        ]

    async def _resources(self, conn: psycopg.AsyncConnection) -> list[Resource]:
        sql = """
            SELECT r.recurso_code, r.name, UPPER(COALESCE(r.type, '')) AS t, r.company_code,
                   UPPER(COALESCE(r.ener_source, '')) AS fuel,
                   AVG(dr."CapEfecNeta") AS cap_kw, AVG(dr."PrecOferIdeal") AS cost
            FROM dim_recurso r
            JOIN fact_daily_recurso dr ON dr.recurso_code = r.recurso_code
            WHERE dr.fecha >= %s AND dr.fecha < %s AND dr."CapEfecNeta" IS NOT NULL
            GROUP BY 1, 2, 3, 4, 5
            HAVING AVG(dr."CapEfecNeta") > 50000
            ORDER BY cap_kw DESC
            LIMIT %s
        """
        async with conn.cursor() as cur:
            await cur.execute(sql, (self._from, self._to, self._resources_limit))
            rows = await cur.fetchall()
        resources: list[Resource] = []
        for row in rows:
            rec_type = TYPE_MAP.get(row[2], "termica")
            capacity_gwh = float(row[5] or 0) * 720 / 1_000_000  # kW -> MW -> GWh/mes
            cost = float(row[6]) if row[6] is not None else (60 if rec_type == "hidro" else 320)
            resources.append(
                Resource(
                    id=row[0],
                    name=row[1],
                    type=rec_type,
                    owner=row[3] or "sin-dueno",
                    capacity_gwh=max(1.0, capacity_gwh),
                    cost=max(1.0, cost),
                    enfi=max(1.0, capacity_gwh * 0.5),
                    fuel=FUEL_MAP.get(row[4]),
                    embalse=None,
                    emissions=0.0 if rec_type != "termica" else 800.0,
                )
            )
        return resources

    def _generators(self, resources: list[Resource]) -> list[Agent]:
        by_owner: dict[str, list[str]] = {}
        for resource in resources:
            by_owner.setdefault(resource.owner, []).append(resource.id)
        agents: list[Agent] = []
        for index, (owner, resource_ids) in enumerate(by_owner.items()):
            agents.append(
                Agent(
                    id=owner,
                    name=owner,
                    color=PALETTE[index % len(PALETTE)],
                    role="generador",
                    resources=resource_ids,
                )
            )
        return agents

    async def _comercializadores(self, conn: psycopg.AsyncConnection) -> list[Agent]:
        sql = """
            SELECT a.agente_code, a.name, SUM(ha."DemaCome") AS dema
            FROM fact_hourly_agente ha
            JOIN dim_agente a ON a.agente_code = ha.agente_code
            WHERE ha.fecha_hora >= %s AND ha.fecha_hora < %s
              AND a.activity = 'COMERCIALIZACIÓN' AND ha."DemaCome" IS NOT NULL
            GROUP BY 1, 2 ORDER BY dema DESC LIMIT %s
        """
        async with conn.cursor() as cur:
            await cur.execute(sql, (self._from, self._to, self._comercializadores_limit))
            rows = await cur.fetchall()
        total = sum(float(row[2] or 0) for row in rows) or 1.0
        agents: list[Agent] = []
        for index, row in enumerate(rows):
            weight = float(row[2] or 0) / total * 1000.0
            agents.append(
                Agent(
                    id=row[0],
                    name=row[1],
                    color=PALETTE[(index + 6) % len(PALETTE)],
                    role="comercializador",
                    demand_gwh=weight,
                    coverage=0.75,
                    contract_price=250,
                    tariff=340,
                )
            )
        return agents

    async def _embalses(self, conn: psycopg.AsyncConnection) -> list[Embalse]:
        sql = "SELECT embalse_code, name, hydro_region FROM dim_embalse ORDER BY name"
        async with conn.cursor() as cur:
            await cur.execute(sql)
            rows = await cur.fetchall()
        return [Embalse(id=row[0], name=row[1], region=row[2] or "—", river=row[1]) for row in rows]
