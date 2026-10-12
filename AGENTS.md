<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Guia para agentes

El repo tiene **dos juegos** y un backend en Python:

- **Bolitas (Nimble Pong)**: diez corredores huyen de una bola que mata; cada
  jugada la decide la API System One de TypeSafe. Next.js + TypeScript.
- **BOLSA**: el Mercado de Energia Mayorista (MEM) colombiano en miniatura,
  mensual 2020-2025. Frontend Next.js + backend **FastAPI** en `api/`.
- **`api/`**: backend del MEM (FastAPI + Python); ingiere `elecdb` y juega el
  mercado. Es el backend de ida de BOLSA.

Antes de tocar codigo, lee `README.md` (bolitas) y `docs/bolsa/` (BOLSA). El
"por que" de casi todo esta ahi.

## Invariantes de bolitas

No son estilo: romperlas cambia el juego o tira los tests.

1. **El motor no conoce el navegador.** `src/lib/game` y `src/lib/ai` no importan
   React, Phaser, `next/*` ni usan `window`, `document` o `fetch`. Tienen que
   seguir corriendo en Node: `tests/*.test.ts` los ejecuta sin navegador.
2. **El navegador no habla con TypeSafe.** Todo pasa por `POST /api/decision`.
   No anadas llamadas del cliente a la API ni expongas `TYPESAFE_API_KEY`: esa
   clave vive solo en el servidor.
3. **Phaser es presentacion, no simulacion.** `src/lib/client/board/` avanza el
   motor y dibuja. Reglas, roce, muerte y prediccion viven en `src/lib/game`. No
   muevas la bola a Arcade ni a Matter: la prediccion que recibe el LLM es una
   formula cerrada (`ballAt`, `predictThreat`) y un motor de pasos la pierde.
4. **Determinismo en el motor.** Nada de `Math.random` ni `Date.now` sueltos en
   `src/lib/game`: la aleatoriedad entra por `options.random`, que los tests
   inyectan con un generador con semilla.
5. **Nada derivado del azar en el primer render.** Lo que React pinta del motor
   pasa por `useEngineUi`, que sirve un snapshot estable al servidor. Si anades
   campos a `UiState`, actualiza tambien ese snapshot o vuelve el error de
   hidratacion #418.
6. **Phaser solo en el cliente.** Se importa con `await import('phaser')` dentro
   de un efecto, nunca en el modulo raiz. Cualquier `Phaser.Game` se destruye en
   el cleanup del efecto y el montaje tardio se cancela: en desarrollo React
   monta dos veces (StrictMode).
7. **Sin assets binarios.** Los sonidos se sintetizan en
   `src/lib/client/board/tone.ts` y se registran como `AudioBuffer` en la cache
   de Phaser. Evita `sound.decodeAudio`: su callback asincrono revienta si el
   juego ya se destruyo.

## Invariantes de BOLSA (frontend Next.js + backend TS)

1. **El motor es puro.** `src/lib/bolsa` no importa React ni `next/*`; corre en
   Node y lo cubren `tests/bolsa*.test.ts`.
2. **El navegador no conoce la clave.** Todo pasa por las rutas `/api/bolsa/*`;
   nunca llames a TypeSafe desde el cliente.
3. **MVC + SOLID con puertos.** El backend tiene controlador (rutas), servicios
   (casos de uso), **puertos** (interfaces) y adaptadores; la composicion vive
   solo en `src/server/bolsa/index.ts`. El frontend tiene modelo
   (`src/lib/client/bolsa`), controlador (`src/hooks/useBolsa.ts`) y vista
   (`src/components/bolsa`); los componentes solo pintan.
4. **Clima exogeno, decision endogena.** La hidrologia (embalse, aportes) viene
   del dato real; los agentes deciden. No simules el clima.
5. **Mensual, GWh/mes y COP/kWh.** Horizonte 2020-2025 (72 meses). No vuelvas a
   granularidad horaria en BOLSA.
6. **Nada derivado del azar en el primer render.** `createMarket` es
   determinista; el estado inicial coincide servidor y navegador.

## Invariantes del backend FastAPI (`api/`)

1. **El dominio no conoce infraestructura.** `api/app/domain` no importa
   TypeSafe, Mongo ni PostgreSQL: solo depende de `api/app/ports.py`.
2. **Puertos + adaptadores.** Los adaptadores viven en `api/app/adapters/` y se
   inyectan en `api/app/container.py` (unico sitio que decide TypeSafe/Mongo/XM).
3. **Fuente embebida = sin DB.** `EmbeddedDataSource` corre sin PostgreSQL y
   sirve de doble; `ElecdbDataSource` lee el MEM real. No rompas ese respaldo.
4. **Tests con dobles.** `.venv/bin/pytest -q` no depende de red ni de DB: usa
   dobles de `ModelGateway`/`SessionRepository` (`api/tests/`).
5. **Secretos en `.env`.** La clave vive en el entorno, nunca en el codigo ni en
   el repo (`api/.env.example` documenta las variables).

## Flujo de trabajo

- **Bolitas / BOLSA (TS)**: antes de dar algo por terminado, `npm run verify`
  (typecheck, lint y tests). Si tocaste el cliente o el arranque, anade
  `npm run build` y comprueba la pagina en un navegador de verdad: hay fallos
  (hidratacion, WebGL, audio) que el build no ve.
- **Backend FastAPI**: `cd api && .venv/bin/pytest -q`. Para levantarlo:
  `.venv/bin/uvicorn app.main:app --reload --port 8000`.
- El README documenta numeros comprobados (deriva de la prediccion, tests de
  paso, tamano del chunk de Phaser). Si cambias el comportamiento, actualiza el
  numero o el test; no dejes la afirmacion vieja.
- Dependencias: `CONTRIBUTING.md` pide no anadir ninguna si `src/lib` ya lo
  resuelve. Phaser es la excepcion deliberada y esta acotada a
  `src/lib/client/board/`. En Python, las dependencias viven en
  `api/requirements.txt`.

## Skills del proyecto (usalas por iniciativa propia)

- **`elecdb`**: el MEM real (PostgreSQL de XM). Para datos, series y esquema; el
  adaptador `api/app/adapters/elecdb.py` y `docs/mem/*.sql` lo consumen.
- **`creg-ai-client`**: regulacion CREG (precio de escasez, OEF, cargos). Para
  parametros y mecanismos; cita la resolucion.
- **`jev-gateway`**: juicio estructurado barato (clasificar, elegir entre
  candidatos, puntuar). Es tambien el modelo que decide en los dos juegos.
- Regla: recupera el dato en codigo primero y pide a la skill solo el juicio que
  queda. No le pidas aritmetica, fechas ni lo que este fuera del `state`.

## Estilo

- TypeScript estricto y Python con type hints: si `tsc`/`pytest` se quejan, no
  hay discusion.
- Comentarios y textos de UI en espanol **sin tildes** (se leen mejor en
  consola); `README.md`, `CONTRIBUTING.md` y los informes si llevan tildes.
- Los comentarios explican el **por que** (una decision, un limite, una trampa),
  no el que.
- Nada de codigo muerto: si reemplazas un modulo, borralo y actualiza las
  referencias (asi se fueron `src/lib/client/renderer.ts`, `audio.ts`,
  `src/server/bolsa.ts` y los modulos `agents.ts`/`dispatch.ts` de BOLSA).

## Mapa rapido

| Si vas a tocar... | Mira primero |
| --- | --- |
| Reglas, muerte, saque (bolitas) | `src/lib/game/engine.ts` |
| Choques y rebotes (bolitas) | `src/lib/game/world.ts` (planck) y `src/lib/game/physics.ts` |
| Lo que ve el modelo (bolitas) | `src/lib/game/prompt.ts`, `src/lib/ai/contracts.ts` |
| Dibujo, particulas, camara, audio | `src/lib/client/board/` |
| React, HUD y atajos (bolitas) | `src/components/`, `src/hooks/` |
| Peticiones al modelo y costos (bolitas) | `src/server/trace.ts`, `src/lib/ai/pricing.ts`, `docs/PLAN-FRONTEND.md` |
| API y TypeSafe (bolitas) | `src/app/api/*`, `src/server/` |
| Dominio y motor de BOLSA | `src/lib/bolsa/` |
| Backend TS de BOLSA | `src/server/bolsa/`, `src/app/api/bolsa/*` |
| Frontend de BOLSA | `src/lib/client/bolsa/`, `src/hooks/useBolsa.ts`, `src/components/bolsa/` |
| Backend FastAPI del MEM | `api/app/` (puertos, adaptadores, servicios) |
| Planes e informes | `docs/bolsa/`, `docs/bolitas/`, `docs/mem/` |

## Informes ejecutivos

- Cuando el usuario pida un **informe ejecutivo**, no basta con datos: cada
  seccion termina con **Conclusion**, **Tips** y **Advertencias** (anade
  **Riesgos** o **Recomendaciones** si aportan). Un informe sin esos bloques no
  es un informe ejecutivo.
- El informe abre con veredicto y una linea de "como leerlo", y cierra con
  conclusiones generales y recomendaciones antes del anexo de datos crudos.
- Cada cifra se puede recalcular (script o consulta citada); los juicios van
  siempre pegados a su dato.
