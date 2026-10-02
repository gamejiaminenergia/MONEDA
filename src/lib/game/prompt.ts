import { combosFor, movesFor } from './moves';
import { arrangementOf, relationOf } from './physics';
import { SIDES, SIDE_AXIS, SIDE_NAME, type Axis, type QuestionId, type Side } from './sides';
import type { GameSnapshot } from './types';

export interface QuestionSpec {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
}

export type QuestionSet = Partial<Record<QuestionId, QuestionSpec>>;

/**
 * Criterios de la pregunta: describe cada una de las 9 combinaciones
 * "paddle A | paddle B" que el modelo puede elegir.
 */
export function comboCriteria(axis: Axis): Record<string, string> {
  const criteria: Record<string, string> = {};
  for (const combo of combosFor(axis)) {
    const [a, b] = combo.split('|');
    criteria[combo] = `paddle A ${a}, paddle B ${b}`;
  }
  return criteria;
}

/** Una pregunta por equipo vivo: los muertos no juegan. */
export function buildQuestions(alive: readonly Side[]): QuestionSet {
  const questions: QuestionSet = {};
  for (const side of alive) {
    const axis = SIDE_AXIS[side];
    questions[SIDE_NAME[side]] = {
      type: 'choice',
      instructions:
        `Jugada de los DOS paddles del equipo ${SIDE_NAME[side]} (A|B). ` +
        `Cada paddle solo puede ${movesFor(axis).join(', ')}.`,
      criteria: comboCriteria(axis),
    };
  }
  return questions;
}

/** Linea de vidas: es la informacion que no puede faltarle a ningun equipo. */
function livesLine(snapshot: GameSnapshot): string {
  return SIDES.map((side) => {
    const state = snapshot.sides[side];
    if (!state.alive) return `${SIDE_NAME[side]} MUERTO`;
    const edge = state.lives <= 3 ? ' AL BORDE DE MORIR' : '';
    return `${SIDE_NAME[side]} ${state.lives}/${snapshot.startingLives}${edge}`;
  }).join('; ');
}

function describeSide(side: Side, snapshot: GameSnapshot): string | null {
  const state = snapshot.sides[side];
  if (!state.alive) return null;
  const [a, b] = state.paddles;
  const label = SIDE_NAME[side].charAt(0).toUpperCase() + SIDE_NAME[side].slice(1);
  return (
    `${label} llegada A ${relationOf(state.arrival, a.pos)}, ` +
    `B ${relationOf(state.arrival, b.pos)} (${arrangementOf(a.pos, b.pos)})`
  );
}

/**
 * Convierte el snapshot en el texto en espanol que recibe el modelo.
 * Vive en el servidor para poder ajustar el prompt sin tocar el cliente.
 *
 * La regla de muerte y las vidas de cada equipo van arriba y en todos los
 * mensajes: ningun equipo puede jugar sin saber que a las 10 derrotas muere.
 */
export function buildStatePrompt(snapshot: GameSnapshot): string {
  const { ball } = snapshot;
  const vdir = ball.verticalDirection;
  const lado = ball.horizontalDirection === 'right' ? 'derecha' : 'izquierda';

  const rules =
    `Pong de 4 equipos en una mesa cuadrada: izquierda, derecha, arriba y abajo. ` +
    `Cada equipo tiene dos paddles (A y B) que solo se mueven por su propia pared. ` +
    `Cada vez que la bola supera la defensa de un equipo, ese equipo pierde una vida. ` +
    `El equipo que pierde ${snapshot.startingLives} veces MUERE: sus paddles desaparecen ` +
    `y su pared queda sellada. Gana el ultimo equipo que siga vivo.`;

  const situations = SIDES.map((side) => describeSide(side, snapshot)).filter(
    (text): text is string => text !== null,
  );

  const dead = SIDES.filter((side) => !snapshot.sides[side].alive).map((side) => SIDE_NAME[side]);
  const deadLine = dead.length > 0 ? ` Equipos muertos: ${dead.join(', ')}.` : '';

  return (
    `${rules} ` +
    `Vidas: ${livesLine(snapshot)}.${deadLine} ` +
    `Bola ${vdir} hacia ${lado}. ` +
    `${situations.join('. ')}. ` +
    'En cada equipo el paddle mas cercano cubre la llegada; el otro se separa, sin amontonarse.'
  );
}
