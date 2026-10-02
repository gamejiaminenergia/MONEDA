# Plan: Nimble Fuga profesional + consola del modelo y costos

Estado: **ejecutado**. Las seis fases estan implementadas y verificadas.
Fecha: 2026-10-02.
Contexto: TypeSafe es el unico proveedor y ya no hay muerte subita.

## Estado de ejecucion

| Fase | Que era | Estado |
| --- | --- | --- |
| 0 | Tokens y cimientos visuales | hecho: `globals.css` reescrito con tokens, foco visible y `prefers-reduced-motion` |
| 1 | Instrumentacion | hecho: `src/lib/ai/pricing.ts`, `src/server/trace.ts`, `/api/trace`, escritura desde `/api/decision` |
| 2 | Shell y layout | hecho: `GameShell` rearmado en `topbar / arena (jugadores · mesa · panel) / controles` |
| 3 | Componentes | hecho: `TopBar`, `PlayerRail`, `LiveStats`, `ModelPanel`, `GameControls` y `Stage` nuevos |
| 4 | Game feel | hecho: cartel de ronda por animacion con `key`, cartel de ganador rediseñado, aviso de reconexion |
| 5 | Consola del modelo y costos | hecho: `ModelConsole` con lista, detalle, exportar, limpiar y resumen |
| 6 | Responsive, accesibilidad y QA | hecho: tres cortes, foco visible, `aria`, verificado en Chrome real |

Numeros medidos en la verificacion final: ~3.000-3.500 tokens de entrada por
decision, ~230-450 ms de latencia, **$0,00012-$0,00015 por decision** y una
proyeccion de **$0,65-$1,05 por hora** decidiendo cada 700 ms.

Este documento es el plan de trabajo. Cada fase se puede entregar y verificar
por separado; ninguna toca el motor (`src/lib/game`), que sigue siendo la
fuente de verdad y el unico sitio donde viven las reglas.

---

## 1. Objetivo

Convertir la interfaz en algo que se vea y se sienta como un juego comercial, y
dar visibilidad total a lo que se le pide a TypeSafe: la peticion exacta, la
respuesta, los tokens y el costo.

### Criterios de exito

1. La mesa ocupa la pantalla y el HUD se ancla alrededor sin robarle espacio
   (hoy todo es una columna de paneles).
2. Un desconocido entiende que pasa en la partida en menos de 3 segundos:
   quien vive, quien murio, por que, y de quien fue la decision.
3. Se puede abrir una consola y ver, para cada decision: el `state` enviado,
   las `questions`, la respuesta cruda, la jugada normalizada, los tokens y el
   costo en dolares.
4. El costo de la sesion esta siempre visible y hay un total acumulado.
5. La app se siente rapida y viva: transiciones, sonido y feedback de impacto.
6. `npm run verify` y `npm run build` en verde, sin errores de hidratacion.

### Anti-objetivos

- No se reescribe el motor ni la fisica.
- No se anade un proveedor local ni un respaldo heuristico (decision tomada).
- No se anade una libreria de UI: el proyecto prefiere cero dependencias nuevas.

---

## 2. Punto de partida

Hoy el juego es correcto pero la UI es "de panel de control":

- Todo el juego vive en una columna (`#app > .layout`): titulo, marcador, mesa,
  tarjetas de los diez jugadores, barra de estadisticas, comparativa, controles
  y debug, apilados y con scroll.
- La mesa es un canvas cuadrado metido en una caja, no el protagonista.
- El estado del modelo es una linea de texto (`conectado · jev-latest · 207 ms`)
  y el detalle solo aparece en el panel de debug, como texto crudo.
- No hay jerarquia visual de eventos: una muerte pesa lo mismo que un rebote.
- Los controles (`select`, `range`, botones) tienen estilos de formulario.

El motor, en cambio, ya expone todo lo necesario: `engine.view()` para dibujar y
`engine.ui()` como snapshot estable para React.

---

## 3. Direccion de arte propuesta

Recomendacion: **broadcast esports / neon sobrio**. Mantiene la identidad actual
(fondo azul noche, diez colores, cyan como acento) y es lo que mejor combina con
una mesa de datos y un modelo decidiendo en vivo.

Principios:

- **La mesa manda.** Fondo casi negro, mesa centrada, HUD en los bordes.
- **Un dato, un lugar.** Marcador arriba, controles abajo, jugadores a un lado
  (o debajo en movil), consola del modelo en un cajon que se abre.
- **Tipografia con jerarquia.** Display condensada para titulos y numeros
  grandes; monoespaciada solo para datos tecnicos (tokens, costo, JSON).
- **Color = identidad + estado.** Los diez colores son de los jugadores; cyan
  para el modelo, rojo solo para muerte/error, ambar para avisos.
- **Movimiento con proposito.** Entradas y salidas cortas (120-220 ms), golpes
  con hit-stop, transiciones de ronda. Nada de animar por animar.
- **Todo dibujado en codigo.** Sin assets binarios (invariante del repo): CSS,
  canvas y Phaser. Si se quisiera un logo o textura, hay que decidirlo aparte.

Variantes si no convence: (a) minimalista premium tipo ajedrez, (b) arcade
retro CRT. Las dos se pueden montar sobre los mismos tokens.

---

## 4. Arquitectura de UI propuesta

Sin frameworks nuevos. CSS Modules o `globals.css` con tokens, y componentes
React pequenos.

```
#app                         pantalla completa (grid 3x3)
├── HUD superior             titulo · ronda · marcador · estado del modelo
├── HUD izquierdo            tarjetas de los 10 jugadores (colapsables)
├── Escenario                mesa Phaser, centrada, escala responsive
│   └── Overlays             cuenta atras · ganador · sin conexion · pensando
├── HUD derecho              metricas en vivo · costo de la sesion
├── HUD inferior             controles de partida
└── Consola del modelo       cajon inferior con peticiones, respuestas y costos
```

- **Tokens de diseno** en `src/app/globals.css`: escala tipografica, espaciado,
  radios, sombras, colores de estado y `--motion-*`.
- **Escalado de la mesa**: el `ScaleManager` de Phaser ya estira el canvas; solo
  hay que darle una caja que crezca con el viewport en vez de una caja fija.
- **Estado de UI**: `useSyncExternalStore` sigue siendo el puente con el motor.
  La consola del modelo se alimenta de una tienda nueva (ver fase 1).
- **Responsive**: tres cortes claros (desktop ancho, laptop, movil vertical) con
  el HUD reorganizado, no solo encogido.

---

## 5. El requisito importante: ver peticiones y costos

### 5.1 Que se quiere ver

Para cada decision enviada a TypeSafe:

- hora exacta y numero de decision dentro de la partida;
- modelo pedido y modelo que respondio (`jev-latest` -> `jev-1.13.0`);
- el `state` completo que se envio (el prompt en espanol);
- las `questions` (una por jugador vivo, con sus `criteria`);
- la respuesta cruda (`choice`, `probabilities`, `confidence`, `type`);
- la jugada normalizada que entro al motor;
- latencia, `input_tokens`, `output_tokens` y **costo**;
- si fallo: codigo y mensaje.

Y un resumen de sesion: peticiones, tokens de entrada, costo acumulado, latencia
media, costo por minuto proyectado y costo por ronda.

### 5.2 Datos reales de precio (verificados)

De la documentacion oficial (`docs.typesafe.ai/models`, Jev 1.13):

- **$42 por Btok = $0,042 por millon de tokens de entrada.**
- **Los tokens de salida son gratis.**
- Limites: 100k tokens/s y 40 peticiones/s; contexto de 64k (32k para el
  `state` mas la pregunta mas larga).

Cuentas con lo medido en este repo (prompt ~3.500 tokens de entrada por
decision, 10 preguntas en una sola peticion):

| Unidad | Tokens entrada | Costo |
| --- | --- | --- |
| 1 decision | 3.500 | $0,000147 |
| 1 ronda (~10 decisiones) | 35.000 | ~$0,0015 |
| 1.000 decisiones | 3,5 M | $0,147 |
| 1 hora decidiendo cada 700 ms | 18 M | ~$0,75 |

Consecuencia de diseno: el costo lo domina el **prompt reenviado**, no la
salida. Las palancas para bajarlo son: acortar el `state`, decidir menos
seguido y compactar el estado en JSON en vez de frases. La consola debe mostrar
el costo por decision y por hora para que esas decisiones se tomen con datos.

### 5.3 Diseno tecnico

Todo en el servidor; la clave y la URL nunca llegan al navegador.

**Captura** (`src/server/trace.ts`, nuevo):

- Buffer circular en memoria (configurable, por defecto ~200 registros).
- Se escribe desde `/api/decision` (exito y error) con el mismo `usage` que ya
  devuelve TypeSafe.
- Nunca guarda la `Authorization` ni la clave. Solo el cuerpo del juego.
- No persiste a disco: si el proceso reinicia, se limpia.
- Aviso: en un despliegue serverless con varias instancias el buffer es por
  instancia. Para ver el historico completo haria falta SQLite/Postgres (esta
  en "proximos pasos" del README).

**Precio** (`src/lib/ai/pricing.ts`, nuevo, puro y testeable):

- Tabla por modelo versionado con `inputPerMTok` y `outputPerMTok`.
- `costOf(usage, model)` y `formatUsd(value)`.
- Si el modelo no esta en la tabla, se muestra "sin precio" en vez de inventar.

**API** (nuevo `src/app/api/trace/route.ts`):

- `GET /api/trace?limit=50` -> `{ records, summary }`.
- `DELETE /api/trace` -> limpia el buffer.
- El resumen incluye tokens, costo, latencia media y proyeccion por hora.

**UI** (`src/components/ModelConsole.tsx`, nuevo):

- Columna a la derecha en pantallas anchas (el HUD y la mesa se encogen; el
  panel de estadisticas cede su sitio) y cajon inferior en pantallas estrechas.
- Dentro: resumen de costo, lista de peticiones y detalle con pestanas de
  **json peticion**, **prompt**, **json respuesta** y **jugadas**.
- Se abre con una tecla (`C`) y desde el HUD. Recuerda si estaba abierta.
- Filtros: solo errores, solo la ronda actual, buscar por jugador.
- Exportar la sesion a JSON/CSV.

**Privacidad**: el inspector muestra prompts de tu propia partida. Se puede
apagar con un ajuste (`settings.trace`) para quien no quiera ni siquiera
guardarlos en memoria.

### 5.4 En vivo

`GET /api/trace/stream` con Server-Sent Events: el modulo de traza avisa a sus
suscritos en cada peticion y el stream empuja el estado completo. La consola lo
consume con `EventSource` (reconexion automatica del navegador) y el HUD sigue
sondeando solo el resumen cada 3 s, que es barato. Si algun dia hay varias
instancias, el buffer y el stream tendran que salir del proceso (SQLite/Redis),
pero el contrato de datos no cambia.

---

## 6. Fases

Cada fase deja el repo verde (`npm run verify`, y `npm run build` si toca UI).

### Fase 0 — Cimientos visuales

- Tokens de diseno en `globals.css` (tipografia, espaciado, radios, sombras,
  estados, duraciones) y limpieza de estilos sueltos.
- `prefers-reduced-motion` respetado desde el inicio.
- Sin cambios de layout todavia: se aplica la piel a lo que ya existe.

### Fase 1 — Instrumentacion (sin UI todavia)

- `src/lib/ai/pricing.ts` + tests.
- `src/server/trace.ts` con buffer, resumen y costo + tests.
- `/api/trace` (GET/DELETE) y escritura desde `/api/decision`.
- Ajuste `trace` en `settings.ts` (default activado).

Entregable verificable por API, antes de tocar el diseno.

### Fase 2 — Shell y layout de juego

- Reemplazar `GameShell` por un `AppShell` con el grid del punto 4.
- La mesa pasa a ser el centro y escala con el viewport.
- HUD superior (ronda, marcador, estado del modelo) e inferior (controles).
- Overlays de estado: cuenta atras, ganador, sin conexion, pensando.

### Fase 3 — Rediseno de componentes

- `Standings` -> marcador broadcast con los diez jugadores como chips.
- `TeamCard` -> tarjeta compacta con color, jugada, confianza y amenaza.
- `StatsBar` -> metricas en vivo con jerarquia (no una fila de cajas iguales).
- `ControlBar` -> controles de juego (no de formulario): segmentos, slider
  estilizado, botones con icono.
- `ModelBoard` -> comparativa por modelo integrada al HUD.

### Fase 4 — Game feel

- Entrada de ronda, salida del ganador y transicion entre rondas.
- Feedback de muerte (destello, particulas, shake corto, hit-stop).
- Aviso de amenaza por jugador (ya existe el dato) dibujado en la mesa.
- Mezcla de audio, ducking y estados de silencio.

### Fase 5 — Consola del modelo y costos (UI)

- `ModelConsole` sobre la API de la fase 1.
- Costo de sesion siempre visible en el HUD; detalle en el cajon.
- Exportar sesion; limpiar buffer; filtros.

### Fase 6 — Responsive, accesibilidad y QA

- Tres cortes responsive reales, no solo encoger.
- Foco visible, navegacion por teclado, contraste, `aria` en overlays.
- Prueba en navegador real (hidratacion, WebGL, audio) en cada corte.
- Repaso final de README y de este plan.

---

## 7. Invariantes que no se tocan

1. El motor no conoce el navegador ni la red.
2. El navegador no habla con TypeSafe ni ve la clave.
3. Phaser es presentacion; reglas y prediccion viven en `src/lib/game`.
4. Motor deterministico (`options.random`).
5. Nada derivado del azar en el primer render (`useEngineUi`).
6. Phaser solo en el cliente y destruido en el cleanup.
7. Sin assets binarios.

---

## 8. Riesgos y decisiones abiertas

- **Sin muerte subita, una ronda puede no terminar.** Hoy el modelo mata rapido
  (rondas de ~6 s), pero conviene decidir que hacer si una ronda se eterniza:
  dejarla correr, avisar en el HUD, o un limite de tiempo solo visual.
- **Buffer en memoria.** Suficiente para ver la sesion; no es historico. Si se
  quiere comparar partidas hace falta persistencia.
- **Costo por hora.** A 700 ms y ~3,5k tokens por decision son ~$0,75/hora. Si
  se sube la frecuencia o crece el prompt, crece linealmente con los tokens de
  entrada.
- **Assets.** Un look comercial podria pedir logo/texturas; hoy el repo es
  "todo dibujado por codigo". Cambiarlo es una decision explicita.
- **Idioma del prompt.** Jev esta entrenado principalmente en ingles; el prompt
  va en espanol. Vale la pena medir si un `state` en ingles mejora las jugadas
  y abarata tokens (menos palabras).

---

## 9. Definicion de terminado

- `npm run verify` y `npm run build` en verde.
- Partida completa verificada en navegador real, sin errores de consola.
- Se ve, para cada decision, peticion, respuesta, tokens y costo.
- El costo de la sesion se entiende de un vistazo.
- Ninguna fase rompe las invariantes del punto 7.
