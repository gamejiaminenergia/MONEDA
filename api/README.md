# BOLSA API — backend del MEM (FastAPI)

Backend independiente del frontend (Next.js). Ingiera el Mercado de Energia
Mayorista real (skill `elecdb`), arma un escenario jugable mensual (2020-2025), lo
juega con los agentes y guarda el historico. Es un servicio **FastAPI** para que
esto crezca: logica de negocio, datos reales y proveedor de modelo viven aqui.

## Arrancar

```bash
cd api
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env          # pon TYPESAFE_API_KEY, MONGO_URL y ELECDB_URL
.venv/bin/uvicorn app.main:app --reload --port 8000
```

- Docs interactivas: http://localhost:8000/docs
- Tests: `.venv/bin/pytest -q` (17 pruebas, sin tocar TypeSafe ni la DB)

## Endpoints

| Metodo | Ruta | Que hace |
| --- | --- | --- |
| GET | `/health` | Estado y configuracion efectiva. |
| GET | `/scenario?source=embedded\|elecdb` | Arma el escenario. `elecdb` lo lee del MEM real. |
| POST | `/decision` | Ofertas del mes: un Jev por generador. |
| POST | `/session` | Guarda una partida terminada. |
| GET | `/session?limit=` | Ultimas partidas. |

## Arquitectura (MVC + SOLID, con puertos)

```
Controlador (api/routes)  ->  Servicios  ->  Puertos (Protocol)  ->  Adaptadores
```

| Capa MVC | Archivo | Rol |
| --- | --- | --- |
| Modelo | `app/domain/{types,constants,scenario,hydrology,market,engine,prompt}.py` | MEM en miniatura, puro. |
| **Controlador** | `app/api/routes.py` | Valida, delega, traduce errores. |
| Servicio | `app/services/offer_service.py` | Decide ofertas: un Jev por generador. |
| Servicio | `app/services/scenario_assembler.py` | Arma el escenario desde el MEM. |
| Servicio | `app/services/offer_mapper.py` | Respuestas -> ofertas (SRP). |
| Politica | `app/services/policies.py` | Subconjunto del MEM (Strategy). |
| **Puertos** | `app/ports.py` | `ModelGateway`, `SessionRepository`, `MarketDataSource`, `SubsetPolicy`. |
| Adaptadores | `app/adapters/{typesafe,mongo,embedded,elecdb}.py` | TypeSafe, Mongo, fuente embebida, PostgreSQL de XM. |
| Composicion | `app/container.py` | Inyecta los adaptadores. |

**SOLID.** SRP: cada archivo hace una cosa (mapeo, gateway, politica, motor).
DIP: los servicios dependen de interfaces; TypeSafe, Mongo y PostgreSQL son
adaptadores intercambiables. OCP: una fuente o proveedor nuevo se añade con un
adaptador, sin tocar el dominio. ISP: puertos chicos. Los tests usan dobles
(`tests/test_offer_service.py`), lo que demuestra la inversion.

## Skills usadas

- **`elecdb`**: el adaptador `adapters/elecdb.py` lee recursos, agentes, embalses
  y las series mensuales 2020-2025 de la base de XM.
- **`creg-ai-client`**: el precio de escasez (mensual, Resolucion CREG 140 de 2017)
  y las reconciliaciones (costos de restriccion) definen los parametros.
- **`jev-gateway`**: el modelo de las ofertas y el juicio que fijo la politica de
  subconjunto (agente sistemico + cuota por tecnologia).

## Nota de migracion

`api/` es el backend de ida. El frontend (Next.js) todavia usa las rutas
`/api/bolsa/*` en TypeScript; el siguiente paso es apuntar el frontend a este
servicio (`DecisionGateway` y `HistoryGateway` ya aceptan un transporte distinto)
y retirar el backend TS.
