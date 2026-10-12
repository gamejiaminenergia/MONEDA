-- Exporta un ESCENARIO de BOLSA desde el MEM real (PostgreSQL XM, skill elecdb).
--
--   psql -d "postgresql://postgres:postgres@localhost:5432/postgres" -P pager=off -f docs/mem/scenario.sql
--
-- Un escenario es un JSON con la forma de `src/lib/bolsa/types.ts` (Scenario):
-- recursos, agentes (con su cartera), embalses y demanda. Se toma un dia real
-- (por defecto el Nino de 2024-04-15) y se reduce a un conjunto representativo:
-- no se juegan 2.395 recursos ni 700 agentes, sino los grandes.
--
-- Las consultas usan funciones y vistas ya acotadas; no golpean fact_hourly_*
-- sin filtro de fecha.

\set dia '2024-04-15'

-- R1. RECURSOS: plantas grandes con capacidad, oferta ideal y ENFICC.
-- Capacidad y ENFICC son diarias; el costo es el precio de oferta ideal.
SELECT
  r.recurso_code AS id,
  r.name         AS nombre,
  CASE
    WHEN UPPER(COALESCE(r.type,'')) = 'HIDRAULICA' THEN 'hidro'
    WHEN UPPER(COALESCE(r.type,'')) LIKE 'TERM%'  THEN 'termica'
    WHEN UPPER(COALESCE(r.type,'')) = 'SOLAR'      THEN 'solar'
    WHEN UPPER(COALESCE(r.type,'')) = 'EOLICA'     THEN 'eolica'
    ELSE 'termica'
  END AS tipo,
  ROUND(AVG(dr."CapEfecNeta")::numeric, 1) AS capacidad_mw,
  ROUND(AVG(dr."PrecOferIdeal")::numeric, 1) AS costo_cop_kwh,
  ROUND(AVG(dr."ENFICC")::numeric, 1)        AS enfi,
  r.ener_source AS combustible,
  r.company_code AS dueno
FROM dim_recurso r
JOIN fact_daily_recurso dr ON dr.recurso_code = r.recurso_code
WHERE dr.fecha = DATE :'dia'
  AND dr."CapEfecNeta" IS NOT NULL
  AND dr."CapEfecNeta" > 50
GROUP BY r.recurso_code, r.name, r.type, r.ener_source, r.company_code
ORDER BY capacidad_mw DESC
LIMIT 40;

-- R2. CARTERA: que agente es dueno de que recurso (N:N).
SELECT ar.agente_code, a.name AS agente, a.activity, ar.recurso_code
FROM dim_agente_recurso ar
JOIN dim_agente a ON a.agente_code = ar.agente_code
WHERE a.activity = 'GENERACIÓN'
ORDER BY a.name
LIMIT 200;

-- R3. EMBALSES: volumen util, techo y vertimientos del dia.
SELECT embalse_code AS id, "VoluUtilDiarEner" AS volumen_mwh, "VertEner" AS vertimiento_mwh
FROM fact_daily_embalse
WHERE fecha = DATE :'dia'
ORDER BY "VoluUtilDiarEner" DESC;

-- R4. RIOS: aportes vs media historica (la sequia).
SELECT rio_code AS id, "AporCaudal" AS caudal, "PorcApor" AS pct_vs_media
FROM fact_daily_rio
WHERE fecha = DATE :'dia'
ORDER BY "PorcApor" ASC NULLS LAST
LIMIT 20;

-- R5. DEMANDA: demanda del SIN del dia, para fijar la base y la forma horaria.
SELECT "DemaSIN" AS demanda_mwh, "PPPrecBolsNaci" AS bolsa_cop_kwh, "PrecEsca" AS escasez_cop_kwh
FROM fact_daily_sistema
WHERE fecha = DATE :'dia';

-- R6. FORMA HORARIA de la demanda (para la curva). La demanda comercial por hora
-- da el perfil; el juego lo reduce a una curva de 24 puntos.
SELECT date_trunc('hour', fecha_hora) AS hora, SUM("DemaCome") AS dema_comercial_mwh
FROM fact_hourly_agente
WHERE fecha_hora >= DATE :'dia' AND fecha_hora < DATE :'dia' + INTERVAL '1 day'
GROUP BY 1
ORDER BY 1;

-- R7. PRECIO DE ESCASEZ del dia (el techo del juego).
SELECT fecha, "PrecEsca" AS escasez_cop_kwh, "PrecEscaAct" AS escasez_act, "PrecEscaPon" AS escasez_pon
FROM fact_daily_sistema
WHERE fecha BETWEEN DATE :'dia' - INTERVAL '1 day' AND DATE :'dia' + INTERVAL '1 day'
ORDER BY fecha;

-- Con estas tablas se arma `scenario.json`: se toman los top-N recursos por
-- capacidad, su dueno (R2), los embalses (R3) y los rios (R4), y la demanda (R5,R6)
-- y el precio de escasez (R7). El juego ya trae dos escenarios embebidos
-- (`arcade` y `real`) construidos con estos mismos numeros; esta consulta es la
-- via para regenerarlos o ampliarlos.
