/** Las ocho direcciones de la mesa mas quedarse quieto. */
export type Move =
  | 'arriba'
  | 'abajo'
  | 'izquierda'
  | 'derecha'
  | 'arriba-izquierda'
  | 'arriba-derecha'
  | 'abajo-izquierda'
  | 'abajo-derecha'
  | 'quedarse';

/** Las mismas ocho sin la opcion de quieto: es lo que puede hacer una bola. */
export type Compass = Exclude<Move, 'quedarse'>;

export const ALL_MOVES: readonly Move[] = [
  'arriba-izquierda',
  'arriba',
  'arriba-derecha',
  'derecha',
  'abajo-derecha',
  'abajo',
  'abajo-izquierda',
  'izquierda',
  'quedarse',
];

export const ALL_COMPASS: readonly Compass[] = ALL_MOVES.filter(
  (move): move is Compass => move !== 'quedarse',
);

/** Diagonales normalizadas: moverse en diagonal no es mas rapido que en recto. */
const DIAGONAL = Math.SQRT1_2;

export interface Vec2Like {
  x: number;
  y: number;
}

/**
 * Desplazamiento por paso de tiempo de cada jugada. El vector ya viene
 * normalizado, asi que el motor solo multiplica por la velocidad.
 */
export const MOVE_VEC: Record<Move, Vec2Like> = {
  'arriba-izquierda': { x: -DIAGONAL, y: -DIAGONAL },
  arriba: { x: 0, y: -1 },
  'arriba-derecha': { x: DIAGONAL, y: -DIAGONAL },
  derecha: { x: 1, y: 0 },
  'abajo-derecha': { x: DIAGONAL, y: DIAGONAL },
  abajo: { x: 0, y: 1 },
  'abajo-izquierda': { x: -DIAGONAL, y: DIAGONAL },
  izquierda: { x: -1, y: 0 },
  quedarse: { x: 0, y: 0 },
};

export const isMove = (value: unknown): value is Move =>
  typeof value === 'string' && (ALL_MOVES as readonly string[]).includes(value);

/** Etiquetas cortas para la interfaz. */
export const MOVE_LABEL: Record<Move, string> = {
  'arriba-izquierda': 'arr-izq',
  arriba: 'arriba',
  'arriba-derecha': 'arr-der',
  derecha: 'derecha',
  'abajo-derecha': 'ab-der',
  abajo: 'abajo',
  'abajo-izquierda': 'ab-izq',
  izquierda: 'izquierda',
  quedarse: 'quieto',
};

/**
 * Jugada que mas se acerca a apuntar en `(dx, dy)`. Se usa para decidir la
 * huida mas simple posible: alejarse del punto por donde llega la bola.
 */
export function moveToward(dx: number, dy: number): Move {
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return 'quedarse';
  const ux = dx / length;
  const uy = dy / length;
  let best: Move = 'quedarse';
  let bestScore = 0;
  for (const move of ALL_MOVES) {
    const vector = MOVE_VEC[move];
    const score = vector.x * ux + vector.y * uy;
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

/** Nombre de la direccion en la que se mueve un vector, en las ocho nomenclature. */
export const compassOf = (vx: number, vy: number): Compass => {
  if (vx === 0 && vy === 0) return 'derecha';
  return moveToward(vx, vy) as Compass;
};
