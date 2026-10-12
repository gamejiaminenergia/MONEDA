# BOLSA — el juego que refleja el MEM

Juego hermano de las bolitas. Conserva el esqueleto (motor determinista, decisiones
de IA por agente, historia en Mongo, mesa viva) y lleva al tablero **lo basico del
MERCADO MAYORISTA colombiano**: recursos, agentes con cartera, embalses y rios,
demanda y contratos, ENFICC/OEF, escasez, reconciliaciones, TIE y emisiones.

- Plan del MVP: `PLAN-BOLSA.md`.
- Plan ambicioso (MEM completo): `PLAN-BOLSA-MEM.md`.
- Plan mensual (2020-2025): `PLAN-BOLSA-MENSUAL.md`.
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

## Codigo

| Archivo | Que hace |
| --- | --- |
| `src/lib/bolsa/types.ts` | El MEM en miniatura (recursos, agentes, embalses, mercado). |
| `src/lib/bolsa/constants.ts` | Horizonte, bandas de oferta, curva de demanda, solar/eolica. |
| `src/lib/bolsa/scenario.ts` | Escenarios `arcade` y `real`. |
| `src/lib/bolsa/hydrology.ts` | Embalses, aportes de rios y vertimientos. |
| `src/lib/bolsa/market.ts` | Orden de merito, precio marginal y valvula TIE (puro). |
| `src/lib/bolsa/engine.ts` | La hora: despacho, liquidacion, OEF, hidrologia, insolvencia, fin. |
| `src/lib/bolsa/prompt.ts` | Estado y preguntas por generador (cartera). |
| `src/lib/ai/bolsa.ts` | Contratos zod y normalizacion de ofertas. |
| `src/app/api/bolsa/decision/route.ts` | Un Jev por generador (paralelo). |
| `src/app/api/bolsa/session/route.ts` | Guarda la partida en Mongo. |
| `src/components/bolsa/*` | Sala de despacho (React) y bucle del cliente. |
| `src/app/bolsa/page.tsx` | La pagina `/bolsa`. |
| `docs/mem/scenario.sql` | Exporta un escenario real desde XM (elecdb). |

## Correr

```bash
npm run dev
# abrir http://localhost:3000/bolsa
npm run verify        # typecheck + lint + 12 pruebas del motor
```

El navegador nunca habla con TypeSafe: todo pasa por `/api/bolsa/decision`. La
clave vive solo en el servidor. Sin `MONGO_URL` el juego corre igual y no guarda.

## Invariantes (heredados de las bolitas)

1. El motor (`src/lib/bolsa`) no importa React, `next/*` ni usa `window`: corre en
   Node y lo cubren `tests/bolsa.test.ts`.
2. El navegador no conoce la clave ni llama a TypeSafe.
3. El motor es determinista: el azar de la lluvia entra por `options.random`.
4. Nada derivado del azar en el primer render (`createMarket` es puro).
