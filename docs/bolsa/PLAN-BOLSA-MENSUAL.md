# Plan: BOLSA mensual (2020-2025)

Estado: **ejecutado**.
Fecha: 2026-10-11.
Padre: `PLAN-BOLSA-MEM.md`. Reemplaza el modelo horario (24 h) por uno **mensual**.

## 1. Alcance corregido

La granularidad de **todo** es **mensual**. El horizonte es **2020-01 → 2025-12:
72 meses** con datos reales de XM (skill `elecdb`): demanda (`DemaSIN`), precio de
bolsa (`PPPrecBolsNaci`), precio de escasez (`PrecEsca`), embalse
(`PorcVoluUtilDiar`) y aportes (`PorcApor`).

## 2. Que cambia

| Antes (horario) | Ahora (mensual) |
| --- | --- |
| 24 horas | 72 meses (2020-2025) |
| MWh/hora | GWh/mes |
| Demanda por curva sintetica | Demanda real de cada mes |
| Embalse simulado | Embalse real exogeno (el clima manda) |
| Precio de escasez fijo | Precio de escasez real de cada mes |
| Gana quien aguanta el minuto/mes sin deficit | Gana quien termina los 72 meses con **al menos un generador solvente** |

## 3. Decisiones (elegidas)

1. **Victoria:** sobrevivir los 72 meses con al menos un generador solvente. El
   deficit de un mes no termina la partida: aplica una **penalizacion por racionamiento**
   y cuenta en el puntaje. Se pierde si **todos** los generadores quedan insolventes.
2. **Modo:** juego libre (los agentes de Jev deciden cada mes) con la **bolsa real
   como linea de referencia** en pantalla. Ademas se reporta un **puntaje**:
   meses cubiertos, marginal medio vs bolsa real, emisiones.

## 4. Clima exogeno y decision endogena

El clima (embalse y aportes) es **exogeno**: viene del dato real de cada mes. La
decision es **endogena**: los generadores ofertan su energia disponible y los
comercializadores cubren su demanda. Asi la sequia de 2024 aprieta de verdad y el
resultado se compara contra la historia.

## 5. Mapa elecdb -> juego (mensual)

| elecdb | En el juego |
| --- | --- |
| `fact_daily_sistema.DemaSIN` (mensual) | Demanda de cada mes (GWh) |
| `PPPrecBolsNaci` | Linea de referencia de la bolsa real |
| `PrecEsca` | Precio de escasez del mes |
| `PorcVoluUtilDiar` | Embalse del mes (limita la hidro) |
| `PorcApor` | Aportes del mes (contexto hidrologico) |
| `dim_recurso` + `CapEfecNeta`/`PrecOferIdeal`/`ENFICC` | Recursos con energia mensual, costo y firme |
| `dim_agente` + `dim_agente_recurso` | Agentes y cartera |
| `ObligEnerFirme` | Multa OEF cuando el marginal toca el precio de escasez |
| `RecoPos/NegEner` | Reconciliaciones |
| `EmisionesCO2Eq` | Costo de carbono |
| `dim_enlace` | TIE (importacion) |

## 6. Fases

| Fase | Que | Cierre |
| --- | --- | --- |
| 0 | Escenario mensual real | 72 periodos embebidos desde XM |
| 1 | Motor mensual | despacho por merito, marginal, deficit, racionamiento |
| 2 | Hidrologia exogena | el embalse real limita la hidro |
| 3 | Contratos y firmes | comercializadores y multa OEF |
| 4 | Puntaje y referencia | marginal vs bolsa real |
| 5 | UI mensual | linea de tiempo 2020-2025 |

## 7. Riesgos

- **Escala:** el dato real manda; las capacidades del juego son proporcionales para
  que el sistema sea jugable pero tenso en sequia.
- **Comparacion:** el marginal del juego no tiene por que igualar la bolsa real
  (es un modelo), pero sirve como linea de referencia.
- **Unidades:** todo en GWh/mes y COP/kWh.
