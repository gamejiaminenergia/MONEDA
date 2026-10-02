# Nimble Pong — Cuatro equipos (Next.js + TypeScript)

[![CI](https://github.com/USUARIO/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/USUARIO/REPO/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Pong de cuatro equipos —izquierda, derecha, arriba y abajo— en el que cada
jugada la decide un modelo local servido por Ollama. Cada equipo tiene dos
paddles y **10 vidas: al perder la ultima, el equipo muere**, sus paddles
desaparecen y su pared queda sellada. Gana el ultimo que siga vivo.

![Cuatro equipos jugando en una mesa cuadrada](docs/screenshot.png)

La regla de muerte viaja en cada prompt: todos los equipos reciben, en cada
decision, cuantas vidas le quedan a cada uno y quien esta al borde de morir.

Es la version "de verdad" del prototipo de un solo archivo: mismo juego, misma
estetica, pero con motor, red y UI separados y tipados de punta a punta.

El concepto original quedo guardado sin tocar en `legacy/concept.html` para
poder comparar.

## Arrancar

Requiere Node 20.9 o superior (`nvm use` respeta el `.nvmrc`).

```bash
npm install
cp .env.example .env.local   # opcional: ajusta OLLAMA_URL / OLLAMA_MODEL
npm run dev                  # http://localhost:3000
```

Necesitas Ollama corriendo (`ollama serve`) y el modelo que quieras usar
(por defecto `nimble`). Si no lo tienes, la app igual funciona: cae al
controlador heuristico local y te avisa en la barra de estado.

Scripts: `npm run dev`, `build`, `start`, `typecheck`, `lint`, `test`, y
`npm run verify` que corre los tres ultimos.

## Como esta organizado

La regla es simple: **el motor no sabe que existe un navegador, y el navegador
no sabe que existe Ollama.**

| Capa | Carpeta | Que hace |
| --- | --- | --- |
| Fisica | `src/lib/game/world.ts` | La mesa sobre planck.js: integracion, choques, prediccion. |
| Motor | `src/lib/game` | Reglas, vidas, muerte y eventos. TypeScript puro, testeable. |
| Prompt | `src/lib/game/prompt.ts` | Convierte el estado en el texto en espanol + las preguntas. |
| IA | `src/lib/ai` | Contratos (zod), normalizacion de la respuesta, heuristico local. |
| Servidor | `src/server/ollama.ts`, `src/app/api/*` | Habla con Ollama. El navegador nunca lo hace. |
| Cliente | `src/lib/client` | Renderer de canvas, audio, bucle de decisiones, stores. |
| UI | `src/components`, `src/hooks` | React solo pinta; el juego corre fuera de React. |

### Cambios de fondo frente al prototipo

0. **Cuatro equipos y regla de muerte.** La mesa es cuadrada (720x720) para que
   las cuatro paredes sean iguales. Los equipos de los lados mueven sus paddles
   en vertical (`subir`/`bajar`); los de arriba y abajo, en horizontal
   (`izquierda`/`derecha`). Cada derrota cuesta una vida; al perder la ultima el
   equipo muere, sus paddles se destruyen y su pared se sella con un muro real
   dentro de la fisica. La prediccion de llegada deja de simular en el primer
   plano que la bola alcanza: si no es el del equipo que pregunta, la bola no
   viene hacia el y sus paddles se quedan donde estan.
1. **El navegador ya no llama a Ollama.** Todo pasa por `POST /api/decision`.
   Eso elimina el baile de CORS (`OLLAMA_ORIGINS`), deja la URL del modelo en el
   servidor y permite validar y normalizar la respuesta antes de que llegue al
   juego.
2. **Motor separado del render.** `GameEngine` avanza con `step(dtMs)` y devuelve
   eventos; el canvas solo dibuja. Se puede testear el juego sin navegador ni red.
3. **La fisica no es casera.** Corre sobre [planck.js](https://piqnt.com/planck.js/)
   (el port de Box2D a TypeScript): deteccion continua de colisiones (`bullet`),
   paso fijo de 1/60 y contactos reales. Eso compra tres cosas que el
   integrador a mano no daba:
   - **La trayectoria no depende del frame.** A 8 ms o a 25 ms por frame el
     resultado es el mismo (`tests/engine.test.ts`); antes, un frame lento
     cambiaba el punto de rebote.
   - **La bola no atraviesa un paddle** ni a 80 m/s (`tests/world.test.ts`).
   - **La prediccion y el juego usan la misma fisica.** `predictArrivalY()`
     simula el vuelo en un mundo clon sin paddles, asi que la altura que se le
     manda al modelo es exactamente la que el juego va a producir, no una
     formula paralela que puede desincronizarse.

   El motor de juego sigue decidiendo las reglas (a que altura sale la bola
   tras un golpe, cuando es punto, cuando es rally): Box2D resuelve la colision,
   el juego decide que significa. La escala es de 100 px por metro y hay que
   bajar `Settings.velocityThreshold` porque la bola es lenta (1.9 m/s) y con el
   valor por defecto de Box2D los golpes suaves no rebotan.
4. **Respuestas validadas.** El modelo contesta texto libre; zod y
   `normalizeDecision()` lo convierten en dos jugadas concretas con
   probabilidades saneadas. Si la respuesta viene rara, el juego no se rompe.
5. **Respaldo heuristico.** Si Ollama no responde o tarda demasiado, entra un
   controlador local que cubre la llegada y separa el paddle libre. Nunca se cae
   la partida, y sirve de linea base para comparar contra el modelo.
6. **React no corre a 60 fps.** El canvas se dibuja en su propio
   `requestAnimationFrame`; React solo se vuelve a renderizar cuando cambia algo
   de verdad (`useSyncExternalStore` sobre el motor).
7. **Phaser fuera.** Se reemplazo por un renderer de Canvas 2D propio: pesa
   mucho menos, no pelea con SSR y el mismo look (estela, ondas, sacudida) vive
   en un solo archivo de ~200 lineas. Si quieres volver a Phaser, el punto de
   corte es `src/lib/client/renderer.ts`.
8. **La mesa usa el ancho disponible.** El motor sigue pensando en 960x560,
   pero el renderer mide su caja real (ResizeObserver) y ajusta el buffer a los
   pixeles de pantalla, asi que se ve nitida a cualquier tamano. El ancho de la
   mesa se corta siempre contra la altura de la ventana para que la cancha
   nunca se salga de cuadro; cuando ademas sobra ancho, el panel se pone al
   lado y no hay que hacer scroll.

## API

| Ruta | Metodo | Descripcion |
| --- | --- | --- |
| `/api/health` | GET | Estado del servidor y configuracion efectiva de Ollama. |
| `/api/models` | GET | Modelos instalados. Nunca falla: informa `reachable: false`. |
| `/api/decision` | POST | Recibe el snapshot del juego y devuelve la jugada de cada lado. |

`POST /api/decision` recibe `{ snapshot, model?, strategy? }` y responde:

```json
{
  "model": "nimble",
  "strategy": "model",
  "latencyMs": 2262,
  "sides": {
    "left": {
      "choice": "subir|subir",
      "moves": ["subir", "subir"],
      "probabilities": { "subir|subir": 0.38 },
      "marginals": [
        { "subir": 0.86, "bajar": 0.06, "izquierda": 0, "derecha": 0, "quedarse": 0.08 },
        { "subir": 0.41, "bajar": 0.18, "izquierda": 0, "derecha": 0, "quedarse": 0.41 }
      ],
      "confidence": 0.33,
      "source": "model"
    },
    "top": {
      "choice": "izquierda|derecha",
      "moves": ["izquierda", "derecha"],
      "...": "los equipos de arriba y abajo solo se mueven de lado"
    },
    "right": { "...": "..." },
    "bottom": { "...": "..." }
  },
  "usage": { "inputTokens": 1282, "outputTokens": 3 },
  "fallbackReason": null
}
```

`sides` solo trae los equipos que seguian vivos cuando se hizo la pregunta; el
prompt lleva las vidas de los cuatro y la regla de muerte.

`strategy` acepta `auto` (default: intenta el modelo y cae al heuristico),
`model` (solo modelo; devuelve 502 si falla) o `heuristic` (sin LLM).

## Variables de entorno

| Variable | Default | Descripcion |
| --- | --- | --- |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Servidor de Ollama. |
| `OLLAMA_MODEL` | `nimble` | Modelo por defecto si el cliente no manda uno. |
| `OLLAMA_TIMEOUT_MS` | `30000` | Corte por decision lenta. |
| `DECISION_STRATEGY` | `auto` | Estrategia por defecto. |

## Controles

`espacio` pausa · `R` reiniciar · `M` sonido · `D` debug (estado enviado y
respuesta completa del servidor).

En el panel inferior puedes cambiar de modelo, elegir estrategia, ajustar cada
cuanto se decide, y borrar la comparativa acumulada por modelo (se guarda en
`localStorage`).

## Tests

```bash
npm test
```

40 pruebas sobre la fisica (rebote elastico, llegada prevista contra llegada
real —tambien en los equipos de arriba y abajo—, bola rapida contra un paddle,
muro de un equipo muerto), el motor (vidas, muerte, ultimo en pie, rallies,
pausa, independencia del tamano del frame), el armado del prompt (la regla de
muerte y las vidas de los cuatro equipos) y la normalizacion de las respuestas.

## Proximos pasos

- Mover el motor al servidor y sincronizar por WebSocket para partidas
  multijugador autoritativas.
- Guardar el historico de partidas y latencias en SQLite/Postgres en vez de
  `localStorage`, con un panel de comparacion entre modelos.
- Variantes de prompt por modelo (`src/lib/game/prompt.ts` es el unico lugar a
  tocar).
- Modo espectador: varios modelos decidiendo a la vez sobre la misma mesa.
- **Acelerar la bola con cada rally.** Con dos equipos defendiendo bien, una
  partida a 10 vidas puede alargarse mucho: subir la velocidad tras N golpes
  (o meter un limite de rally) resuelve el empate eterno.
- Revivir equipos o dar vidas por comida: hoy la muerte es definitiva y solo se
  vuelve con "reiniciar".

## Subir este repositorio a GitHub

El repositorio ya esta inicializado en la rama `main`. Antes del primer push,
cambia dos cosas:

- el titular del copyright en [`LICENSE`](LICENSE), si el proyecto no es tuyo a
  titulo personal;
- `USUARIO/REPO` en el badge de arriba, por tu usuario y nombre de repositorio.

```bash
git add -A
git commit -m "Nimble Pong: cuatro equipos, 10 vidas y muerte definitiva"
git remote add origin git@github.com:USUARIO/REPO.git
git push -u origin main
```

Si prefieres HTTPS: `git remote add origin https://github.com/USUARIO/REPO.git`.

## Licencia

MIT. Ver [`LICENSE`](LICENSE).
