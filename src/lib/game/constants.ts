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

/** Rango del control "velocidad de la bola", en px/s. */
export const MIN_BALL_SPEED = 90;
/** El techo es el doble de la velocidad del corredor (300 px/s). */
export const MAX_BALL_SPEED = 840;
export const BALL_SPEED_STEP = 10;

/**
 * Velocidad de la bola por defecto: la **maxima** (840 px/s, casi el triple de
 * la del corredor). La bola no cambia de velocidad sola —ni los rebotes ni las
 * muertes la tocan— pero `setBallSpeed` (el control "velocidad bola" del panel)
 * la baja en vivo: el juego arranca en su punto mas brutal y el jugador puede
 * aflojarlo. Con la bola a tope, aguantar el minuto para la tregua es la hazaña.
 */
export const BALL_SPEED = MAX_BALL_SPEED;

/**
 * El round dura un minuto y siempre acaba con un ganador: si al cumplirlo queda
 * al menos un jugador vivo, reviven los muertos y **ganan las bolitas**; si la
 * bola los mata a todos antes, **gana la bola negra**. No hay tregua ni empate.
 */
export const SURVIVAL_MS = 60_000;

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
