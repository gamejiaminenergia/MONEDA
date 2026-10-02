/**
 * Medidas de la mesa, en pixeles del lienzo logico. Es cuadrada: los diez
 * jugadores arrancan en las mismas condiciones y las cuatro paredes rebotan
 * igual.
 */
export const W = 720;
export const H = 720;
export const PAD = 24;

export const BALL_R = 10;
/** Radio del jugador: el punto que se mueve huyendo de la bola. */
export const RUNNER_R = 14;

/** Pausa antes de que la bola salga tras un saque o una muerte. */
export const SERVE_PAUSE_MS = 700;

/**
 * Cuanto se queda en pantalla el cartel del ganador antes de arrancar la
 * ronda siguiente. El bucle no espera a que nadie pulse nada: este es el
 * unico freno entre partidas.
 */
export const AUTO_RESTART_MS = 3500;

export const CENTER = H / 2;

/**
 * Velocidad de la bola. Va deliberadamente por debajo de la del jugador
 * (300 px/s) y no la cambian ni los rebotes ni las muertes: asi una decision
 * tarda en quedar obsoleta y el juego se puede leer y planificar en vez de
 * adivinar. La mesa ya no se cierra ni acelera sola.
 *
 * El jugador si puede moverla en vivo con el control del panel
 * (`MIN_BALL_SPEED`..`MAX_BALL_SPEED`); el tope se queda cerca de la velocidad
 * del corredor para que el juego siga siendo de decision y no de reflejos.
 */
export const BALL_SPEED = 210;

/** Rango del control "velocidad de la bola", en px/s. */
export const MIN_BALL_SPEED = 90;
export const MAX_BALL_SPEED = 420;
export const BALL_SPEED_STEP = 10;

/**
 * Cuanto tuerce el rumbo la bola en cada rebote, en radianes.
 *
 * Sin esto la bola no cambia nunca de direccion: recorre siempre las mismas
 * cuatro rectas de la mesa y hay medio tablero donde no puede pasar nunca.
 * Los jugadores entonces acampan en una zona segura y la partida no acaba.
 * Un desvio pequeno en cada rebote deja el vuelo siguiente impredecible —el
 * modelo solo puede planificar hasta el proximo muro— y la mesa se va llenando.
 */
export const BOUNCE_SKEW_MIN = 0.08;
export const BOUNCE_SKEW_MAX = 0.3;

/** Velocidad de un jugador: tiene que ganarle a la bola, no solo esquivarla. */
export const RUNNER_SPEED = 300;

/** Limites del CENTRO de un jugador: no puede salirse de la mesa. */
export const PLAY_MIN = PAD + RUNNER_R;
export const PLAY_MAX = W - PAD - RUNNER_R;

/** Limites del CENTRO de la bola: la cara interna de las cuatro paredes. */
export const BALL_MIN = PAD + BALL_R;
export const BALL_MAX = W - PAD - BALL_R;

/** Un roce basta: si la bola toca al corredor, muere. */
export const KILL_R = BALL_R + RUNNER_R;
/** Radio de aviso: la prediccion avisa antes de que el roce sea mortal. */
export const DANGER_R = KILL_R + 30;

export const DEFAULT_INTERVAL_MS = 700;
export const MIN_INTERVAL_MS = 300;
export const MAX_INTERVAL_MS = 2000;
