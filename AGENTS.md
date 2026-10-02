<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Nimble Pong: guia para agentes

Diez corredores huyen de una bola que mata; cada jugada la decide la API System
One de TypeSafe. Antes de tocar codigo, lee `README.md`, en especial
"Como esta organizado" y "Cambios de fondo frente al prototipo": ahi esta el por
que de casi todo lo que hay aqui.

## Invariantes

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

## Flujo de trabajo

- Antes de dar algo por terminado: `npm run verify` (typecheck, lint y tests).
  Si tocaste el cliente o el arranque, anade `npm run build` y comprueba la
  pagina en un navegador de verdad: hay fallos (hidratacion, WebGL, audio) que
  el build no ve.
- El README documenta numeros comprobados (deriva de la prediccion, tests de
  paso, tamano del chunk de Phaser). Si cambias el comportamiento, actualiza el
  numero o el test; no dejes la afirmacion vieja.
- Dependencias: `CONTRIBUTING.md` pide no anadir ninguna si `src/lib` ya lo
  resuelve. Phaser es la excepcion deliberada y esta acotada a
  `src/lib/client/board/`.

## Estilo

- TypeScript estricto: si `tsc` se queja, no hay discusion.
- Comentarios y textos de UI en espanol sin tildes (se leen mejor en consola);
  `README.md` y `CONTRIBUTING.md` si llevan tildes.
- Los comentarios explican el **por que** (una decision, un limite, una trampa),
  no el que.
- Nada de codigo muerto: si reemplazas un modulo, borralo y actualiza las
  referencias (asi se fueron `src/lib/client/renderer.ts` y `audio.ts`).

## Mapa rapido

| Si vas a tocar... | Mira primero |
| --- | --- |
| Reglas, muerte, saque | `src/lib/game/engine.ts` |
| Choques y rebotes | `src/lib/game/world.ts` (planck) y `src/lib/game/physics.ts` |
| Lo que ve el modelo | `src/lib/game/prompt.ts`, `src/lib/ai/contracts.ts` |
| Dibujo, particulas, camara, audio | `src/lib/client/board/` |
| React, HUD y atajos | `src/components/`, `src/hooks/` |
| Peticiones al modelo y costos | `src/server/trace.ts`, `src/lib/ai/pricing.ts`, `docs/PLAN-FRONTEND.md` |
| API y TypeSafe | `src/app/api/*`, `src/server/` |
