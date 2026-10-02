import { MAX_VY, PAD_H, PADDLE_MAX_POS, PADDLE_MIN_POS } from './constants';
import { SIDE_AXIS } from './sides';
import type { BallState, Side } from './types';

export type BallRelation = 'arriba' | 'altura' | 'abajo';

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** Posicion de la bola respecto a la franja que cubre el paddle. */
export function relationOf(ballPos: number, paddlePos: number): BallRelation {
  const top = paddlePos - PAD_H / 2;
  const bottom = paddlePos + PAD_H / 2;
  if (ballPos < top) return 'arriba';
  if (ballPos > bottom) return 'abajo';
  return 'altura';
}

/** Descripcion corta de como estan ordenados los dos paddles de un equipo. */
export function arrangementOf(aPos: number, bPos: number): string {
  if (aPos < bPos - 20) return 'A sobre B';
  if (aPos > bPos + 20) return 'A bajo B';
  return 'A junto a B';
}

/** Redondea la posicion del paddle al rango jugable de su pared. */
export const clampPaddlePos = (pos: number): number => clamp(pos, PADDLE_MIN_POS, PADDLE_MAX_POS);

/** Coordenada de la bola en el eje del equipo. */
export const coordOf = (ball: BallState, side: Side): number =>
  SIDE_AXIS[side] === 'y' ? ball.y : ball.x;

/**
 * Velocidad de la bola tras rebotar en un paddle: el angulo depende de que tan
 * lejos del centro pego. Box2D resuelve el choque; este es el sesgo arcade.
 */
export function bounceOff(
  paddlePos: number,
  ball: BallState,
  side: Side,
): Pick<BallState, 'vx' | 'vy'> {
  const offset = clamp((coordOf(ball, side) - paddlePos) / (PAD_H / 2), -1, 1);
  if (SIDE_AXIS[side] === 'y') {
    return { vx: (side === 'left' ? 1 : -1) * Math.abs(ball.vx), vy: offset * MAX_VY };
  }
  return { vx: offset * MAX_VY, vy: (side === 'top' ? 1 : -1) * Math.abs(ball.vy) };
}
