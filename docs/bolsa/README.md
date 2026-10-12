# BOLSA — el juego de agentes que refleja el MEM

El juego hermano de las bolitas. Conserva el esqueleto (motor determinista,
decisiones de IA por agente, historia en Mongo, mesa viva) y le devuelve lo que a
las bolitas les faltaba: **la interaccion por precio**. Aqui una oferta mueve el
precio que cobran todos.

- Concepto y plan: `PLAN-BOLSA.md`.
- Puente conceptual con el MEM: `../bolitas/INFORME-BOLITAS-MEM.md`.
- Datos reales del MEM: `../mem/README.md`.

## Como se juega

Seis agentes (tres hidraulicas baratas con embalse, tres termicas caras y firmes)
ofertan **precio y cantidad** cada hora. El operador despacha por **orden de
merito** y el precio de la ultima unidad despachada (el marginal) lo cobran
**todos**. Ganan los agentes si cubren la demanda las 24 horas sin apagon; si la
demanda no se cubre, gana la escasez.

## Codigo

| Archivo | Que hace |
| --- | --- |
| `src/lib/bolsa/types.ts` | Tipos del mercado. |
| `src/lib/bolsa/constants.ts` | Horizonte, bandas de oferta, curva de demanda, sequia. |
| `src/lib/bolsa/agents.ts` | Catalogo de los seis agentes. |
| `src/lib/bolsa/dispatch.ts` | Orden de merito y precio marginal (puro). |
| `src/lib/bolsa/engine.ts` | Liquidacion, embalse, insolvencia, apagon, fin. |
| `src/lib/bolsa/prompt.ts` | Estado y preguntas por agente. |
| `src/lib/ai/bolsa.ts` | Contratos zod y normalizacion de ofertas. |
| `src/app/api/bolsa/decision/route.ts` | Un Jev por agente (paralelo). |
| `src/app/api/bolsa/session/route.ts` | Guarda la partida en Mongo. |
| `src/components/bolsa/*` | Sala de despacho (React) y bucle del cliente. |
| `src/app/bolsa/page.tsx` | La pagina `/bolsa`. |

## Correr

```bash
npm run dev
# abrir http://localhost:3000/bolsa
npm run verify        # typecheck + lint + 11 pruebas del motor
```

El navegador nunca habla con TypeSafe: todo pasa por `/api/bolsa/decision`. La
clave vive solo en el servidor. Sin `MONGO_URL` el juego corre igual y no guarda.

## Invariantes (heredados de las bolitas)

1. El motor (`src/lib/bolsa`) no importa React, `next/*` ni usa `window`: corre en
   Node y lo cubren `tests/bolsa.test.ts`.
2. El navegador no conoce la clave ni llama a TypeSafe.
3. El motor es determinista: el azar de la lluvia entra por `options.random`.
4. Nada derivado del azar en el primer render (`createMarket` es puro).
