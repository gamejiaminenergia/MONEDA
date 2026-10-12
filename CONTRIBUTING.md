# Contribuir

Gracias por mirar esto. El repo tiene dos juegos (bolitas y BOLSA) y un backend
FastAPI. Con que pasen `npm run verify`, `npm run build` y `pytest` del backend,
y las partidas sigan teniendo sentido, alcanza.

## Levantar el proyecto

Bolitas y BOLSA (frontend Next.js):

```bash
npm install
cp .env.example .env.local   # pega TYPESAFE_API_KEY
npm run dev                  # http://localhost:3000  (bolitas y /bolsa)
```

Backend del MEM (BOLSA, FastAPI):

```bash
cd api
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env         # TYPESAFE_API_KEY, MONGO_URL, ELECDB_URL
.venv/bin/uvicorn app.main:app --reload --port 8000
```

El unico proveedor es TypeSafe: pon `TYPESAFE_API_KEY` en `.env.local` (frontend)
o en `api/.env` (backend) y listo. Sin clave no hay jugadas: no queda respaldo
local.

## Antes de mandar un PR

```bash
npm run verify   # tipos + lint + tests (bolitas y BOLSA)
npm run build
cd api && .venv/bin/pytest -q   # backend FastAPI
```

Si el cambio toca fisica, prediccion, reglas o el mercado, agrega un test en
`tests/` (TS) o en `api/tests/` (Python). Los tests corren sin navegador, sin red
y sin base de datos.

## Como esta armado

La regla es una sola: **el motor no sabe que existe un navegador y el navegador
no sabe que existe TypeSafe.**

- `src/lib/game/world.ts` — la mesa sobre planck.js (Box2D). Choques, muros,
  prediccion de llegada.
- `src/lib/game/engine.ts` — vidas, muerte, saque, rallies. Sin DOM ni red.
- `src/lib/game/prompt.ts` — el texto que recibe el modelo, con la regla de
  muerte y el estado de los diez jugadores.
- `src/lib/ai/` — contratos con zod y normalizacion de respuestas.
- `src/app/api/` y `src/server/` — lo unico que habla con TypeSafe y con Mongo.
- `docker-compose.yml` y `src/server/mongo.ts` — MongoDB del historico: cada
  ronda que termina cae en la coleccion `matches` (con `MATCHES_ONLY_COMPLETE=1`
  solo las del minuto). `src/lib/client/match-recorder.ts` junta la telemetria
  en el navegador. Sin `MONGO_URL` el juego corre igual: guardar nunca es
  obligatorio.
- `src/lib/client/board/` — la escena de Phaser 4: dibujo, particulas, camara y
  audio. Avanza el motor y sincroniza la mesa con `engine.view()`.
- `src/lib/client/` + `src/components/` — bucle de decisiones, stores y React.

## BOLSA y el backend del MEM

BOLSA reusa el esqueleto (motor puro, decisiones de IA, historia en Mongo) y le
suma la interaccion por precio. Es **mensual 2020-2025** y tiene dos backends:

- `src/lib/bolsa/` + `src/server/bolsa/` + `src/app/api/bolsa/` — backend en
  TypeScript, con MVC y SOLID (controlador, servicio, puertos y adaptadores).
- `api/` — backend **FastAPI** (Python) de ida: ingiere el MEM real (`elecdb`) y
  juega el mercado. Puertos + adaptadores; punto de composicion en
  `api/app/container.py`.

El frontend de BOLSA vive en `src/lib/client/bolsa/`, `src/hooks/useBolsa.ts` y
`src/components/bolsa/`. Los planes e informes, en `docs/bolsa/`.

## Estilo

- TypeScript estricto: si `tsc` se queja, no hay discusion.
- Comentarios y textos de UI en espanol sin tildes, igual que el resto del
  codigo; se leen mejor en una consola.
- Nada de dependencias nuevas si `src/lib` ya resuelve el problema en 40 lineas.
