# MEM — Mercado de Energia Mayorista colombiano

Material del lado mercado: las consultas al Sistema Interconectado Nacional (SIN)
operado por XM, base PostgreSQL usada para respaldar el informe puente
`docs/bolitas/INFORME-BOLITAS-MEM.md`.

## Contenido

| Archivo | Que es |
| --- | --- |
| `consultas.sql` | Las consultas al MEM (agentes, precios, embalses, contratos, marginalidad, generacion, demanda no atendida, OEF). |

## Fuente

- **Base:** PostgreSQL de XM, `postgresql://postgres:postgres@localhost:5432/postgres`.
- **Rango cargado:** 2020-01-01 → 2026-06-30 (~57M filas en 31 tablas).
- **Skill:** `elecdb` (esquema, vistas `v_*`, funciones `fn_estudio_*`, estudios C01-C14 y G01-G16).
- **Regulacion:** CREG (skill `creg-ai-client`) para los mecanismos (Cargo por Confiabilidad, OEF, precio de escasez).

## Reproducir

```bash
psql -d "postgresql://postgres:postgres@localhost:5432/postgres" -P pager=off -f docs/mem/consultas.sql
```

Las consultas usan funciones y vistas ya acotadas (`fn_*`, `v_*`) para no golpear
las tablas de 20M de filas.

## Uso

Este material es la contraparte del juego de bolitas. La comparacion completa
—objetos, metodos y mecanismos similares— esta en
`../bolitas/INFORME-BOLITAS-MEM.md`.
