/** Los cuatro equipos. Cada uno defiende una pared de la mesa. */
export const SIDES = ['left', 'right', 'top', 'bottom'] as const;

export type Side = (typeof SIDES)[number];

/** Eje por el que se mueven los paddles de cada equipo. */
export type Axis = 'x' | 'y';

export const SIDE_AXIS: Record<Side, Axis> = {
  left: 'y',
  right: 'y',
  top: 'x',
  bottom: 'x',
};

/** Identificador de la pregunta que recibe el modelo, uno por equipo. */
export type QuestionId = 'izquierda' | 'derecha' | 'arriba' | 'abajo';

/** Nombre en espanol del equipo: es tambien el id de su pregunta. */
export const SIDE_NAME: Record<Side, QuestionId> = {
  left: 'izquierda',
  right: 'derecha',
  top: 'arriba',
  bottom: 'abajo',
};

export const SIDE_LABEL: Record<Side, string> = {
  left: 'EQUIPO IZQUIERDO',
  right: 'EQUIPO DERECHO',
  top: 'EQUIPO SUPERIOR',
  bottom: 'EQUIPO INFERIOR',
};

export const isSide = (value: unknown): value is Side =>
  typeof value === 'string' && (SIDES as readonly string[]).includes(value);

export const sideFromName = (name: string): Side | null =>
  SIDES.find((side) => SIDE_NAME[side] === name) ?? null;

export const otherSides = (side: Side): Side[] => SIDES.filter((candidate) => candidate !== side);
