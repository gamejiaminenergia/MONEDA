import type { Axis } from './sides';

export type Move = 'subir' | 'bajar' | 'izquierda' | 'derecha' | 'quedarse';

/**
 * Los paddles solo se mueven por su propio eje: los equipos de los lados
 * (izquierda/derecha) suben y bajan, los de arriba/abajo se corren de lado.
 */
export const MOVES_BY_AXIS: Record<Axis, readonly Move[]> = {
  y: ['subir', 'bajar', 'quedarse'],
  x: ['izquierda', 'derecha', 'quedarse'],
};

export const ALL_MOVES: readonly Move[] = ['subir', 'bajar', 'izquierda', 'derecha', 'quedarse'];

/** Direccion asociada a cada jugada dentro de su eje. */
export const MOVE_DIR: Record<Move, -1 | 0 | 1> = {
  subir: -1,
  bajar: 1,
  izquierda: -1,
  derecha: 1,
  quedarse: 0,
};

export const movesFor = (axis: Axis): readonly Move[] => MOVES_BY_AXIS[axis];

export function isMoveForAxis(value: unknown, axis: Axis): value is Move {
  return typeof value === 'string' && (movesFor(axis) as readonly string[]).includes(value);
}

/** Las 9 combinaciones "a|b" que puede elegir un equipo (2 paddles x 3 jugadas). */
export const combosFor = (axis: Axis): string[] => {
  const moves = movesFor(axis);
  return moves.flatMap((a) => moves.map((b) => `${a}|${b}`));
};

export function splitCombo(combo: string, axis: Axis): [Move, Move] | null {
  const parts = combo.split('|');
  const [a, b] = parts;
  if (parts.length !== 2 || !isMoveForAxis(a, axis) || !isMoveForAxis(b, axis)) return null;
  return [a, b];
}
