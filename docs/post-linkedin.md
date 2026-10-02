# Post para LinkedIn

Archivo de trabajo: copia el bloque de abajo tal cual y adjunta el video del
juego operando. Al final hay una version corta y una ficha tecnica del modelo
por si te preguntan en los comentarios.

---

## Post (version principal)

El que piensa que las pruebas de concepto son aburridas es porque se toma el
trabajo demasiado en serio. 😄

Así que hice **Have No Mouth, and I Must Scream IA**: un Pong donde **un roce
mata** y las jugadas no las decide un humano. Las decide un modelo de IA, en
vivo y por API.

🎮 Diez corredores con nombre de color y una bola que rebota para siempre. Un
solo toque y quedas fuera.

🧠 El cerebro es **Jev 1.13**, el modelo "System One" de TypeSafe. Es el modelo
de moda, pero no es para chatear: es para *decidir*. Le mandas el estado y
preguntas tipadas, y te devuelve la respuesta con su probabilidad.

🤖 Cada turno sale una sola llamada con la mesa entera y vuelve la dirección de
los diez corredores que siguen vivos: nueve probabilidades por jugador, sin
modelo local ni respaldo escondido.

⚙️ El motor es determinista y se prueba sin navegador; el motor gráfico solo
dibuja.

🛰️ Y como el modelo es de pago, le puse una consola que muestra el **JSON
exacto** de la petición y de la respuesta, los tokens, la latencia y el costo:
unos 0,00015 USD por jugada.

Y no, no me olvidé del trabajo: hago software —sobre todo de inteligencia
artificial— para el sistema eléctrico colombiano, y esto es una prueba para algo
que quiero montar en la comercialización de energía. Ahí el patrón es el mismo:
agentes que deciden —comprar, vender, esperar— con información incompleta,
reglas que cambian y costo real por equivocarse. "Estado + preguntas tipadas →
probabilidades calibradas" es justo la pieza que quería probar.

Es una prueba de concepto personal, no un producto. Pero me divertí y aprendí
más que en varios spikes "serios".

🎥 En el video: una ronda completa decidiéndose sola.

#InteligenciaArtificial #Software #Energía #ComercializaciónDeEnergía
#MercadoEléctrico #Colombia

---

## Version corta (si quieres algo mas directo)

El que piensa que las pruebas de concepto son aburridas es porque se toma el
trabajo demasiado en serio. 😄

Hice **Have No Mouth, and I Must Scream IA**: un Pong donde un roce mata y las
jugadas las decide un modelo de IA por API. El modelo es **Jev 1.13** de
TypeSafe, el de moda para decisiones estructuradas: el estado de la mesa entra,
la dirección de los diez corredores sale, y una consola muestra el JSON de cada
petición, los tokens y el costo.

Hago software de IA para el sistema eléctrico colombiano, y esto es una prueba
para la comercialización de energía: agentes que deciden con información
incompleta y reglas que cambian. Prueba de concepto personal, no producto.

🎥 El video: una ronda completa decidiéndose sola.

#InteligenciaArtificial #Energía #MercadoEléctrico #Colombia

---

## Notas para publicar

- Adjunta el video en la parte de arriba del post: LinkedIn le da más alcance.
- El gancho tiene que quedar en la primera línea, que es lo único que se ve
  antes del "ver más".
- Si quieres etiquetar a alguien del sector o a la herramienta, va al final,
  nunca al principio.
- No pongas enlaces en el cuerpo: si necesitas uno, déjalo en el primer
  comentario.

---

## Ficha del modelo (para que no te pillen en los comentarios)

- **Modelo:** Jev 1.13, de TypeSafe. Alias: `jev-latest` (resuelve a
  `jev-1.13.0`, que es lo que reporta la API y lo que verás en la consola).
- **Familia:** "System One" — modelos de decisión, no de conversación.
- **Qué recibe:** un `state` (texto o JSON) y unas `questions` tipadas
  (`choice`, `noul`, `score`).
- **Qué devuelve:** una respuesta por pregunta, con probabilidad y confianza.
  En el juego, una `choice` con nueve opciones por jugador.
- **Cobro:** solo los tokens de **entrada**; los de salida son gratis. $0,042
  por millón de tokens de entrada.
- **Contexto:** 64k tokens por petición (32k para el estado más la pregunta más
  larga). Este juego gasta unos 3.000–3.500 tokens por decisión.
- **Idioma:** Jev está entrenado sobre todo en inglés; el prompt del juego va en
  español y funciona, pero es bueno saberlo si alguien pregunta.
