import type { Compass, Move } from './moves';
import type { Player } from './players';

export type { Move, Player };
export type { Compass };

export type PlayerRecord<T> = Record<Player, T>;

export interface Point {
  x: number;
  y: number;
}

export type BallState = Point & {
  vx: number;
  vy: number;
};

/** Un jugador: su posicion en la mesa y la jugada que esta ejecutando. */
export interface RunnerState extends Point {
  move: Move;
}

/** Vista serializable de un jugador: es lo que viaja al servidor. */
export interface PlayerSnapshot extends Point {
  /** Distancia actual al centro de la bola. */
  distance: number;
  /** Milisegundos hasta que la bola le entre: `null` si no hay amenaza. */
  threatMs: number | null;
  /** Donde estara la bola en ese instante. */
  threatX: number | null;
  threatY: number | null;
  alive: boolean;
}

export interface GameSnapshot {
  ball: Point & {
    vx: number;
    vy: number;
    speed: number;
    /** Hacia donde va, en las ocho direcciones de la mesa. */
    direction: Compass;
  };
  players: PlayerRecord<PlayerSnapshot>;
  /** Radios de muerte y de aviso: el modelo necesita saber cuanto margen hay. */
  killRadius: number;
  dangerRadius: number;
  /** Limites del centro de un jugador con el marco actual. Se cierra solo. */
  field: { min: number; max: number };
  /** Limites del centro de la bola: donde rebota con el marco actual. */
  ballField: { min: number; max: number };
  /** Velocidad a la que se mueve un corredor. */
  runnerSpeed: number;
  /** Tiempo de ronda que, cumplido con alguien vivo, da la tregua colectiva. */
  survivalMs: number;
  clockMs: number;
  paused: boolean;
}

/** Decision ya normalizada: una sola direccion para el jugador. */
export interface PlayerDecision {
  /** Eleccion cruda tal como la devolvio el modelo, p.ej. "arriba-derecha". */
  choice: string;
  move: Move;
  /** Probabilidad de cada jugada. */
  probabilities: Record<string, number>;
  confidence: number;
}

export type DecisionBundle = Partial<PlayerRecord<PlayerDecision>>;

/**
 * Quien gana la ronda. Siempre hay un ganador: la bola negra si mata a los
 * diez, o las bolitas de colores si al minuto queda alguien vivo. No hay
 * tregua ni empate.
 */
export type Side = 'ball' | 'players';

export type GameEvent =
  /** La bola toco a un jugador: muere. Es la unica forma de morir. */
  | { type: 'kill'; player: Player; x: number; y: number }
  | { type: 'wall'; x: number; y: number }
  | { type: 'serve'; toward: Player }
  | { type: 'death'; player: Player }
  /** Fin de ronda. `winner` es `ball` o `players`. */
  | { type: 'over'; winner: Side };

export interface PlayerUiState extends Point {
  move: Move | null;
  probability: number;
  confidence: number;
  threatMs: number | null;
  alive: boolean;
}

/** Estado estable para la UI. Se recalcula solo cuando algo cambia. */
export interface UiState {
  version: number;
  players: PlayerRecord<PlayerUiState>;
  /** Quien gano: `ball` o `players`. `null` mientras la ronda corre. */
  winner: Side | null;
  paused: boolean;
  thinking: boolean;
  aliveCount: number;
  decisions: number;
  avgLatencyMs: number | null;
  lastLatencyMs: number | null;
  /** Rebotes de la bola contra las paredes en toda la partida. */
  bounces: number;
  /** Cuantos corredores se llevo la bola en la partida. */
  kills: number;
  clockMs: number;
  ballSpeed: number;
}
