-- Consultas al MEM (PostgreSQL XM) que respaldan docs/bolitas/INFORME-BOLITAS-MEM.md
--
--   psql -d "postgresql://postgres:postgres@localhost:5432/postgres" -P pager=off -f docs/mem/consultas.sql
--
-- Rango de datos: 2020-01-01 -> 2026-06-30. Las tablas grandes (fact_hourly_*)
-- exigen filtro por fecha; aqui se usan funciones y vistas ya acotadas.

-- O1. Cuantos "jugadores": agentes por actividad.
SELECT activity, COUNT(*) AS n FROM dim_agente GROUP BY activity ORDER BY n DESC;

-- O2. Tipos de recurso (parque de generacion).
SELECT COALESCE(type,'SIN CLASIFICAR') AS tipo, COUNT(*) AS n
FROM dim_recurso GROUP BY 1 ORDER BY n DESC;

-- M1. Concentracion del mercado (HHI) 2025: competencia vs aglomeracion.
SELECT * FROM fn_analisis_concentracion_mercado('2025-01-01','2025-12-31');

-- M2. Precios 2025: bolsa, escasez y contratos (el "peligro" y su cobertura).
SELECT
  ROUND(AVG("PPPrecBolsNaci")::numeric,2) AS bolsa_prom,
  ROUND(MIN("PPPrecBolsNaci")::numeric,2) AS bolsa_min,
  ROUND(MAX("PPPrecBolsNaci")::numeric,2) AS bolsa_max,
  ROUND(AVG("PrecEsca")::numeric,2)       AS escasez_prom,
  ROUND(AVG("PrecPromCont")::numeric,2)   AS contratos_prom
FROM fact_daily_sistema
WHERE fecha BETWEEN '2025-01-01' AND '2025-12-31';

-- M3. El Nino: embalse vs precio en fechas clave.
SELECT fecha,
       ROUND("PPPrecBolsNaci"::numeric,1)        AS bolsa_cop_kwh,
       ROUND("PrecEsca"::numeric,1)              AS escasez_cop_kwh,
       ROUND(("PorcVoluUtilDiar"*100)::numeric,1) AS embalse_pct
FROM fact_daily_sistema
WHERE fecha IN ('2024-04-15','2024-09-15','2025-01-15','2025-06-15','2026-01-15','2026-06-15')
ORDER BY fecha;

-- M4. Cobertura de contratos vs exposicion a bolsa (defensa individual) 2025-H1.
SELECT * FROM fn_estudio_c04_exposicion_bolsa('2025-01-01','2025-06-30') LIMIT 10;

-- M5. Quien fija el precio: recurso marginal (hidraulica 100% de las horas) 2024-Q1.
SELECT * FROM fn_estudio_g06_marginalidad('2024-01-01','2024-03-31') LIMIT 10;

-- M6. Mezcla de generacion 2025 (el "campo" donde se juega).
SELECT * FROM fn_generacion_por_tipo('2025-01-01','2025-12-31');

-- M7. Demanda no atendida (el "apagon": la bola matando a todos).
SELECT area_code, mes, ROUND(pct_no_atendida_total::numeric,4) AS pct_dna
FROM v_demanda_no_atendida_porcentaje
ORDER BY pct_no_atendida_total DESC NULLS LAST LIMIT 5;

-- M8. Incumplimiento de OEF (la "regla que obliga").
SELECT COUNT(*) AS recursos_con_deficit_oef
FROM (SELECT DISTINCT nombre_recurso FROM v_cumplimiento_oef WHERE deficit_GWh > 0) t;
