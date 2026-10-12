# Informe ejecutivo: el juego de las bolitas y el Mercado de Energia Mayorista colombiano

Fecha: 2026-10-11.
Bases: 36 rondas de Nimble Pong (MongoDB) + Mercado de Energia Mayorista (PostgreSQL
de XM, 2020-2026) + regulacion CREG + un juicio estructurado independiente (Jev).

**Veredicto.** La analogia es **real pero limitada**: el juego comparte con el MEM
un **objeto** (muchas entidades bajo reglas comunes), varios **metodos** (decidir
periodicamente, anticipar el peligro) y un **mecanismo** central (un bien comun que
sobrevive si el sistema sigue operando). Pero **no es un isomorfismo**: el juego
**borra justo lo que hace mercado al mercado**, la interaccion entre agentes via el
precio. La correspondencia mas fuerte no es la que parece (las bolitas vs los
agentes) sino la mas abstracta (bien comun); y la mas util es la **ruptura**.

**Como leer este informe.** Se compara en tres capas —**objetos, metodos,
mecanismos**— y cada par recibe un **grado**: *isomorfismo* (misma estructura),
*homomorfismo* (parte), *analogia funcional* (mismo papel, otra mecanica),
*metafora* (solo evoca) o *ruptura* (existe en uno y no en el otro). Cada seccion
cierra con **Conclusion / Tips / Advertencias**.

---

## 1. Resumen ejecutivo

| Capa | Par mas fuerte | Par mas debil |
| --- | --- | --- |
| Objeto | Historico de partidas ↔ base de datos XM (**isomorfismo**) | bolitas ↔ agentes (analogia funcional) |
| Metodo | Anticipar el peligro (trayectoria ↔ precio/hidrologia) | Muerte al roce ↔ sancion (metafora) |
| Mecanismo | Bien comun: ≥1 sobrevive ↔ confiabilidad (analogia funcional fuerte) | **No-interaccion ↔ precio (ruptura)** |

Cifras del MEM que sostienen el informe: **678 agentes** (352 comercializadores, 239
generadores, 87 distribuidores); generacion 2025 **72% hidraulica** (68.099 de 94.381
GWh); mercado **competitivo** (HHI 930); precio de bolsa 2025 promedio **245 COP/kWh**,
hasta **1.081 COP/kWh** en El Nino (abr-2024) con el embalse al **29,5%**; los
comercializadores cubren **73-88%** de su demanda con contratos y dejan **12-27%**
expuesta a bolsa; demanda no atendida historica maxima **0,16%**.

> **Conclusion.** El juego es una **maqueta conceptual** del MEM, no un gemelo
> digital: captura la tesis «el sistema no necesita altruismo», pero al eliminar la
> interaccion entre agentes deja fuera el mercado mismo.
>
> **Tips.** Si solo vas a recordar una linea: *se parecen en que ambos logran un
> bien comun con agentes egoistas; difieren en que en el mercado los agentes se
> afectan entre si y en el juego no*.
>
> **Advertencias.** No confundas «se parecen» con «son lo mismo». Casi todo el
> mapeo es **analogia funcional o metafora**; solo un par es isomorfismo. Tratar la
> analogia como literal lleva a conclusiones falsas (ver seccion 7).

## 2. Objetos comparados

| # | Juego | MEM | Grado | Invariante |
| --- | --- | --- | --- | --- |
| O1 | Bola negra que rebota y mata al roce | Precio de escasez / bolsa / riesgo hidrologico | Analogia funcional | Un peligro externo cuya magnitud cambia y hay que esquivar |
| O2 | Diez bolitas de colores | 678 agentes (352 com., 239 gen., 87 dist.) | Analogia funcional | Muchas entidades bajo un mismo conjunto de reglas |
| O3 | Mesa cuadrada y cuatro paredes | SIN y limites tecnicos | Analogia funcional | Espacio acotado con fronteras duras compartidas |
| O4 | Config (velocidad de bola, intervalo) | Parametros regulatorios (precio de escasez, reglas CREG) | Analogia funcional | Palancas externas que fijan la dificultad |
| O5 | Historico de partidas (Mongo) | Base de datos XM (57M filas, 2020-2026) | **Isomorfismo** | Memoria persistente para analisis ex-post |

> **Conclusion.** Los objetos **se corresponden uno a uno pero con otra escala y
> otra mecanica**: la bola no "cobra" como el precio, y diez no son 678. El unico
> objeto estructuralmente identico es el **historico**: en ambos casos la misma
> funcion (memoria para analizar despues) se implementa igual (series fechadas).
>
> **Tips.** Usa O2 solo como analogia: el conteo de agentes (678) y la mezcla
> (72% hidraulica) son el "campo de juego", no un detalle que se transfiera.
>
> **Advertencias.** La bola del juego **no se desvia** al matar y el precio del
> mercado **si depende** de lo que hagan los agentes. Ese matiz convierte a O1 en
> analogia, no en igualdad (ver K4).

## 3. Metodos comparados

| # | Juego | MEM | Grado | Invariante |
| --- | --- | --- | --- | --- |
| M1 | El modelo elige 1 de 9 direcciones por jugador | El agente oferta precio y cantidad por hora | Analogia funcional | Decision periodica para mejorar la propia posicion |
| M2 | Prediccion de trayectoria (formula cerrada `ballAt`) | Prediccion de precio e hidrologia | Analogia funcional | Anticipar el peligro inmediato para decidir hoy |
| M3 | Barrido de roce: muerte instantanea al tocar | Verificacion de cumplimiento y reconciliaciones | Metafora | Una comprobacion convierte un error en perdida |

El precio se forma por **orden de merito**: el recurso marginal fija el precio de esa
hora y todos los despachados cobran lo mismo. En 2024-Q1 **la hidraulica fue marginal
el 100% de las horas** (Guavio 502/502, San Carlos 312/312, Chivor 276/276), con
precios de oferta ~560-615 COP/kWh.

> **Conclusion.** El metodo de decision se parece en la **forma** (decidir cada
> periodo), no en la **regla**: el modelo optimiza su propia supervivencia, el agente
> optimiza su beneficio **sabiendo que su oferta mueve el precio**. La prediccion es
> la analogia mas honesta: ambos anticipan el peligro para decidir hoy.
>
> **Tips.** Para explicar M1 en una frase: *«los dos eligen cada tanto, pero el
> agente sabe que su eleccion mueve el tablero y la bolita no»*.
>
> **Advertencias.** La muerte al roce **no** es la sancion del mercado: es instantanea
> y determinista, mientras la sancion es gradual y contractual. Un juicio estructurado
> independiente (Jev) lo midio en **0,19** de "misma regla" — es metafora, no metodo
> compartido.

## 4. Mecanismos comparados

| # | Juego | MEM | Grado | Invariante |
| --- | --- | --- | --- | --- |
| K1 | Un roce mata | Insolvencia por posicion expuesta | Metafora | Una posicion mala saca al agente |
| K2 | ≥1 vivo al minuto → ganan todas | Confiabilidad: Cargo por Confiabilidad y OEF | **Analogia funcional (fuerte)** | Bien comun: basta que el sistema siga operando |
| K3 | Una sola llamada decide las diez (1:1) | Despacho centralizado XM / marco CREG | Analogia funcional debil | Existe un coordinador sobre muchos agentes |
| K4 | Las bolitas no interactuan entre si | Los agentes se afectan via precio y poder de mercado | **Ruptura** | Acoplamiento: una jugada cambia el resultado de otras |
| K5 | El prompt pide «ayudarse» | La regulacion pide coordinacion | Analogia funcional | La senal externa pide cooperacion |

El mecanismo mas compartido es **K2**. En el juego, el informe previo mostro que aun
pidiendo ayuda la conducta es autoprotectora (72% evade, 3:1 se aleja del compañero
en peligro); en el MEM, la confiabilidad no depende de la bondad sino de **reglas e
incentivos** (Cargo por Confiabilidad, OEF).

La **ruptura K4** es la clave. El juego no tiene acoplamiento (una bolita no cambia la
suerte de otra); el mercado si: la oferta de un agente mueve el precio que pagan
todos, y el poder de mercado importa (HHI 930, líder ENDC con 18,3% de participacion).
Un juicio estructurado independiente (Jev) lo confirmo con nitidez: interaccion
**0,08 en el juego** frente a **0,95 en el mercado**.

> **Conclusion.** El mecanismo **bien comun (K2)** se transfiere: en los dos sistemas
> el conjunto sobrevive sin que nadie sea altruista. Pero **K4** demuestra que el
> juego **no es un mercado**: le falta el canal por el que los agentes se afectan.
>
> **Tips.** K2 es el puente para comparar politicas (¿que pasa si cambio el
> incentivo?); K4 es el puente para saber **que no se puede** inferir del juego.
>
> **Advertencias.** Sobre K3: aunque en ambos hay un coordinador (el modelo / XM),
> el mercado es **descentralizado** — Jev puntuo "unico decisor" en 0,90 para el
> juego y **0,19** para el mercado. No trates el despacho central como una mente
> unica que decide a diez agentes.

## 5. Inferencias transferibles

1. **Un sistema coordinado no necesita altruismo.** Se transfiere: el juego lo
   cumple (evasion propia mayoritaria pese al prompt cooperativo) y el MEM tambien
   (confiabilidad por reglas e incentivos, no por bondad).
2. **El bien comun (K2) se sostiene si los incentivos alinean.** Se transfiere: en el
   juego basta que sobreviva uno; en el MEM basta energia firme suficiente. La
   leccion es de **diseño de incentivos**, no de intenciones.
3. **Sin acoplamiento, la cooperacion no es observable.** Transferible en negativo:
   donde no hay interaccion (el juego), "ayudar" no cambia el resultado de nadie; por
   eso el altruismo es inejecutable (ya demostrado en el informe previo).

> **Conclusion.** Lo que se transfiere es **abstracto y robusto** (incentivos, bien
> comun), justo lo que no depende de los detalles. Lo concreto (precio, contratos,
> escala) no se transfiere.
>
> **Tips.** Usa estas tres inferencias como las unicas afirmaciones "de ida y vuelta"
> entre los dos sistemas; el resto es analogia descriptiva.
>
> **Advertencias.** No infieras cifras del juego al mercado ni al reves: los
> invariantes transferibles son cualitativos, no numericos.

## 6. Extrapolaciones

**Del juego al mercado.** El juego predice que **pedir cooperacion en el prompt no
produce cooperacion**: un sistema con incentivos alineados funciona igual con agentes
egoistas. Aplicado al MEM: la confiabilidad no se logra exhortando a los agentes, sino
con reglas como el Cargo por Confiabilidad (que en la BD se paga via `PrecCargConf` y
se evalua con la OEF, hoy con **608 recursos en deficit** en algun momento del rango).

**Del mercado al juego (extension propuesta).** Para que el juego deje de ser analogia
y sea **simulador del MEM**, hay que devolverle lo que la simplificacion borro:
1. **Precio endogeno**: que las jugadas de las bolitas cambien "el costo" del resto
   (como el recurso marginal fija el precio de todos).
2. **Contratos**: que una bolita pueda "cubrirse" (bajar su exposicion) a cambio de
   renunciar a ganancia (como 73-88% de cobertura y 12-27% expuesto).
3. **Poder de mercado**: que apinarse o dominar una zona suba el "precio" (HHI).

> **Conclusion.** El juego sirve hoy como **argumento**, no como **simulador**:
> demuestra la tesis del bien comun sin altruismo, pero para predecir el MEM hay que
> añadirle interaccion de precio.
>
> **Tips.** La extension mas rentable es el **precio endogeno**: una sola regla que
> convierte la maqueta en un mercado en miniatura.
>
> **Advertencias.** Extrapolar el resultado del juego (p. ej. "siempre gana la bola")
> al MEM es invalido: en el MEM no hay un unico enemigo que mata, hay un precio que
> se reparte y una demanda que se atiende o no (maximo historico 0,16% no atendida).

## 7. Rupturas y limites

| Ruptura | Juego | MEM |
| --- | --- | --- |
| **Interaccion** | Nula: una jugada no afecta a otra | Alta: la oferta mueve el precio de todos |
| **Dinero y contratos** | No existen | Columna vertebral (cobertura, bolsa) |
| **Agencia** | Un decisor para diez (Jev 0,90) | Descentralizado (Jev 0,19) |
| **Muerte** | Instantanea y determinista | Gradual, contractual (sancion/reconciliacion) |
| **Horizonte** | Rondas de 60 s | Dia, estacion, ciclo de El Nino (2024 vs 2025) |
| **Escala** | 10 jugadores | 678 agentes |

> **Conclusion.** La ruptura dominante es la **interaccion**. Todas las demas
> (dinero, agencia, horizonte) son consecuencias de ella: sin interaccion no hay
> precio, y sin precio no hay mercado.
>
> **Tips.** La ruptura es **informacion**, no un defecto: dice exactamente que hay
> que añadir para que el juego valga como modelo.
>
> **Advertencias.** No cierres el informe diciendo "el juego es el mercado": la
> evidencia dice lo contrario. El juego es un **caso limite** del mercado (sin
> acoplamiento), no su reflejo.

## 8. Glosario bilingue

| Juego | MEM |
| --- | --- |
| Bola negra | Precio de escasez / riesgo hidrologico |
| Bolita de color | Agente (generador / comercializador) |
| Mesa y paredes | SIN y limites tecnicos |
| Ronda de 60 s | Horizonte de operacion / ciclo hidrologico |
| Roce mortal | Insolvencia (posicion expuesta) |
| Ganar las bolitas | Confiabilidad del sistema (demanda atendida) |
| Gana la bola negra | Apagon / demanda no atendida |
| Config | Marco regulatorio (CREG) |
| Historico en Mongo | Base de datos XM |

## 9. Reproduccion

```bash
# Lado mercado (PostgreSQL de XM)
psql -d "postgresql://postgres:postgres@localhost:5432/postgres" -P pager=off -f docs/mem/consultas.sql

# Lado regulacion (CREG), si el contenedor esta arriba
curl -sS -X POST http://localhost:8090/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"¿Que es el Cargo por Confiabilidad?","timeout":180000}'
```

El lado juego sale de `src/lib/game/*` y de la coleccion `matches`;
`docs/bolitas/scripts/analisis-altruismo.js` recalcula sus cifras. El juicio estructurado se hizo
con `jev-gateway` (Jev 1.13.0).

> **Conclusion.** Cada cifra del informe tiene una fuente y un comando; nada esta
> inventado ni importado de otro dominio.
>
> **Tips.** El script SQL usa funciones y vistas ya acotadas (`fn_*`, `v_*`), asi que
> no golpea las tablas de 20M de filas.
>
> **Advertencias.** La cadena de conexion y el puerto del CREG (8090) son de esta
> maquina; ajustalos a tu entorno antes de difundir el comando.

---

## Conclusiones generales

1. **Se parecen, pero no son lo mismo.** Hay **un isomorfismo** (historico ↔ BD XM),
   varias analogias funcionales y una **ruptura decisiva** (interaccion).
2. **El parecido fuerte es abstracto:** el bien comun que sobrevive con agentes
   egoistas (K2). Ese es el puente legitimo entre los dos sistemas.
3. **El juego no es un mercado:** al no haber acoplamiento entre bolitas, no hay
   precio, y sin precio no hay lo que define al MEM.
4. **Un juicio estructurado independiente no encontro isomorfismo** en los pares
   concretos (los agrupo en metafora/ruptura), y si discrimino en los ejes factuales:
   interaccion (0,08 vs 0,95) y agencia (0,90 vs 0,19).

## Recomendaciones

- **Comunicacion:** resumir en una linea: *«el juego es el MEM sin interaccion: la
  misma historia de incentivos, borrando el precio»*.
- **Producto:** para volverlo simulador, implementar **precio endogeno** (K4 invertida);
  es el cambio de mayor valor con menor codigo.
- **Analisis:** no inferir cifras del juego al mercado; usar solo las tres inferencias
  cualitativas de la seccion 5.

---

## Anexo A: datos crudos del MEM

```text
AGENTES
COMERCIALIZACIÓN 352 | GENERACIÓN 239 | DISTRIBUCIÓN 87 | TRANSPORTE 20 | CENTRO RECOLECCIÓN 6

CONCENTRACIÓN 2025
HHI = 930.4 (BAJA / COMPETITIVO), 261 agentes, líder ENDC con 18.31% de participación

PRECIOS 2025 (COP/kWh)
bolsa: prom 245.15 / min 102.83 / max 765.95   escasez: prom 717.61   contratos: prom 299.10

EL NIÑO (embalse vs precio)
2024-04-15  bolsa 1081.4  escasez 742.7  embalse 29.5%
2024-09-15  bolsa  851.8  escasez 785.1  embalse 51.2%
2025-01-15  bolsa  553.8  escasez 797.4  embalse 66.9%
2025-06-15  bolsa  112.7  escasez 673.7  embalse 79.0%
2026-01-15  bolsa  146.1  escasez 590.6  embalse 80.3%
2026-06-15  bolsa  367.4  escasez 906.1  embalse 73.4%

COBERTURA CONTRATOS (2025-01, comercializadores)
ENEL 88.1% contrato / 12.0% bolsa | EPM 82.4 / 17.6 | CARIBEMAR 88.0 / 12.3 | AIR-E 73.4 / 26.6

MARGINALIDAD (2024-Q1, % horas como recurso marginal)
GUAVIO 100.00 | SAN CARLOS 100.00 | CHIVOR 100.00 | PAGUA 100.00 | BETANIA 100.00 (hidráulica)

GENERACIÓN 2025 (GWh)
HIDRÁULICA 68099.4 (72%) | TÉRMICA GAS 6514.4 | SOLAR 4473.8 | TÉRMICA CARBÓN 3564.2
COGENERADOR 845.6 | TÉRMICA COMBUSTÓLEO 545.5 | EÓLICA 154.9 | otros 182.9   TOTAL 94380.8

DEMANDA NO ATENDIDA (máximo histórico)
AREA CARIBE 2020-06: 0.160%  |  AREA NORDESTE 2021-07: 0.137%  |  AREA CARIBE 2022-05: 0.127%

OEF: 608 recursos con déficit de energía firme en algún momento del rango
```

## Anexo B: juicio estructurado (Jev 1.13.0)

```text
Sonda factual (noul; 1.0 = si, 0.0 = no)
  juego_interaccion    0.08   <- una jugada NO afecta a las demas (juego)
  mercado_interaccion  0.95   <- una accion SI afecta a las demas (mercado)   -> RUPTURA
  juego_un_decisor     0.90
  mercado_un_decisor   0.19   <- el mercado es descentralizado
  bien_comun           0.80   <- exito colectivo si el sistema sigue operando -> ANALOGIA FUERTE
  regla_determinista   0.19   <- "error -> perdida inmediata" no es el mismo mecanismo -> METAFORA

Clasificacion por par (choice de 5 grados): Jev devolvio "metafora"/"ruptura" con
confianza baja (0.25-0.30) en casi todos los pares concretos: no encontro isomorfismo
a partir de descripciones. Los grados del informe se asignan con el invariante explicito
y se apoyan en la sonda factual de arriba. Costo total del juicio: ~$0.0004.
```

## Anexo C: el lado juego (evidencia)

Del informe previo (`docs/bolitas/INFORME-ALTRUISMO.md`), sobre 36 partidas y 9.175 jugadas:
**una sola llamada al modelo decide las diez** (2.087 decisiones = 2.087 llamadas);
**72%** de las jugadas evaden la linea de la bola; frente al compañero mas amenazado,
**3:1 se alejan** de el; el juego **gana la bola 31/36** rondas. Es decir: pide
cooperacion y produce autopreservacion, igual que un sistema de incentivos sin
altruismo.
