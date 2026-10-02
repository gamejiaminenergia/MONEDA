# Contribuir

Gracias por mirar esto. Es un proyecto chico: con que `npm run verify` pase y
la partida siga teniendo sentido, alcanza.

## Levantar el proyecto

```bash
npm install
cp .env.example .env.local
npm run dev
```

Ollama es opcional: con `estrategia: solo heurístico` el juego funciona sin
modelo y sin GPU, que es la forma rapida de probar cambios de fisica o de UI.

## Antes de mandar un PR

```bash
npm run verify   # tipos + lint + tests
npm run build
```

Si el cambio toca fisica, prediccion o reglas, agrega un test en `tests/`. Los
tests corren en Node y no necesitan navegador ni Ollama.

## Como esta armado

La regla es una sola: **el motor no sabe que existe un navegador y el navegador
no sabe que existe Ollama.**

- `src/lib/game/world.ts` — la mesa sobre planck.js (Box2D). Choques, muros,
  prediccion de llegada.
- `src/lib/game/engine.ts` — vidas, muerte, saque, rallies. Sin DOM ni red.
- `src/lib/game/prompt.ts` — el texto que recibe el modelo, con la regla de
  muerte y las vidas de los cuatro equipos.
- `src/lib/ai/` — contratos con zod, normalizacion de respuestas y el
  heuristico local que sirve de respaldo.
- `src/app/api/` — lo unico que habla con Ollama.
- `src/lib/client/` + `src/components/` — canvas, audio y React.

## Estilo

- TypeScript estricto: si `tsc` se queja, no hay discusion.
- Comentarios y textos de UI en espanol sin tildes, igual que el resto del
  codigo; se leen mejor en una consola.
- Nada de dependencias nuevas si `src/lib` ya resuelve el problema en 40 lineas.
