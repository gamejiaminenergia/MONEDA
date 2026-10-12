# Plan: inferencia y extrapolacion bolitas ↔ MEM

Estado: **ejecutado**.
Fecha: 2026-10-11.
Objetivo: producir un documento que defina, con rigor, que **objetos**,
**metodos** y **mecanismos** del juego de bolitas (Nimble Pong) son similares a
los del Mercado de Energia Mayorista (MEM) colombiano —y, sobre todo, cuales no.

## Estado de ejecucion

| Fase | Que era | Estado |
| --- | --- | --- |
| 0 | Alcance y rubrica de grados | hecho: 5 grados definidos (seccion 2) |
| 1 | Extraccion del lado juego (codigo + Mongo) | hecho: reusa `docs/bolitas/INFORME-ALTRUISMO.md` |
| 2 | Extraccion del lado MEM (elecdb + CREG) | hecho: `docs/mem/consultas.sql` + consultas CREG |
| 3 | Alineacion y grados | hecho: tablas de objetos/metodos/mecanismos |
| 4 | Inferencia, extrapolacion y backtest | hecho: secciones 5 y 6 + sonda factual con Jev |
| 5 | Redaccion del documento | hecho: `docs/bolitas/INFORME-BOLITAS-MEM.md` |
| 6 | Verificacion | hecho: cifras salen de la salida del script SQL |

Hallazgo central: la analogia tiene **un isomorfismo** (historico ↔ BD XM), varias
**analogias funcionales** y una **ruptura decisiva** (el juego no tiene interaccion
entre agentes; el mercado si, via precio).

## 1. Objetivo y entregable

Convertir «el juego se parece al mercado» en una **correspondencia estructural
verificable**: que objetos, metodos y mecanismos coinciden, con que grado, y
donde la analogia se rompe. El valor esta en el borde, no en afirmar que se
parecen.

Entregables:

| Archivo | Que es |
| --- | --- |
| `docs/bolitas/PLAN-BOLITAS-MEM.md` | Este plan. |
| `docs/bolitas/INFORME-BOLITAS-MEM.md` | El informe ejecutivo: correspondencias, inferencias, extrapolaciones y rupturas. |
| `docs/mem/consultas.sql` | Las consultas al MEM que respaldan las cifras del informe. |

## 2. Marco: tres capas y una rubrica de grados

| Capa | Que compara | Ejemplos |
| --- | --- | --- |
| **Objetos** | entidades y estado | bola negra, bolitas, mesa, paredes, config |
| **Metodos** | politicas y algoritmos | politica del modelo, prediccion de trayectoria, barrido de roce |
| **Mecanismos** | reglas e incentivos | roce mata, «≥1 vivo → ganan todas», un solo decisor, no-interaccion |

Cada par recibe un **grado de correspondencia**, que es lo que evita forzar la
analogia:

- **Isomorfismo**: misma estructura; las conclusiones se transfieren.
- **Homomorfismo**: se preserva parte de la estructura.
- **Analogia funcional**: cumple un papel parecido, con otra mecanica.
- **Metafora**: solo evoca.
- **Ruptura**: existe en un lado y no en el otro (la mas informativa).

## 3. Metodo

### 3.1 Inferencia (lo que se transfiere)

Por cada par se identifica el **invariante** (una cantidad conservada, una regla,
un incentivo). Si el invariante coincide → la conclusion se transfiere; si no,
se degrada de grado. Ejemplo ya probado en el informe de altruismo: «un sistema
coordinado no necesita altruismo» se transfiere porque el juego lo cumple y el
MEM tambien (confiabilidad por reglas e incentivos, no por bondad).

### 3.2 Extrapolacion (lo que se proyecta)

- **Juego → mercado:** que del juego predice comportamiento del MEM.
- **Mercado → juego:** que mecanismos del MEM faltan en el juego (precio,
  interaccion entre agentes, contratos, poder de mercado) → extensiones.

### 3.3 Backtest minimo

Para cada mecanismo presente en ambos lados, calcular **el mismo estadistico en
las dos bases**: partidas en Mongo y series del MEM.

## 4. Fuentes y skills

| Fuente / skill | Rol |
| --- | --- |
| Codigo del juego (`src/lib/game`, `src/lib/ai`) | Objetos, metodos y mecanismos del lado juego. |
| `matches` de MongoDB | Evidencia conductual del juego (36 partidas, 2.087 turnos). |
| `elecdb` (PostgreSQL XM) | Objetos y series reales del MEM: agentes, precios de bolsa y escasez, demanda, embalses, contratos, OEF, demanda no atendida. Rango 2020-01 → 2026-06. |
| `creg-ai-client` | Mecanismos regulatorios (reglas e incentivos CREG). |
| `jev-gateway` | Juicio estructurado para puntuar cada correspondencia (isomorfo/análogo/roto) con criterio consistente. |

## 5. Fases

| Fase | Que hace | Cierre |
| --- | --- | --- |
| 0 | Definir alcance y rubrica de grados | la analogia queda falsable |
| 1 | Extraer el lado juego (codigo + Mongo) | catalogo del juego |
| 2 | Extraer el lado MEM (`elecdb` + `creg-ai-client`) | catalogo del mercado con fuentes |
| 3 | Alinear los catalogos y asignar grados | tabla de correspondencias |
| 4 | Inferir, extrapolar y hacer el backtest | inferencias con evidencia |
| 5 | Redactar el documento (formato ejecutivo) | informe con anexos |
| 6 | Verificar cifras y afirmaciones | informe sin numeros muertos |

## 6. Estructura del documento

1. Veredicto con grados.
2. Objetos comparados.
3. Metodos comparados.
4. Mecanismos comparados.
5. Inferencias transferibles.
6. Extrapolaciones (en las dos direcciones).
7. Rupturas y limites.
8. Glosario bilingue (bola ↔ agente).
9. Anexos: consultas y datos.

Cada seccion cierra con **Conclusion / Tips / Advertencias** (convencion de
`AGENTS.md`).

## 7. Riesgos

- **Apofenia:** ver analogias donde solo hay metafora → lo controla la rubrica.
- **Escalas y horizontes:** el minuto del juego vs. el dia/hidrologia del MEM.
- **Sobreajuste narrativo:** elegir los datos que confirman → lo evita el
  backtest con el mismo estadistico en ambos lados.
