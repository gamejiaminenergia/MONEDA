import { BALL_MAX, BALL_MIN, DANGER_R, PLAY_MAX, PLAY_MIN } from './constants';
import type { BallState, Point } from './types';

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** Mantiene una coordenada dentro de la mesa. */
export const clampPlay = (value: number, min = PLAY_MIN, max = PLAY_MAX): number =>
  clamp(value, min, max);

export const clampPoint = (point: Point, min = PLAY_MIN, max = PLAY_MAX): Point => ({
  x: clampPlay(point.x, min, max),
  y: clampPlay(point.y, min, max),
});

export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Distancia minima de un punto al segmento `a -> b`. */
export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const span = dx * dx + dy * dy;
  if (span === 0) return distance(point, a);
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / span, 0, 1);
  return distance(point, { x: a.x + t * dx, y: a.y + t * dy });
}

/**
 * ¿El tramo que recorrio la bola en este paso la toco? Es un barrido del
 * segmento, no una comparacion de posiciones: por rapido que vaya el proyectil
 * no puede atravesar a un corredor sin que se note.
 */
export const segmentHitsCircle = (a: Point, b: Point, center: Point, radius: number): boolean =>
  distanceToSegment(center, a, b) <= radius;

/** Modulo siempre positivo: `a` puede ser negativo. */
const mod = (a: number, b: number): number => ((a % b) + b) % b;

/**
 * Coordenada de una particula elastica dentro de `[lo, hi]` al cabo de
 * `seconds`, rebotando en los dos extremos. Las cuatro paredes de la mesa son
 *_axes_, asi que cada eje se resuelve por separado y el resultado es exacto.
 */
export function reflect(coord: number, velocity: number, seconds: number, lo: number, hi: number): number {
  const span = hi - lo;
  if (span <= 0) return lo;
  const period = 2 * span;
  const u = mod(coord - lo + velocity * seconds, period);
  return lo + (u <= span ? u : period - u);
}

/** Donde estara la bola dentro de `ms`, rebotes incluidos. */
export const ballAt = (ball: BallState, ms: number, lo = BALL_MIN, hi = BALL_MAX): Point => {
  const seconds = ms / 1000;
  return {
    x: reflect(ball.x, ball.vx, seconds, lo, hi),
    y: reflect(ball.y, ball.vy, seconds, lo, hi),
  };
};

/** Milisegundos que tarda la bola en llegar a un extremo del eje, o `Infinity`. */
function timeToEdge(coord: number, velocity: number, lo: number, hi: number): number {
  if (velocity > 0) return ((hi - coord) / velocity) * 1000;
  if (velocity < 0) return ((lo - coord) / velocity) * 1000;
  return Number.POSITIVE_INFINITY;
}

/**
 * El vuelo que se puede planificar: desde ahora hasta el proximo rebote.
 *
 * A partir del rebote la bola tuerce, asi que su rumbo deja de ser conocido.
 * Quien decide solo puede mirar este tramo; lo que pase despues no se sabe.
 */
export interface Flight {
  at: (ms: number) => Point;
  /** Milisegundos que quedan hasta el siguiente rebote. */
  untilMs: number;
}

export function flightOf(ball: BallState, lo = BALL_MIN, hi = BALL_MAX): Flight {
  const untilMs = Math.min(
    timeToEdge(ball.x, ball.vx, lo, hi),
    timeToEdge(ball.y, ball.vy, lo, hi),
  );
  return {
    untilMs,
    at: (ms: number) => ballAt(ball, Math.min(ms, untilMs), lo, hi),
  };
}

export interface Threat {
  /** Milisegundos hasta el roce. */
  ms: number;
  /** Punto de la bola en ese instante. */
  point: Point;
}

/**
 * Cuanto falta para que la bola entre en `radius` de `target`. Solo se
 * responde hasta el proximo rebote: despues la bola tuerce y no hay nada que
 * predecir. `null` significa "de este tramo no te mueres".
 */
export function predictThreat(
  ball: BallState,
  target: Point,
  radius: number = DANGER_R,
  maxMs = 3000,
  lo = BALL_MIN,
  hi = BALL_MAX,
): Threat | null {
  if (distance(ball, target) <= radius) return { ms: 0, point: { x: ball.x, y: ball.y } };

  const flight = flightOf(ball, lo, hi);
  const horizon = Math.min(maxMs, flight.untilMs);
  if (!Number.isFinite(horizon)) return null;

  const speed = Math.hypot(ball.vx, ball.vy);
  // La bola no puede avanzar mas de medio radio por muestra, asi que no se
  // salta la ventana de peligro por muy rapido que vaya.
  const stepMs = speed > 0 ? clamp((radius / speed) * 1000 * 0.5, 8, 40) : 40;
  for (let ms = stepMs; ms <= horizon; ms += stepMs) {
    if (distance(flight.at(ms), target) > radius) continue;
    // Bisección para no devolver un tiempo redondeado al paso de muestreo.
    let low = ms - stepMs;
    let high = ms;
    for (let round = 0; round < 8; round++) {
      const middle = (low + high) / 2;
      if (distance(flight.at(middle), target) <= radius) high = middle;
      else low = middle;
    }
    return { ms: high, point: flight.at(high) };
  }
  return null;
}
