import type { Point } from './types';

/**
 * Los diez jugadores. Cada uno lleva el nombre de su color: ese nombre es su
 * identidad en la mesa, la clave de la pregunta que recibe el modelo y el color
 * con el que se pinta.
 *
 * Los diez puntos de salida caen sobre un mismo circulo alrededor del centro,
 * repartidos cada 36 grados. Todos arrancan a la misma distancia de la bola y
 * de las paredes: nadie empieza con ventaja, que es la mitad de que el juego se
 * decida por decision y no por suerte.
 */
export const PLAYERS = [
  'rojo',
  'naranja',
  'amarillo',
  'lima',
  'verde',
  'turquesa',
  'cian',
  'azul',
  'morado',
  'rosa',
] as const;

export type Player = (typeof PLAYERS)[number];

/** Identificador de la pregunta que recibe el modelo, uno por jugador. */
export type QuestionId = Player;

/** Nombre del jugador: es tambien el id de su pregunta. */
export const PLAYER_NAME: Record<Player, QuestionId> = {
  rojo: 'rojo',
  naranja: 'naranja',
  amarillo: 'amarillo',
  lima: 'lima',
  verde: 'verde',
  turquesa: 'turquesa',
  cian: 'cian',
  azul: 'azul',
  morado: 'morado',
  rosa: 'rosa',
};

export const PLAYER_LABEL: Record<Player, string> = {
  rojo: 'ROJO',
  naranja: 'NARANJA',
  amarillo: 'AMARILLO',
  lima: 'LIMA',
  verde: 'VERDE',
  turquesa: 'TURQUESA',
  cian: 'CIAN',
  azul: 'AZUL',
  morado: 'MORADO',
  rosa: 'ROSA',
};

/** Hex de cada jugador: unica fuente de verdad para el canvas y la interfaz. */
export const PLAYER_HEX: Record<Player, string> = {
  rojo: '#ff5c5c',
  naranja: '#ff9f43',
  amarillo: '#ffd93d',
  lima: '#a6ff4d',
  verde: '#38ff9c',
  turquesa: '#2ee6c5',
  cian: '#39d8ff',
  azul: '#5b8dff',
  morado: '#b06bff',
  rosa: '#ff5cf0',
};

/** El mismo color como entero 0xRRGGBB, que es lo que quiere Canvas 2D. */
export const PLAYER_COLOR: Record<Player, number> = Object.fromEntries(
  PLAYERS.map((player) => [player, Number.parseInt(PLAYER_HEX[player].slice(1), 16)]),
) as Record<Player, number>;

/**
 * Punto de aparicion de cada jugador: los diez sobre el circulo de radio 240,
 * en el mismo orden que `PLAYERS` y separados 36 grados.
 */
export const PLAYER_RING_R = 240;

export const PLAYER_SPAWN: Record<Player, Point> = {
  rojo: { x: 360, y: 120 },
  naranja: { x: 501, y: 166 },
  amarillo: { x: 588, y: 286 },
  lima: { x: 588, y: 434 },
  verde: { x: 501, y: 554 },
  turquesa: { x: 360, y: 600 },
  cian: { x: 219, y: 554 },
  azul: { x: 132, y: 434 },
  morado: { x: 132, y: 286 },
  rosa: { x: 219, y: 166 },
};

export const isPlayer = (value: unknown): value is Player =>
  typeof value === 'string' && (PLAYERS as readonly string[]).includes(value);

export const playerFromName = (name: string): Player | null =>
  PLAYERS.find((player) => PLAYER_NAME[player] === name) ?? null;

export const otherPlayers = (player: Player): Player[] =>
  PLAYERS.filter((candidate) => candidate !== player);
