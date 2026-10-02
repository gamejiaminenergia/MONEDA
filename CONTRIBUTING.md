# Contribuir

Gracias por mirar esto. Es un proyecto chico: con que `npm run verify` pase y
la partida siga teniendo sentido, alcanza.

## Levantar el proyecto

```bash
npm install
cp .env.example .env.local
npm run dev
```

El unico proveedor es TypeSafe: pon `TYPESAFE_API_KEY` en `.env.local` y listo.
Sin clave el servidor levanta, pero no hay jugadas: no queda respaldo local.

## Antes de mandar un PR

```bash
npm run verify   # tipos + lint + tests
npm run build
```

Si el cambio toca fisica, prediccion o reglas, agrega un test en `tests/`. Los
tests corren en Node, sin navegador ni red.

## Como esta armado

La regla es una sola: **el motor no sabe que existe un navegador y el navegador
no sabe que existe TypeSafe.**

- `src/lib/game/world.ts` — la mesa sobre planck.js (Box2D). Choques, muros,
  prediccion de llegada.
- `src/lib/game/engine.ts` — vidas, muerte, saque, rallies. Sin DOM ni red.
- `src/lib/game/prompt.ts` — el texto que recibe el modelo, con la regla de
  muerte y el estado de los diez jugadores.
- `src/lib/ai/` — contratos con zod y normalizacion de respuestas.
- `src/app/api/` y `src/server/` — lo unico que habla con TypeSafe.
- `src/lib/client/board/` — la escena de Phaser 4: dibujo, particulas, camara y
  audio. Avanza el motor y sincroniza la mesa con `engine.view()`.
- `src/lib/client/` + `src/components/` — bucle de decisiones, stores y React.

## Estilo

- TypeScript estricto: si `tsc` se queja, no hay discusion.
- Comentarios y textos de UI en espanol sin tildes, igual que el resto del
  codigo; se leen mejor en una consola.
- Nada de dependencias nuevas si `src/lib` ya resuelve el problema en 40 lineas.
