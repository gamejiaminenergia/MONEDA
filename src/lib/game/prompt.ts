import { ALL_MOVES, type Move } from './moves';
import { PLAYERS, PLAYER_NAME, type QuestionId, type Player } from './players';
import type { GameSnapshot, PlayerSnapshot } from './types';

export interface QuestionSpec {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
}

export type QuestionSet = Partial<Record<QuestionId, QuestionSpec>>;

const MOVE_TEXT: Record<Move, string> = {
  'arriba-izquierda': 'hacia arriba-izquierda',
  arriba: 'hacia arriba',
  'arriba-derecha': 'hacia arriba-derecha',
  derecha: 'hacia derecha',
  'abajo-derecha': 'hacia abajo-derecha',
  abajo: 'hacia abajo',
  'abajo-izquierda': 'hacia abajo-izquierda',
  izquierda: 'hacia izquierda',
  quedarse: 'quedarse quieto',
};

/** Las nueve direcciones posibles. Una sola por jugador y por decision. */
export function moveCriteria(): Record<string, string> {
  const criteria: Record<string, string> = {};
  for (const move of ALL_MOVES) criteria[move] = MOVE_TEXT[move];
  return criteria;
}

/** Una pregunta por jugador vivo: los muertos ya no juegan. */
export function buildQuestions(alive: readonly Player[]): QuestionSet {
  const questions: QuestionSet = {};
  for (const player of alive) {
    questions[PLAYER_NAME[player]] = {
      type: 'choice',
      instructions:
        `Direccion del jugador ${PLAYER_NAME[player]}. Solo una por decision: ` +
        `${ALL_MOVES.join(', ')}. Elige la que mas se aleje de por donde pasa la bola ahora mismo.`,
      criteria: moveCriteria(),
    };
  }
  return questions;
}

const label = (player: Player): string => {
  const name = PLAYER_NAME[player];
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/** Como se ve la amenaza de un jugador, en una frase. */
function threatLine(snapshot: GameSnapshot, player: Player): string {
  const view: PlayerSnapshot = snapshot.players[player];
  const name = label(player);
  const where = `en (${view.x}, ${view.y})`;

  if (view.threatMs === null) {
    return `${name} ${where}, de este vuelo la bola no le pilla: aguanta hasta que rebote`;
  }
  if (view.threatMs === 0) {
    return `${name} ${where}, LA BOLA LE ESTA ENCIMA: moverse ya`;
  }
  return (
    `${name} ${where}, la bola le pilla en ${view.threatMs} ms por (${view.threatX}, ${view.threatY}); ` +
    `ahora esta a ${view.distance} px`
  );
}

/**
 * Convierte el snapshot en el texto en espanol que recibe el modelo.
 * Vive en el servidor para poder ajustar el prompt sin tocar el cliente.
 *
 * La regla de muerte viaja en cada mensaje: un roce y se acaba, no hay vidas
 * ni segunda oportunidad, y gana el ultimo jugador vivo.
 */
export function buildStatePrompt(snapshot: GameSnapshot): string {
  const { ball, field } = snapshot;

  const rules =
    `Mesa cuadrada con diez jugadores, cada uno con nombre de color: ${PLAYERS.join(', ')}. ` +
    `La bola rebota contra las paredes indefinidamente: no se pierde nunca y no hay saque que la salve. ` +
    `CADA REBOTE LA DESVIA un poco, asi que solo se puede planificar el vuelo que ` +
    `esta en marcha: de lo que pase despues del proximo muro nadie sabe nada. ` +
    `La bola no acelera sola: va a la velocidad que dice el estado, y la mesa no ` +
    `cambia de tamano. ` +
    `Si la bola toca a un jugador, ese jugador MUERE en el acto, sin vidas ni segunda oportunidad. ` +
    `Gana el ultimo jugador que siga vivo.`;

  const dead = PLAYERS.filter((player) => !snapshot.players[player].alive);
  const deadLine =
    dead.length > 0
      ? `Ya muertos: ${dead.map((player) => PLAYER_NAME[player]).join(', ')}.`
      : 'Todavia no ha muerto nadie.';

  const measures =
    `La mesa va de ${field.min} a ${field.max} en ambos ejes y un jugador corre a ${snapshot.runnerSpeed} px/s. ` +
    `La bola te mata a ${snapshot.killRadius} px de distancia y ya te avisa a ${snapshot.dangerRadius} px.`;

  const situations = PLAYERS.filter((player) => snapshot.players[player].alive)
    .map((player) => threatLine(snapshot, player))
    .join('. ');

  return (
    `${rules} ${deadLine} ${measures} ` +
    `Bola en (${ball.x}, ${ball.y}) a ${ball.speed} px/s, yendo hacia ${ball.direction}. ` +
    `${situations}. ` +
    'Elige donde poner los pies para el vuelo que se ve, no para el siguiente. ' +
    'Huye de la linea de la bola y no te metas en una esquina: el punto mas peligroso de la mesa es la esquina. ' +
    'Un solo paso por decision, asi que no llegas lejos.'
  );
}
