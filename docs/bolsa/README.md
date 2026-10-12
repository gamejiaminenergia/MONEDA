# BOLSA — el juego que refleja el MEM

Juego hermano de las bolitas. Conserva el esqueleto (motor determinista, decisiones
de IA por agente, historia en Mongo, mesa viva) y lleva al tablero **lo basico del
MERCADO MAYORISTA colombiano**: recursos, agentes con cartera, embalses y rios,
demanda y contratos, ENFICC/OEF, escasez, reconciliaciones, TIE y emisiones.

- Plan del MVP: `PLAN-BOLSA.md`.
- Plan ambicioso (MEM completo): `PLAN-BOLSA-MEM.md`.
- Plan mensual (2020-2025): `PLAN-BOLSA-MENSUAL.md`.
- Plan del backend FastAPI: `PLAN-BACKEND-MEM.md`.
- Backend (servicio aparte, FastAPI): `../../api/README.md`.
- Puente conceptual con el MEM: `../bolitas/INFORME-BOLITAS-MEM.md`.
- Datos reales del MEM: `../mem/README.md`.

## Como se juega

Ocho **generadores** (hidro, termica, solar, eolica) ofertan su **cartera** cada
**mes**: precio y cantidad por recurso. Cuatro **comercializadores** sirven su
**demanda**, cubierta en parte con **contratos** y el resto a **bolsa**. El
operador despacha por **orden de merito** y el precio de la ultima unidad (el
**marginal**) lo cobran todos. El clima es **exogeno**: el embalse real del mes
limita la hidro (la sequia de 2024 aprieta); el **TIE** importa si falta; si nada
alcanza, hay **racionamiento** (cuenta y penaliza, no termina la partida). En un
mes estresado, quien no entrega su **ENFICC** paga multa.

**Gana quien termina los 72 meses con al menos un generador solvente.** El
horizonte es **2020-01 -> 2025-12** con las series reales de XM (demanda, bolsa,
escasez, embalse y aportes). La **bolsa real** aparece como linea de referencia y
el marcador compara el marginal del juego contra ella.

## Arquitectura (MVC + SOLID, backend y frontend independientes)

Misma separacion que Nimble Pong: el **backend** no conoce el navegador y el
**frontend** no conoce la clave. La unica frontera es `/api/bolsa/*`. Cada capa
tiene una responsabilidad (SRP) y depende de **puertos** (interfaces), no de
implementaciones (DIP); los adaptadores se inyectan en un punto de composicion.

**Backend**

| Capa MVC | Archivo | Rol |
| --- | --- | --- |
| Modelo (dominio) | `src/lib/bolsa/*` | MEM en miniatura, puro y testeable en Node. |
| Modelo (contratos) | `src/lib/ai/bolsa.ts` | Esquemas zod y normalizacion de ofertas. |
| **Controlador** | `src/app/api/bolsa/{decision,session}/route.ts` | Valida, delega y traduce errores. |
| Servicio (caso de uso) | `src/server/bolsa/offer-service.ts` | Decide las ofertas: un Jev por generador. |
| Puerto (`ModelGateway`) | `src/server/bolsa/ports.ts` | Interfaz hacia el proveedor del modelo. |
| Adaptador | `src/server/bolsa/model-gateway.ts` | TypeSafe (`askSystemOne`). |
| Puerto (`SessionRepository`) | `src/server/bolsa/ports.ts` | Interfaz de historico. |
| Adaptador | `src/server/bolsa/session-repository.ts` | Mongo. |
| Mapeo (SRP) | `src/server/bolsa/offer-mapper.ts` | Respuestas del modelo -> ofertas. |
| Composicion | `src/server/bolsa/index.ts` | Inyecta los adaptadores. |
| Datos reales | `docs/mem/scenario.sql` | Exporta un escenario desde XM (elecdb). |

**Frontend**

| Capa MVC | Archivo | Rol |
| --- | --- | --- |
| Modelo | `src/lib/client/bolsa/session.ts` | Estado, meses, costo y persistencia. |
| Puerto (`DecisionGateway`) | `src/lib/client/bolsa/ports.ts` | Interfaz hacia el backend de decisiones. |
| Puerto (`HistoryGateway`) | `src/lib/client/bolsa/ports.ts` | Interfaz de historico. |
| Adaptadores | `src/lib/client/bolsa/gateways.ts` | HTTP (`/api/bolsa/*`). |
| Bucle | `src/lib/client/bolsa/decision-loop.ts` | Pide ofertas y avanza el mes. |
| **Controlador** | `src/hooks/useBolsa.ts` | Une modelo y puertos; expone estado/acciones. |
| Vista | `src/components/bolsa/*` | Componentes con una sola responsabilidad. |

**SOLID en una linea.** SRP: cada archivo hace una cosa (mapeo, gateway, bucle,
vista). DIP: servicios y sesion dependen de interfaces; TypeSafe y Mongo son
adaptadores intercambiables. OCP: un proveedor o transporte nuevo se añade con un
adaptador, sin tocar el dominio. ISP: puertos chicos (`ModelGateway`,
`DecisionGateway`, `HistoryGateway`). LSP/abstraccion: los dobles de prueba
sustituyen a los adaptadores (ver `tests/bolsa-architecture.test.ts`).

## Correr

```bash
npm run dev
# abrir http://localhost:3000/bolsa
npm run verify        # typecheck + lint + 119 pruebas
```

El navegador nunca habla con TypeSafe: todo pasa por `/api/bolsa/decision`. La
clave vive solo en el servidor. Sin `MONGO_URL` el juego corre igual y no guarda.

## Invariantes (heredados de las bolitas)

1. El motor (`src/lib/bolsa`) no importa React, `next/*` ni usa `window`: corre en
   Node y lo cubren `tests/bolsa.test.ts`.
2. El navegador no conoce la clave ni llama a TypeSafe.
3. El motor es determinista: el azar de la lluvia entra por `options.random`.
4. Nada derivado del azar en el primer render (`createMarket` es puro).
