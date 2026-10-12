# Plan: el MEM completo en un backend FastAPI (`api/`)

Estado: **ejecutado**.
Fecha: 2026-10-11.
Padre: `PLAN-BOLSA-MENSUAL.md`.

## 1. Objetivo

Sacar el backend de BOLSA a un servicio propio en **Python/FastAPI** (`api/`),
porque el proyecto va a crecer, y que ingiera el **MEM real** (`elecdb`): recursos,
agentes con cartera, embalses, ríos, combustibles, áreas, enlaces, mercados y CIIU,
con granularidad **mensual 2020-2025**. El frontend se conecta despues.

## 2. Inventario real del MEM (skill `elecdb`)

| Objeto | Cantidad |
| --- | --- |
| Recursos | 2.618 |
| Agentes | 706 (352 comercializadores, 239 generadores) |
| Cartera (N:N) | 442 |
| Embalses | 25 (7 regiones) |
| Ríos | 44 |
| Combustibles | 49 |
| Áreas / subáreas | 6 / 19 |
| Enlaces | 4 (Ecuador, Corozo, Cuatricentenario) |
| Mercados / CIIU | 32 / 381 |

## 3. Decisiones

1. **Servicio aparte en `api/` (FastAPI)**: la logica de negocio, los datos reales
   y el proveedor de modelo viven en Python. El frontend queda como cliente.
2. **Ingesta viva con `psycopg`** detras del puerto `MarketDataSource`; la fuente
   **embebida** (72 meses reales) es el respaldo para correr sin DB y para tests.
3. **Subconjunto por agente sistemico + cuota por tecnologia** (lo eligio
   `jev-gateway`, 0.95).
4. **Parametros regulatorios** (`creg-ai-client`): precio de escasez mensual
   (Resolucion CREG 140 de 2017, activa las OEF) y reconciliaciones = costos de
   restriccion.

## 4. Arquitectura (MVC + SOLID)

Servicio FastAPI con puertos e inyeccion de dependencias:

- **Modelo**: `app/domain/*` (motor mensual puro; puerto del motor TS).
- **Puertos**: `app/ports.py` (`ModelGateway`, `SessionRepository`,
  `MarketDataSource`, `SubsetPolicy`).
- **Adaptadores**: `app/adapters/{typesafe,mongo,embedded,elecdb}.py`.
- **Servicios**: `app/services/{offer_service,scenario_assembler,offer_mapper,policies}.py`.
- **Controladores**: `app/api/routes.py`.
- **Composicion**: `app/container.py`.

## 5. Fases (ejecutadas)

| Fase | Que | Estado |
| --- | --- | --- |
| 0 | Puertos + fuente embebida | hecho: corre sin DB |
| 1 | Adaptador `elecdb` (psycopg) | hecho: lee el MEM real |
| 2 | `ScenarioAssembler` + `SubsetPolicy` | hecho: subconjunto jugable |
| 3 | Modelo enriquecido (embalses, combustibles, TIE) | parcial: embalses/TIE/combustibles en el modelo |
| 4 | Motor mensual | hecho: despacho, OEF, racionamiento, fin |
| 5 | API + persistencia | hecho: `/scenario`, `/decision`, `/session` |
| 6 | Pruebas | hecho: 17 pruebas pytest con dobles |

## 6. Verificacion

- `GET /scenario?source=elecdb` -> 42 recursos, 22 agentes (12 gen + 10 com),
  25 embalses, 72 meses, en <1 s.
- `POST /decision` -> ofertas reales de Jev por cartera.
- `.venv/bin/pytest -q` -> 17 pruebas, sin TypeSafe ni DB.

## 7. Pendiente

- Calibrar unidades de `elecdb` (kW/kg) y completar zonas (áreas/subáreas) y CIIU
  como mecanica.
- Migrar el frontend a este backend (los puertos `DecisionGateway`/`HistoryGateway`
  ya aceptan otro transporte) y retirar el backend TS de BOLSA.
