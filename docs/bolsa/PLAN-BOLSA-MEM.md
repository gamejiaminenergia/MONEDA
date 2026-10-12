# Plan: llevar el MEM completo al juego BOLSA

Estado: **ejecutado**.
Fecha: 2026-10-11.
Padre: `PLAN-BOLSA.md` (el MVP) y `../bolitas/INFORME-BOLITAS-MEM.md` (el puente).

## Estado de ejecucion

| Fase | Capa | Estado |
| --- | --- | --- |
| 0 | Escenario (SQL → JSON) | hecho: `src/lib/bolsa/scenario.ts` (`arcade` y `real`) + `docs/mem/scenario.sql` |
| 1 | Recursos + cartera | hecho: `resources[]` con dueno; un agente, varias plantas |
| 2 | Hidrologia (embalses, rios, El Nino) | hecho: `src/lib/bolsa/hydrology.ts`, vertimientos y sequia |
| 3 | Comercializadores + contratos | hecho: agentes con demanda, cobertura y exposicion a bolsa |
| 4 | ENFICC/OEF + escasez + reconciliaciones | hecho: multa OEF en escasez, reconciliacion y precio de escasez |
| 5 | TIE + combustible + emisiones | hecho: valvula TIE y costo de carbono; combustible en el recurso |
| 6 | Calibracion real (El Nino) | hecho: escenario `real` con embalses al ~30% y precio alto |
| 7 | UI ampliada + Mongo + analisis | hecho: sala con embalses/agentes/AI, `sessions` con recursos y agentes |

## 1. Objetivo

Pasar BOLSA de maqueta de un piso (6 agentes fijos) a un **MEM en miniatura**,
con las mismas entidades que la base de XM (`elecdb`) pero sin los ceros: recursos,
agentes con cartera, embalses y rios, demanda y contratos, energia firme (ENFICC/OEF),
escasez, reconciliaciones, TIE, combustible y emisiones.

## 2. Idea central: el escenario

Todo se articula sobre un artefacto, el **escenario**: un JSON que **espeja el
star schema de elecdb** y que el motor consume.

```
elecdb (PostgreSQL XM) --SQL--> scenario.json --> motor BOLSA --> partida --> Mongo
```

`docs/mem/scenario.sql` exporta un dia real (p. ej. El Nino de abril 2024); el
juego lo juega. Dos modos: **arcade** (escenario propio) y **calibrado** (dato real).

## 3. Que del MEM entra (mapa elecdb -> juego)

| elecdb | En el juego |
| --- | --- |
| `dim_recurso` (tipo, ener_source) | Plantas: hidro / termica / solar / eolica |
| `fact_daily_recurso.CapEfecNeta` | Capacidad efectiva |
| `fact_daily_recurso.PrecOferIdeal` | Costo/oferta ideal |
| `fact_daily_recurso.ENFICC`, `ObligEnerFirme` | Energia firme y obligacion |
| `dim_embalse`, `fact_daily_embalse` | Embalses: volumen util, vertimientos |
| `dim_rio`, `fact_daily_rio` | Rios: aportes vs media historica (El Nino) |
| `dim_agente` (activity) | Agentes generadores y comercializadores |
| `dim_agente_recurso` | Cartera (un agente, varios recursos) |
| `fact_hourly_agente.Comp/VentContEner` | Contratos bilaterales |
| `fact_hourly_agente.DemaReal/DemaOR` | Demanda a servir |
| `fact_hourly_agente.PerdidasEner` | Perdidas |
| `fact_hourly_recurso.Gene/DispoReal/IndRecMargina` | Generacion, disponibilidad, marginal |
| `fact_hourly_recurso.RecoPos/NegEner` | Reconciliaciones |
| `fact_hourly_recurso.EmisionesCO2Eq`, `ConsCombustibleMBTU` | Emisiones y combustible |
| `dim_enlace`, `fact_hourly_enlace` | TIE: importar/exportar |
| `fact_daily_sistema.PrecEsca*`, `PorcVoluUtilDiar`, `AporEner` | Precio de escasez e hidrologia |
| Estudios `C01-C14`, `G01-G16` | Indicadores que el juego puede anotar |

## 4. Modelo de juego

### Actores

- **Generadores (con IA):** cada uno con una **cartera** de recursos; oferta precio
  y cantidad por recurso.
- **Comercializadores (pasivos):** sirven su demanda; cubren una fraccion con
  contratos y el resto a bolsa; su P&G depende del precio marginal.

### Estado

Recursos (tipo, capacidad, costo, ENFICC, combustible, emisiones, dueno),
embalses (volumen, inflow, vertimientos), agentes (caja, cartera, contratos), y el
mercado (demanda, sequia, marginal, escasez, TIE, reconciliaciones, carbono).

### La hora

1. El operador publica demanda y sequia.
2. Los generadores ofertan por recurso (bandas de precio y cantidad).
3. Despacho por **orden de merito**; el marginal lo cobran todos.
4. **TIE**: si hay deficit y queda capacidad, importa hasta cubrirlo.
5. **Reconciliaciones** y **carbono** como costos; **multa OEF** si en escasez un
   recurso con ENFICC no entrego su firme.
6. **Hidrologia**: los embalses bajan por generacion, suben por aportes (sequia) y
   **vierten** si se llenan.
7. Insolvencia de agentes; apagon si la demanda no se cubre ni con TIE.
8. Fin: ganan los agentes si se aguanta el horizonte; si no, gana la escasez.

## 5. Arquitectura

Refactor de `src/lib/bolsa` en modulos por concepto (todos puros y testeados):

| Modulo | Que |
| --- | --- |
| `types.ts` | Tipos del MEM en miniatura |
| `constants.ts` | Horizonte, bandas, curvas, umbrales |
| `scenario.ts` | Escenarios `arcade` y `real` (El Nino) |
| `hydrology.ts` | Embalses, aportes, vertimientos |
| `market.ts` | Merito, marginal, TIE, reconciliaciones, emisiones, OEF |
| `engine.ts` | La hora completa |
| `prompt.ts` | Estado y preguntas por generador |
| `src/lib/ai/bolsa.ts` | Contratos zod y normalizacion |
| `src/app/api/bolsa/decision` | Un Jev por generador (paralelo) |

## 6. UI

Sala de despacho ampliada: torre de merito por recurso, panel de **embalses y
rios**, tarjetas de **agentes** (cartera, caja, contratos), indicadores de **TIE**,
**emisiones** y **OEF**, y un **selector de escenario** (arcade / real).

## 7. Historia y analisis

Mongo guarda una `session` con `horas`, `despacho`, `recursos`, `embalses`,
`agentes` y `eventos`, espejando el schema. De ahi salen los informes.

## 8. Escala y costo

Se juega un **subconjunto** representativo (8 generadores + 4 comercializadores,
~20 recursos). Decision **por generador** (una llamada decide toda su cartera).
Modo mixto (IA + heuristico) disponible para el costo.

## 9. Riesgos

- **Complejidad vs juego:** lo resuelve el escenario reducido, no meter 57M filas.
- **Costo de IA:** subconjunto + decision por agente.
- **Calibracion que derive:** anclada al `scenario.sql` y a los tests.
