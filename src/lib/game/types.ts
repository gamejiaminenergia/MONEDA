import type { Cell } from './grid';
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
  /** Celda de la grilla que ocupa. */
  cell: Cell;
  /** Cuantos corredores vivos comparten esa celda (el jugador incluido). */
  cellCount: number;
  alive: boolean;
}

/** La grilla antiagolpamiento tal como la ve el modelo. */
export interface GridSpec {
  /** Lado de una celda, en px. */
  cell: number;
  cols: number;
  rows: number;
  /** Mas de esto en una celda y empieza a contar para reventar. */
  limit: number;
  /** Revisiones consecutivas sobre el limite que aguanta antes de reventar. */
  strikes: number;
  /** Cada cuanto se revisa la aglomeracion. */
  checkMs: number;
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
  /** La grilla antiagolpamiento: lado de celda, tamano y umbral. */
  grid: GridSpec;
  /** Velocidad a la que se mueve un corredor. */
  runnerSpeed: number;
  /** Tiempo de ronda que, cumplido con alguien vivo, da la tregua colectiva. */
  survivalMs: number;
  clockMs: number;
  paused: boolean;
  winner: Player | null;
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

/** Que mato al jugador: el roce de la bola o la aglomeracion en su celda. */
export type KillCause = 'ball' | 'crowd';

export type GameEvent =
  /** Un jugador muere: por la bola o por apinarse en una celda. */
  | { type: 'kill'; player: Player; x: number; y: number; cause: KillCause }
  | { type: 'wall'; x: number; y: number }
  | { type: 'serve'; toward: Player }
  | { type: 'death'; player: Player }
  /** Fin de ronda. `winner` es `null` solo si la grilla se llevo a todos. */
  | { type: 'game-over'; winner: Player | null }
  /** Se cumplio el minuto: reviven los muertos y la ronda es de todos. */
  | { type: 'truce' };

/** La grilla tal como la ve el renderer: conteo de vivos por celda. */
export interface GridView {
  cell: number;
  cols: number;
  rows: number;
  limit: number;
  /** Corredores vivos por celda, indexado `row * cols + col`. */
  counts: number[];
}

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
  winner: Player | null;
  /** La ronda acabo sin nadie en pie: una celda se los llevo a todos. */
  draw: boolean;
  /** Se aguanto el minuto: tregua, reviven los muertos y ganan todos. */
  truce: boolean;
  paused: boolean;
  thinking: boolean;
  aliveCount: number;
  decisions: number;
  avgLatencyMs: number | null;
  lastLatencyMs: number | null;
  /** Rebotes de la bola contra las paredes en toda la partida. */
  bounces: number;
  /** Cuantos corredores han muerto en la partida. */
  kills: number;
  /** De esos, cuantos murieron apinados en una celda. */
  crowdKills: number;
  clockMs: number;
  ballSpeed: number;
}
