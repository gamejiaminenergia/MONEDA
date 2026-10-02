/**
 * Medidas de la mesa, en pixeles del lienzo logico. Es cuadrada: los cuatro
 * equipos tienen exactamente la misma pared que defender.
 */
export const W = 720;
export const H = 720;
export const PAD = 24;

export const PAD_W = 16;
export const PAD_H = 72;
export const BALL_R = 10;

export const PADDLE_SPEED = 560;
export const BALL_SPEED = 250;
export const MAX_VY = 380;
export const SERVE_PAUSE_MS = 700;

/** Mientras un paddle este a menos de esto de su objetivo, se detiene ahi. */
export const PADDLE_PARK_EPSILON = 16;

export const CENTER = H / 2;
/** Cara interna de los paddles: por ahi entra la bola. Vale igual en los 4 lados. */
export const PLANE = PAD + PAD_W;
export const LIMIT_MIN = PLANE;
export const LIMIT_MAX = W - PLANE;
/** Recorrido de un paddle a lo largo de su pared. */
export const PADDLE_MIN_POS = PAD + PAD_H / 2;
export const PADDLE_MAX_POS = W - PAD - PAD_H / 2;

/** Separacion inicial entre los dos paddles del mismo equipo. */
export const SPAWN_SPREAD = 70;

/** Vidas por equipo: al perder la ultima, el equipo muere. */
export const DEFAULT_LIVES = 10;
export const DEFAULT_INTERVAL_MS = 700;
export const MIN_INTERVAL_MS = 300;
export const MAX_INTERVAL_MS = 2000;

/** Paleta de la mesa (se reutiliza en CSS y en el renderer de canvas). */
export const COLORS = {
  bg: '#060911',
  bgTop: 0x0d1a2e,
  bgBottom: 0x060911,
  line: '#22304d',
  leftA: 0x38ff9c,
  leftB: 0x22d3ee,
  rightA: 0xff5cf0,
  rightB: 0xffa64d,
  topA: 0x39d8ff,
  topB: 0x7c9cff,
  bottomA: 0xffd93d,
  bottomB: 0xa6ff4d,
  ball: 0xffffff,
  ballGlow: 0x9fe8ff,
} as const;
