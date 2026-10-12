# Bolitas — analisis del juego de colores (Nimble Pong)

Todo el material de analisis del juego de las bolitas vive aqui. El juego es la
simplificacion que se compara contra el Mercado de Energia Mayorista (MEM) en
`docs/mem/`.

## Contenido

| Archivo | Que es |
| --- | --- |
| `INFORME-ALTRUISMO.md` | Informe ejecutivo: ¿son altruistas las bolitas? Veredicto: no, y es inejecutable. |
| `PLAN-INFORME-ALTRUISMO.md` | Plan de ese informe (ejecutado). |
| `INFORME-BOLITAS-MEM.md` | **Puente**: objetos, metodos y mecanismos similares entre el juego y el MEM. |
| `PLAN-BOLITAS-MEM.md` | Plan del puente (ejecutado). |
| `scripts/analisis-altruismo.js` | Recalcula las metricas del informe de altruismo (mongosh). |
| `scripts/jev-sonda.py` | Reproduce el juicio estructurado (Jev) del Anexo B del puente. |

## Reproducir

```bash
# Lado juego: historico de partidas en MongoDB
mongosh "mongodb://jev:jevpass@localhost:27018/nimble" \
  --file docs/bolitas/scripts/analisis-altruismo.js

# Lado juicio estructurado (la clave va en el entorno, nunca en el repo)
export TYPESAFE_API_KEY=...
python3 docs/bolitas/scripts/jev-sonda.py
```

El lado mercado (PostgreSQL de XM) esta en `docs/mem/`.

## Resumen de los hallazgos

- **Altruismo:** refutado. Una sola llamada al modelo decide las diez jugadas
  (2.087 decisiones = 2.087 llamadas); la conducta es autoprotectora (**72%**
  evade la linea de la bola; 3:1 se aleja del compañero mas amenazado). El
  altruismo, ademas, es **inejecutable**: una jugada no puede afectar a otra bolita.
- **Puente con el MEM:** se comparten el bien comun (sobrevivir sin altruismo) y
  la forma de decidir; **no** se comparte la interaccion entre agentes (el juego
  no tiene precio), que es una **ruptura** decisiva.
