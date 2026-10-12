# Plan: BOLSA — un juego de agentes que refleja el MEM

Estado: **ejecutado**.
Fecha: 2026-10-11.
Padre: `docs/bolitas/INFORME-BOLITAS-MEM.md` (el puente juego ↔ MEM).

## Estado de ejecucion

| Fase | Que era | Estado |
| --- | --- | --- |
| 0 | Diseno y balance | hecho: 6 agentes, 24 horas, bandas de oferta |
| 1 | Motor determinista | hecho: `src/lib/bolsa/*` + `tests/bolsa.test.ts` (11 pruebas) |
| 2 | IA por agente | hecho: `src/lib/ai/bolsa.ts`, `src/app/api/bolsa/decision` (un Jev por agente) |
| 3 | Sala de despacho | hecho: `src/components/bolsa/*`, ruta `/bolsa` |
| 4 | Historia + calibracion | hecho: coleccion `sessions`, `/api/bolsa/session`; rangos del MEM documentados |
| 5 | Pulido y modos | parcial: arcade listo; calibrado con datos reales y modo jugador quedan como siguiente paso |

## 1. Objetivo

Un juego **hermano de las bolitas**: mismo esqueleto (motor determinista, decisiones
de IA por agente, historia en Mongo, mesa viva), pero cuyo mecanismo central sea el
que **faltaba**: la **interaccion por precio**.

Principio rector:

> Las bolitas son el MEM **sin interaccion**. BOLSA devuelve esa interaccion:
> **una oferta mueve el precio que cobran todos**.

## 2. Alcance (lo basico)

| Concepto | Que se juega |
| --- | --- |
| Demanda | Objetivo a cubrir cada hora; sube en pico |
| Orden de merito | El operador apila ofertas de la mas barata a la mas cara |
| Precio marginal | El ultimo despachado fija el precio que **reciben todos** |
| Hidro | Genera barato pero **gasta embalse**; la lluvia lo recarga |
| Termica | Firme pero **cara**; salva en sequia |
| Escasez (El Nino) | Si falta energia, el precio se dispara y hay **apagon** |
| Insolvencia | Caja negativa o incumplir el contrato **mata** al agente |
| Confiabilidad | Bien comun: **servir la demanda todo el horizonte** |

Fuera del MVP (a proposito): TIE, CIIU, emisiones, reconciliaciones, OEF, poder de
mercado. Si entran, en fases posteriores.

## 3. Mapeo triple (bolitas ↔ BOLSA ↔ MEM real)

| Bolitas | BOLSA | MEM real |
| --- | --- | --- |
| Bolita de color | Agente generador | Generador |
| Bola negra | La escasez / el apagon | Precio de escasez / demanda no atendida |
| Roce mortal | Insolvencia (caja < 0) | Insolvencia |
| Mesa y paredes | Demanda y limites (capacidad, embalse) | SIN |
| Minuto | Horizonte de 24 horas | Dia |
| Una jugada por turno | Una **oferta** (precio, cantidad) por hora | Oferta horaria |
| Jev decide las diez | **Un Jev por agente** (descentralizado) | Cada agente decide |
| **Sin interaccion** | **El precio marginal acopla a todos** | Orden de merito |
| Ganan las bolitas | Se sirve la demanda todo el horizonte | Confiabilidad |

## 4. Mecanica (una hora por turno)

1. El operador anuncia **demanda** de la hora y el **estado hidrologico** (sequia).
2. Cada agente decide su **oferta** (precio y cantidad) sobre una rejilla: 4 bandas
   de precio x 4 de cantidad.
3. El motor ordena por precio, despacha hasta cubrir la demanda y fija el **precio
   marginal**.
4. Liquidacion: cada despachado cobra `precio marginal x cantidad - su costo`; el
   embalse baja; la lluvia recarga; la caja sube o baja.
5. `capacidad total < demanda` -> **apagon** (falla colectiva). `caja < 0` ->
   **insolvencia** (muere el agente).
6. Se repite 24 veces. **Ganan los agentes** si nunca hubo apagon; si no, **gana la
   escasez**.

## 5. El rol de la IA

- **Un `jev` por agente**: rompe la "mente unica" de las bolitas y refleja un
  mercado descentralizado.
- Cada agente ve solo su estado + pronostico de demanda + historia de precios:
  informacion parcial = estrategia.
- Dos preguntas tipadas por agente (`choice`): banda de precio y banda de cantidad.
- Costo: ~6-10 llamadas por hora x 24 horas ~ **$0.03 por partida**.

## 6. Arquitectura (reusa lo probado)

Se implementa como **modulo y ruta nuevos dentro del repo**, reutilizando el stack
(Next.js, React, TypeScript, zod, mongodb) y los mismos invariantes:

| Capa | Carpeta | Que hace |
| --- | --- | --- |
| Mercado (motor) | `src/lib/market` | Despacho, precio marginal, embalse, liquidacion. TS puro, testeable en Node |
| IA | `src/lib/ai/bolsa.ts` | Contratos zod + normalizacion de ofertas |
| Servidor | `src/server/bolsa.ts`, `src/app/api/bolsa/*` | Llama a TypeSafe; la clave vive solo aqui |
| Cliente | `src/lib/client/bolsa` | Bucle de horas, store |
| Historia | Mongo `sessions` | Cada partida entera: ofertas, despacho, precios, eventos |
| Mesa | `src/components/bolsa` | Sala de despacho en vivo |

Regla de oro heredada: **el motor no conoce el navegador; el navegador no conoce la
clave.** El motor es determinista (`options.random` inyectable).

## 7. Visualizacion

Una **sala de despacho**:

- **Izquierda:** la torre de merito (barras apiladas de barata a cara), la linea de
  **demanda** y el **marginal** marcado.
- **Centro:** los agentes como fichas de color con **embalse** (gauge) y **caja**;
  se apagan al insolventarse.
- **Derecha:** series de **precio** y caja, mas la **consola del modelo**.
- **Arriba:** el numero grande **precio de bolsa** y el reloj de **horas restantes**.
- Indicador de **sequia** por estaciones.

Canvas/SVG ligero (Phaser queda opcional mas adelante).

## 8. Datos e historia

- **Calibracion** con `docs/mem/consultas.sql` (skill `elecdb`): curva de demanda,
  rangos de costo, precio de escasez, ciclo de embalse.
- **Historia en Mongo** (coleccion `sessions`): `samples`, `offers`, `dispatch`,
  `events` y `modelCalls`, para analisis posterior.

## 9. Fases

| Fase | Que | Cierre |
| --- | --- | --- |
| 0 | Diseno y balance | reglas y valores de arranque |
| 1 | Motor determinista | despacho + precio marginal + embalse con tests |
| 2 | IA por agente | ofertas de Jev normalizadas; info parcial |
| 3 | Sala de despacho | se ve la torre de merito y el precio |
| 4 | Historia + calibracion | Mongo y rangos del MEM |
| 5 | Pulido y modos | arcade/calibrado, observador/jugador |

## 10. Criterios de exito y anti-objetivos

**Exito:** (1) una oferta cambia el precio que reciben los demas, visible; (2) una
sequia sube el precio y puede causar apagon; (3) el sistema puede colapsar (siempre
hay ganador); (4) motor determinista con tests; (5) cada partida queda entera en
Mongo.

**Anti-objetivos:** no modelar todo el MEM; no usar un solo decisor; no dejar el
precio fuera de la vista; no inventar tarifas sin citar la fuente.

## 11. Riesgos

- **Fidelidad vs diversion:** demasiada realidad = hoja de calculo; poca = pierde
  el proposito. Palancas: horizonte (24 h) y rejilla de ofertas.
- **Que la interaccion no se vea:** el precio es el protagonista visual.
- **Costo de IA:** llamadas baratas; vigilar el tope por hora.
- **Calibracion que derive:** anclar a `docs/mem/consultas.sql` y a los tests.
