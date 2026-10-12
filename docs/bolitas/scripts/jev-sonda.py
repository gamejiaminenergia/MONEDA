#!/usr/bin/env python3
"""Sonda de juicio estructurado (Jev / TypeSafe System One) para el informe
bolitas <-> MEM. Reproduce los numeros del Anexo B.

Uso:
  export TYPESAFE_API_KEY=...        # la clave vive en el entorno, nunca en el repo
  python3 docs/bolitas/scripts/jev-sonda.py

No escribe nada; solo imprime. Cuatro preguntas factuales discriminan los ejes
(interaccion, agencia, bien comun, regla) y doce pares se clasifican por grado.
"""
import json
import os
import urllib.request

KEY = os.environ.get("TYPESAFE_API_KEY")
if not KEY:
    raise SystemExit("Falta TYPESAFE_API_KEY en el entorno.")
URL = os.environ.get("TYPESAFE_URL", "https://api.typesafe.ai/v1/systemone")


def preguntar(state, questions, model="jev-latest"):
    payload = {"model": model, "state": state, "questions": questions}
    req = urllib.request.Request(
        URL,
        data=json.dumps(payload).encode(),
        headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


# --- Sonda factual: ejes que separan analogia de ruptura ----------------------
state = {
    "juego": "Nimble Pong: diez bolitas de colores huyen de una bola negra que rebota y mata al primer roce. "
             "Una sola llamada a un modelo de IA decide las diez jugadas a la vez (1 llamada = 10 jugadas). "
             "Los jugadores NO chocan entre si y la bola NO se desvia al matar: la posicion de un jugador no "
             "cambia la trayectoria de la bola ni la suerte de otro. Si al menos uno sobrevive al minuto, ganan las bolitas.",
    "mercado": "Mercado de Energia Mayorista colombiano. 352 comercializadores y 239 generadores. "
               "El precio de bolsa lo fija el recurso marginal y todos los agentes despachados reciben ese mismo precio, "
               "de modo que la oferta de un agente cambia el precio que pagan los demas. Hay despacho centralizado por XM "
               "y reglas de la CREG (cargo por confiabilidad, OEF). La confiabilidad del sistema es un bien comun: "
               "el sistema sirve la demanda si en conjunto hay energia firme suficiente.",
}
factuales = {
    "juego_interaccion": "En el `juego`, ¿la jugada de un jugador puede cambiar el resultado de otro jugador?",
    "mercado_interaccion": "En el `mercado`, ¿la accion de un agente puede cambiar el resultado de otro agente?",
    "juego_un_decisor": "En el `juego`, ¿hay un unico decisor para todos los jugadores?",
    "mercado_un_decisor": "En el `mercado`, ¿hay un unico decisor para todos los agentes?",
    "bien_comun": "En AMBOS sistemas, ¿el exito colectivo se alcanza si el sistema sigue operando, aunque algunos fallen?",
    "regla_determinista": "En AMBOS sistemas, ¿una comprobacion determinista convierte un error en una perdida inmediata?",
}
q = {k: {"type": "noul", "instructions": v, "criteria": {"true": {"que_es": "Si"}, "false": {"que_es": "No"}}}
     for k, v in factuales.items()}
data = preguntar(state, q)
print("== Sonda factual (noul: 1.0 = si) ==   modelo", data.get("model"), data.get("usage"))
for k in factuales:
    print(f"  {k:24s} {data['answers'][k].get('noul')}")

# --- Clasificacion por par en 5 grados ---------------------------------------
pares = [
    ("O1", "bola negra que mata al roce", "precio de escasez / riesgo hidrologico"),
    ("O2", "diez bolitas", "352 comercializadores / 239 generadores"),
    ("O3", "mesa y paredes", "SIN y limites tecnicos"),
    ("O4", "config (velocidad, intervalo)", "parametros regulatorios (CREG)"),
    ("O5", "historico de partidas (Mongo)", "base de datos XM"),
    ("M1", "el modelo elige 1 de 9 direcciones", "el agente oferta precio y cantidad"),
    ("M2", "prediccion de trayectoria (ballAt)", "prediccion de precio e hidrologia"),
    ("M3", "muerte instantanea al roce", "sanciones y reconciliaciones"),
    ("K1", "un roce mata", "insolvencia por exposicion a bolsa"),
    ("K2", "≥1 vivo gana todas", "confiabilidad: Cargo por Confiabilidad / OEF"),
    ("K3", "una llamada decide las diez", "despacho centralizado XM / CREG"),
    ("K4", "las bolitas no interactuan", "los agentes se afectan via precio"),
]
estado2 = {"pares": [{"id": i, "juego": a, "mercado": b} for i, a, b in pares]}
crit = {
    "isomorfismo": "misma estructura; la conclusion se transfiere",
    "homomorfismo": "se preserva parte de la estructura",
    "analogia_funcional": "mismo papel, otra mecanica",
    "metafora": "solo evoca; sin estructura comun",
    "ruptura": "existe en un lado y no en el otro",
}
q2 = {i: {"type": "choice",
          "instructions": f"Compara '{a}' (juego) con '{b}' (mercado) y clasifica el grado.",
          "criteria": {k: {"que_es": v} for k, v in crit.items()}}
      for i, a, b in pares}
data2 = preguntar(estado2, q2)
print("\n== Clasificacion por par (choice) ==   modelo", data2.get("model"), data2.get("usage"))
for i, a, b in pares:
    ans = data2["answers"][i]
    print(f"  {i}: {ans.get('choice'):20s} conf={ans.get('confidence')}   ({a} vs {b})")
