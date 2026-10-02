import type { Move } from './moves';
import type { Side } from './sides';

export type { Move, Side };

export type PaddleIndex = 0 | 1;
export type PaddleDir = -1 | 0 | 1;
export type DecisionSource = 'model' | 'heuristic';

export type SideRecord<T> = Record<Side, T>;

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Un paddle vive en el eje de su equipo: `pos` es la Y para los equipos de los
 * lados y la X para los de arriba/abajo. Todo lo demas se mueve con `dir`.
 */
export interface PaddleState {
  pos: number;
  dir: PaddleDir;
}

export type PaddlePair = [PaddleState, PaddleState];

/** Vista serializable de un equipo: es lo que viaja al servidor. */
export interface SideSnapshot {
  arrival: number;
  paddles: [{ pos: number }, { pos: number }];
  lives: number;
  alive: boolean;
}

export interface GameSnapshot {
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    verticalDirection: 'sube' | 'baja' | 'recta';
    horizontalDirection: Side;
  };
  sides: SideRecord<SideSnapshot>;
  /** Vidas con las que arranco cada equipo: el modelo necesita saber el limite. */
  startingLives: number;
  rally: number;
  paused: boolean;
  winner: Side | null;
}

/**
 * Decision ya normalizada: una jugada por paddle, con probabilidades
 * marginales por paddle. Es el contrato que el cliente consume.
 */
export interface SideDecision {
  /** Eleccion cruda tal como la devolvio el modelo, p.ej. "subir|bajar". */
  choice: string;
  moves: [Move, Move];
  /** Probabilidad de cada combinacion "a|b". */
  probabilities: Record<string, number>;
  /** Probabilidad marginal de cada jugada, por paddle. */
  marginals: [Record<Move, number>, Record<Move, number>];
  confidence: number;
  source: DecisionSource;
}

export type DecisionBundle = Partial<SideRecord<SideDecision>>;

export type GameEvent =
  | { type: 'paddle-hit'; side: Side; x: number; y: number; rally: number }
  | { type: 'wall'; x: number; y: number }
  | { type: 'serve'; toward: Side }
  | { type: 'life-lost'; side: Side; lives: number; lost: number }
  | { type: 'death'; side: Side }
  | { type: 'game-over'; winner: Side };

export interface PaddleUiState {
  pos: number;
  move: Move | null;
  probability: number;
}

export interface SideUiState {
  paddles: [PaddleUiState, PaddleUiState];
  choice: string | null;
  confidence: number;
  source: DecisionSource | null;
  lives: number;
  lost: number;
  alive: boolean;
}

/** Estado estable para la UI. Se recalcula solo cuando algo cambia. */
export interface UiState {
  version: number;
  sides: SideRecord<SideUiState>;
  startingLives: number;
  winner: Side | null;
  paused: boolean;
  thinking: boolean;
  rally: number;
  maxRally: number;
  points: number;
  aliveCount: number;
  decisions: number;
  avgLatencyMs: number | null;
  lastLatencyMs: number | null;
  lastSource: DecisionSource | null;
}
