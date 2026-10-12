# Informe ejecutivo: ¿son altruistas las bolitas de colores?

Fecha: 2026-10-11.
Base: 36 rondas de Nimble Pong (`jev-latest`), 2.087 turnos, 9.175 jugadas de
jugador. Fuente y reproduccion en la seccion 8.

**Veredicto.** La tesis «las bolitas de colores se ayudan» queda **refutada**.
No por falta de datos, sino por construccion: en este juego **no existe un acto
altruista posible**, y la conducta observada es consistente con diez evasiones
individuales coordinadas por un solo modelo.

**Como leer este informe.** Cada seccion cierra con **Conclusion**, **Tips** y
**Advertencias**. Las cifras salen de la base o del codigo; los juicios van
siempre pegados a su dato.

---

## 1. Resumen ejecutivo

- **Altruismo inejecutable.** El motor solo tiene la bola y las cuatro paredes
  (`src/lib/game/world.ts`): los jugadores no interactuan y la bola no se desvia
  al matar. Ninguna jugada puede beneficiar a otra bolita.
- **Un solo decisor.** Las 2.087 jugadas por turno salen de **2.087 llamadas**
  al modelo (1:1), y en el **99,1 %** la respuesta trae exactamente una jugada
  por jugador vivo. «Ayudarse» no es un acto entre bolitas: es la forma del plan
  unico del modelo.
- **La conducta es autoprotectora.** El **72,0 %** de las jugadas alejan al
  jugador de la linea de vuelo de la bola; frente al compañero mas amenazado,
  los demas se **alejan** de el 4.334 veces contra 1.394 (3:1 en contra de ir a
  cubrirlo).
- **Lo que parece cooperacion no lo demuestra.** El **85,5 %** de las jugadas
  aumenta la distancia al vecino, pero sin colision ni recurso compartido esa
  separacion es tambien la opcion individualmente optima: cooperacion y egoismo
  predicen la misma conducta.

> **Conclusion.** La evidencia no solo no respalda el altruismo: prueba que es
> imposible en este motor. La lectura correcta es autopreservacion coordinada.
>
> **Tips.** Para decidir rapido, mira dos numeros: `decisions == modelCalls`
> (hay un solo decisor) y `offLine = 72,0 %` (huyen, no cubren). Con esos dos ya
> se sostiene el veredicto.
>
> **Advertencias.** (1) Solo 5/36 rondas ganan las bolitas: no saques
> conclusiones fuertes de ese subconjunto. (2) El informe mide conducta, no
> intencion; no lo leas como una lectura de la «mente» del modelo.

## 2. Definicion operativa

**Acto altruista** = una jugada de un jugador que **beneficia a otro jugador** y
**a costa de su propio interes**. Sin beneficio para otro, o sin costo propio,
no hay altruismo: hay conducta.

> **Conclusion.** Sin esta definicion la tesis no es falsable y el informe no
> podria refutarla; con ella, cualquier acto altruista exigiria un beneficiario
> y un costo, y ambos son medibles (o descartables) en la base.
>
> **Tips.** Usa esta definicion como rubrica: antes de aceptar un ejemplo de
> «ayuda», pregunta *a quien beneficia* y *a quien le cuesta*. Si la respuesta
> es «a nadie» o «a nadie le cuesta», no es altruismo.
>
> **Advertencias.** El riesgo tipico es **mover la meta**: rebajar el criterio a
> «se separan mucho» o «se ven ordenados» y llamarlo altruismo. Eso es conducta
> cooperativa aparente, no altruismo.

## 3. Datos y alcance

| Campo | Valor |
| --- | --- |
| Coleccion | `matches`, base `nimble` |
| Conexion | `mongodb://jev:jevpass@localhost:27018/nimble` |
| Rondas | 36 (`jev-latest`) |
| Parametros | `intervalMs 700`, `ballSpeed 840`, `runnerSpeed 300`, `survivalMs 60000` |
| Series por ronda | `samples`, `decisions`, `events`, `modelCalls` |

> **Conclusion.** Los datos alcanzan y son comparables: mismo modelo, mismos
> parametros y series completas en las 36 rondas.
>
> **Tips.** Si añades rondas, verifica que compartan `config`; sin eso dos
> partidas no son comparables y las medias se contaminan.
>
> **Advertencias.** Una sola corrida (`jev-latest`, 700 ms, bola a 840). No
> generalices a otros modelos, ritmos o velocidades: cambian las condiciones,
> no la conclusion estructural.

## 4. Evidencia estructural: no hay quien sea altruista

### 4.1 Agencia unica

| Hecho | Dato |
| --- | --- |
| Turnos vs. llamadas al modelo | 2.087 `decisions` = 2.087 `modelCalls` (1:1) |
| Respuestas por llamada = jugadores vivos | 2.069 / 2.087 = **99,1 %** |
| Canal de salida | solo `choice` y `probabilities`, sin mensajes entre jugadores |

### 4.2 Acoplamiento nulo: el altruismo es inejecutable

- `src/lib/game/world.ts` crea **solo la bola y las cuatro paredes**: no hay
  cuerpos de jugador. La bola no se desvia al matar y los corredores no chocan.
- La base lo corrobora: velocidad de la bola **constante a 840 px/s en 6.987
  transiciones** (0 desviaciones); los giros coinciden con rebotes de pared
  (**83,8 %** con evento `wall` en la ventana).
- Eventos registrados: `wall` 2.049, `serve` 272, `kill` 355, `death` 355,
  `over` 36. **Ninguno representa interaccion entre jugadores.**

> **Conclusion.** No hay diez agentes que puedan pactar (un solo decisor) ni
> jugadas que afecten a otro (acoplamiento nulo). El altruismo no solo no se
> observa: es fisicamente imposible.
>
> **Tips.** Este bloque es el mas fuerte porque no depende de interpretar
> movimiento: se prueba por conteo (1:1) y por codigo (`world.ts`). Si tienes
> que defender el veredicto, empieza por aqui.
>
> **Advertencias.** Un giro de la bola **no** es prueba de que el modelo haga
> algo: por eso cada giro se cruza con eventos `wall`. No atribuyas a decision
> del modelo lo que explica una pared.

## 5. Evidencia conductual: autopreservacion, no sacrificio

Sobre las 9.175 jugadas, contra la muestra de mesa mas cercana:

| Metrica | Resultado | Lectura |
| --- | --- | --- |
| B1. Se alejan de la linea de vuelo de la bola | **72,0 %** (27,1 % se acercan, 0,9 % neutro) | evasion propia del peligro |
| B2. Se alejan de la posicion actual de la bola | **60,3 %** (23,4 % se acercan, 16,1 % lateral, 0,3 % quieto) | huida, no cobertura |
| B3. Aumentan la distancia al vecino mas cercano | **85,5 %** (8,5 % la reducen) | se reparten el espacio |
| B4. Frente al mas amenazado, se alejan de el | **4.334** vs **1.394** que se acercan | no acuden a cubrirlo |
| B5. Coinciden con la huida trivial (radial) | 25,9 % | esquivan la trayectoria, no solo huyen en linea recta |

> **Conclusion.** Predomina la evasion propia; no aparece ningun patron de
> sacrificio. Nadie reduce su seguridad para proteger a otra bolita; al
> contrario, tienden a alejarse del compañero en peligro.
>
> **Tips.** Las dos metricas mas discriminantes son B1 (esquiva) y B4 (apoyo al
> amenazado). B4 es la que mas habla de altruismo: si existiera, se acercarian a
> cubrir; el dato dice lo contrario.
>
> **Advertencias.** B1–B5 son **proxies**, no la intencion. La linea de vuelo se
> mide con la velocidad instantanea de la bola, y el «alejarse» de B4 puede
> confundirse con huir de la bola. No son pruebas psicologicas: son conteos de
> conducta.

## 6. Resultado: no emerge una inteligencia de grupo

- Desenlaces: `ball` **31/36** (la bola mata a los diez) vs `players` **5/36**
  (llegan al minuto).
- Distancia al vecino: ~112 px de media global; al morir, ~200 px (min 0). Las
  muertes no se concentran en aglomeraciones.

> **Conclusion.** No hay una estrategia de grupo que sostenga al conjunto; el
> patron es compatible con diez evasiones individuales.
>
> **Tips.** Cruza `outcome` con `config` si cambias `SURVIVAL_MS` o la velocidad:
> el resultado depende de esas palancas tanto como del modelo.
>
> **Advertencias.** La victoria de las bolitas **no** mide altruismo: el premio
> colectivo (basta que sobreviva uno) lo consigue tambien el egoismo puro. No
> infieras cooperacion a partir del marcador.

## 7. Limites

> **Conclusion.** El informe cubre conducta y estructura, no motivacion; aun
> asi, la conclusion es fuerte porque el altruismo es inejecutable (seccion 4).
>
> **Tips.** Cita siempre los limites junto al veredicto; eso blinda el informe
> ante la objecion «pero no lees la mente».
>
> **Advertencias.** No pidas a esta base lo que no tiene: no hay utilidad por
> jugador, ni contra-factual, ni intencion. Cualquier inferencia de motivos
> queda fuera de alcance.

## 8. Reproduccion

```bash
mongosh "mongodb://jev:jevpass@localhost:27018/nimble" \
  --file docs/bolitas/scripts/analisis-altruismo.js
```

El script recalcula los tres bloques e imprime el detalle por ronda.

> **Conclusion.** Cualquier cifra de este informe se regenera con un comando;
> no hay numeros muertos.
>
> **Tips.** Ajusta la cadena de conexion a tu `MONGO_URL`/puerto real; el de la
> corrida fue el contenedor `nimble-mongo` en 27018.
>
> **Advertencias.** La cadena lleva credenciales de la corrida: no la subas a
> ningun sitio publico ni la pegues en el informe final si va a difundirse.

---

## Conclusiones generales

1. **El altruismo esta descartado por construccion**, no solo por ausencia de
   evidencia: no hay agentes independientes y ninguna jugada afecta a otra
   bolita (seccion 4).
2. **La conducta observada es autoprotectora** (72,0 % esquivan; 3:1 se alejan
   del compañero en peligro), sin ningun acto de sacrificio (seccion 5).
3. **La cooperacion aparente es indistinguible del interes propio**, de modo
   que la tesis, ademas de falsa, es no falsable con esta base (secciones 5–6).
4. **El resultado no sugiere inteligencia de grupo**: la bola gana 31 de 36
   rondas (seccion 6).

## Recomendaciones

- **Si quieres medir cooperacion real**, hay que cambiar el juego, no el analisis:
  introduce un costo de ayudar o un beneficio de defraudar (por ejemplo, colision
  entre jugadores o «apinarse mata»). Sin estructura multimotivo, la pregunta no
  tiene respuesta empirica.
- **Si quieres seguir con datos**, añade rondas y varia `SURVIVAL_MS` y la
  velocidad para estimar como cambia la supervivencia del grupo.
- **Para la comunicacion**, resume en una linea: *«el altruismo es imposible en
  este motor; las bolitas solo se esquivan»*.

---

## Anexo: salida cruda del script

```text
==================================================================
ANALISIS DE ALTRUISMO — historico de Nimble Pong
==================================================================
Rondas analizadas: 36
Turnos: 2087   Llamadas al modelo: 2087   Jugadas de jugador: 9175

--- BLOQUE A: estructural ----------------------------------------
A1. llamadas con jugadas = jugadores vivos: 2069/2087 (99.1%)
    (de esas, respondieron: 2087/2087)
A3. eventos por tipo: {"serve":272,"wall":2049,"kill":355,"death":355,"over":36}
A3. velocidad de la bola distinta de 840 px/s: 0/6987 muestras
A3. giros de la bola: 2104 de 6987 transiciones; con rebote de pared: 1763 (83.8%)

--- BLOQUE B: conductual -----------------------------------------
B1. esquiva (linea de vuelo): offLine 6604 (72.0%)  onLine 2489 (27.1%)  neutro 82 (0.9%)
B2. huida radial: away 5532 (60.3%)  toward 2145 (23.4%)  lateral 1473 (16.1%)  stay 25 (0.3%)
B3. separacion del vecino: nnSpread 7847 (85.5%)  nnCloser 782 (8.5%)  nnSame 100 (1.1%)
B4. frente al mas amenazado: se alejan 4334  se acercan 1394
B5. equivalen a la huida trivial: 2378 (25.9%)

--- BLOQUE C: resultado ------------------------------------------
C. desenlaces: {"ball":31,"players":5}
C. distancia al vecino (global): media 112 px  min 0 px
C. distancia al vecino al morir (n=326): media 200 px  min 0 px

--- Detalle por ronda --------------------------------------------
  batch-1791765673732-1  ball     39616 ms  kills 10  dispersion inicio 348  fin 445  media 347
  batch-1791765687329-2  ball     58544 ms  kills 10  dispersion inicio 367  fin 331  media 338
  batch-1791765707538-3  ball     31696 ms  kills 10  dispersion inicio 336  fin 391  media 403
  batch-1791765718403-4  ball     47696 ms  kills 10  dispersion inicio 411  fin 394  media 409
  batch-1791765733914-5  ball     34784 ms  kills 10  dispersion inicio 272  fin 498  media 375
  batch-1791765746451-6  players  60000 ms  kills  9  dispersion inicio 405  fin 29  media 226
  batch-1791765768161-7  ball     57632 ms  kills 10  dispersion inicio 446  fin 552  media 509
  batch-1791765788703-8  ball     46096 ms  kills 10  dispersion inicio 444  fin 52  media 255
  batch-1791765805488-9  players  60000 ms  kills  9  dispersion inicio 395  fin 46  media 209
  batch-1791765825187-10  ball     27936 ms  kills 10  dispersion inicio 280  fin 456  media 412
  batch-1791765835095-11  ball     26208 ms  kills 10  dispersion inicio 478  fin 876  media 640
  batch-1791765844347-12  ball     30688 ms  kills 10  dispersion inicio 453  fin 319  media 362
  batch-1791765855481-13  ball     34608 ms  kills 10  dispersion inicio 185  fin 230  media 218
  batch-1791765867548-14  ball     40080 ms  kills 10  dispersion inicio 400  fin 633  media 504
  batch-1791765881348-15  ball     26944 ms  kills 10  dispersion inicio 329  fin 631  media 395
  batch-1791765890836-16  ball     29696 ms  kills 10  dispersion inicio 414  fin 653  media 515
  batch-1791765901284-17  ball     46304 ms  kills 10  dispersion inicio 385  fin 683  media 513
  batch-1791765916848-18  ball     49840 ms  kills 10  dispersion inicio 205  fin 352  media 319
  batch-1791765934194-19  ball     25088 ms  kills 10  dispersion inicio 367  fin 416  media 350
  batch-1791765945098-20  ball     23696 ms  kills 10  dispersion inicio 452  fin 558  media 516
  batch-1791765953067-21  ball     35120 ms  kills 10  dispersion inicio 385  fin 722  media 516
  batch-1791765964489-22  ball     47280 ms  kills 10  dispersion inicio 412  fin 393  media 420
  batch-1791765980705-23  ball     39168 ms  kills 10  dispersion inicio 464  fin 265  media 400
  batch-1791765994107-24  ball     52080 ms  kills 10  dispersion inicio 344  fin 225  media 305
  batch-1791766011046-25  ball     55168 ms  kills 10  dispersion inicio 360  fin 745  media 517
  batch-1791766031244-26  ball     23888 ms  kills 10  dispersion inicio 325  fin 422  media 312
  batch-1791766039405-27  ball     18720 ms  kills 10  dispersion inicio 463  fin 567  media 472
  batch-1791766046102-28  ball     37280 ms  kills 10  dispersion inicio 375  fin 394  media 387
  batch-1791766058617-29  ball     31200 ms  kills 10  dispersion inicio 362  fin 80  media 299
  batch-1791766069114-30  players  60000 ms  kills  9  dispersion inicio 371  fin 2  media 194
  batch-1791766090516-31  ball     45712 ms  kills 10  dispersion inicio 154  fin 411  media 313
  batch-1791766106976-32  players  60000 ms  kills  9  dispersion inicio 299  fin 418  media 271
  batch-1791766127615-33  ball     48912 ms  kills 10  dispersion inicio 397  fin 491  media 409
  batch-1791766143802-34  ball     26944 ms  kills 10  dispersion inicio 332  fin 138  media 238
  batch-1791766153349-35  players  60000 ms  kills  9  dispersion inicio 323  fin 749  media 467
  batch-1791766174833-36  ball     17952 ms  kills 10  dispersion inicio 256  fin 47  media 174
```
