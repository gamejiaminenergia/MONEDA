# Plan: informe ejecutivo — ¿son altruistas las bolitas de colores?

Estado: **ejecutado**.
Fecha: 2026-10-11.
Fuente: `matches` de MongoDB (`nimble`), historico del juego.

## Estado de ejecucion

| Fase | Que era | Estado |
| --- | --- | --- |
| 0 | Definicion operativa y anti-objetivos | hecho: la tesis queda falsable (seccion 2) |
| 1 | Script de analisis | hecho: `docs/bolitas/scripts/analisis-altruismo.js` corre sobre `nimble` |
| 2 | Redaccion del informe | hecho: `docs/bolitas/INFORME-ALTRUISMO.md` con veredicto, evidencia, limites y anexo |
| 3 | Verificacion | hecho: los numeros del informe salen de la salida del script |

## 1. Objetivo

Refutar con datos la tesis **«las bolitas de colores son altruistas / se ayudan
entre si»** a partir del historico de partidas, y entregarlo como un informe
ejecutivo reproducible. La conclusion no se afirma: se demuestra con la
evidencia que ya guarda el juego.

### Definicion operativa

**Acto altruista** = una jugada de un jugador que **beneficia a otro jugador**
y **a costa de su propio interes**. Si no hay beneficio para otro, o no hay
costo propio, no es altruismo: es conducta (cooperativa, gregaria o de huida).
Sin esta definicion la tesis no es falsable y el informe no podria refutarla.

### Criterios de exito

1. Todo numero del informe sale de la coleccion `matches` y se puede regenerar
   con un solo comando.
2. Cada afirmacion tiene su evidencia: conteo, o cita del codigo cuando la
   prueba es estructural.
3. Se declaran los **limites**: que la base mide conducta y no intencion.
4. El informe se lee en 3 minutos y el detalle queda en un anexo.

### Anti-objetivos

- No se inventan metricas no guardadas ni se piden datos que la corrida no tiene.
- No se toca el motor ni la app: esto es solo analisis y documentacion.
- No se mezclan opiniones con cifras: cada juicio va pegado a su dato.

## 2. Fuente y alcance

| Campo | Valor |
| --- | --- |
| Coleccion | `matches` (base `nimble`) |
| Conexion de la corrida | `mongodb://jev:jevpass@localhost:27018/nimble` (contenedor `nimble-mongo`) |
| Rondas | 36, todas `jev-latest` |
| Parametros | `intervalMs 700`, `ballSpeed 840`, `runnerSpeed 300`, `survivalMs 60000` |

Cada documento trae `samples` (mesa cada 200 ms), `decisions` (turno con `moves`
y `probabilities`), `events` (`wall`/`serve`/`kill`/`death`/`over`) y `modelCalls`
(peticion y respuesta crudas de Jev).

## 3. Metodo: tres bloques de evidencia

### Bloque A — estructural (¿puede existir un acto altruista?)

- **A1. Agencia unica.** Comparar `decisions` con `modelCalls` (1:1) y contar en
  que fraccion la respuesta trae exactamente una jugada por jugador vivo.
- **A2. Canal de salida.** Confirmar en `contracts.ts` que la respuesta solo
  trae `choice` y `probabilities`: no hay canal de mensajes entre jugadores.
- **A3. Acoplamiento nulo.** Verificar que `world.ts` solo crea la bola y las
  paredes. Corroborar en la base: tipos de evento existentes, velocidad de la
  bola constante, giros coincidentes con rebotes de pared.

### Bloque B — conductual (¿que hacen las jugadas?)

Para las 9.175 jugadas de jugador, contra el `sample` mas cercano:

- **B1. Esquiva.** Distancia perpendicular a la linea de vuelo de la bola antes
  y despues de la jugada (`offLine`/`onLine`/neutro).
- **B2. Huida radial.** Alejar/acercar respecto de la posicion actual de la bola.
- **B3. Separacion.** Variacion de la distancia al vecino mas cercano.
- **B4. Apoyo.** Frente al jugador mas amenazado, si los demas se le acercan o
  se alejan (el altruismo prediria acercarse a cubrirlo).
- **B5. Comparacion con la huida trivial** (`greedyMatch`): en que fraccion la
  jugada elegida es la que mas se aleja de la bola.

### Bloque C — resultado y dispersion

- Distribucion de `outcome` (`ball` vs `players`).
- Dispersion media por ronda y densidad (distancia al vecino) en el instante de
  cada muerte.

## 4. Entregables

| Archivo | Que es |
| --- | --- |
| `docs/bolitas/scripts/analisis-altruismo.js` | Script de `mongosh` que recalcula **todas** las metricas e imprime el informe tecnico. |
| `docs/bolitas/INFORME-ALTRUISMO.md` | Informe ejecutivo con veredicto, evidencia, limites y anexo de salida cruda. |
| `docs/bolitas/PLAN-INFORME-ALTRUISMO.md` | Este plan. |

## 5. Fases

| Fase | Que hace | Criterio de cierre |
| --- | --- | --- |
| 0 | Definicion operativa y anti-objetivos | revision: la tesis queda falsable |
| 1 | Script de analisis | corre contra `nimble` y imprime los tres bloques |
| 2 | Redaccion del informe | veredicto + evidencia + limites + anexo |
| 3 | Verificacion | los numeros del informe coinciden con la salida del script |

## 6. Riesgos y trampas

- **Medir intencion.** Imposible; el informe solo mide conducta y lo declara.
- **Confusion rebote/esquiva.** Un giro puede venir de una pared; el conteo de
  giros se cruza con eventos `wall` para no atribuirselos al modelo.
- **Muestra escasa de victorias.** Solo 5/36 rondas ganan las bolitas: no se
  sacan conclusiones fuertes de ese subconjunto.
- **Numeros muertos.** Cualquier cifra del informe debe poder recalcularse; si
  no, no entra.
