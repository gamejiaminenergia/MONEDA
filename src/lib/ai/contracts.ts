import { z } from 'zod';

import { PLAYERS, type Player } from '@/lib/game/players';
import type { PlayerDecision } from '@/lib/game/types';

/**
 * Contratos de red del juego. El cliente manda un snapshot (datos, no texto)
 * y recibe decisiones normalizadas. Nada de esto se confia sin validar.
 */

const playerSchema = z.enum(PLAYERS);

const compassSchema = z.enum([
  'arriba-izquierda',
  'arriba',
  'arriba-derecha',
  'derecha',
  'abajo-derecha',
  'abajo',
  'abajo-izquierda',
  'izquierda',
]);

const playerSnapshotSchema = z.object({
  x: z.number(),
  y: z.number(),
  distance: z.number().nonnegative(),
  threatMs: z.number().nonnegative().nullable(),
  threatX: z.number().nullable(),
  threatY: z.number().nullable(),
  cell: z.object({
    col: z.number().int().nonnegative(),
    row: z.number().int().nonnegative(),
  }),
  cellCount: z.number().int().nonnegative(),
  alive: z.boolean(),
});

/** Las diez entradas del snapshot, una por jugador. */
const playerSnapshotsShape = Object.fromEntries(
  PLAYERS.map((player) => [player, playerSnapshotSchema]),
) as Record<Player, typeof playerSnapshotSchema>;

export const snapshotSchema = z.object({
  ball: z.object({
    x: z.number(),
    y: z.number(),
    vx: z.number(),
    vy: z.number(),
    speed: z.number().nonnegative(),
    direction: compassSchema,
  }),
  players: z.object(playerSnapshotsShape),
  killRadius: z.number().positive(),
  dangerRadius: z.number().positive(),
  field: z.object({ min: z.number(), max: z.number() }),
  ballField: z.object({ min: z.number(), max: z.number() }),
  grid: z.object({
    cell: z.number().positive(),
    cols: z.number().int().positive(),
    rows: z.number().int().positive(),
    limit: z.number().int().positive(),
    strikes: z.number().int().positive(),
    checkMs: z.number().positive(),
  }),
  runnerSpeed: z.number().nonnegative(),
  survivalMs: z.number().nonnegative(),
  clockMs: z.number().nonnegative(),
  paused: z.boolean(),
  winner: playerSchema.nullable(),
});

export const decisionRequestSchema = z.object({
  snapshot: snapshotSchema,
  model: z.string().trim().min(1).max(120).optional(),
  /** El cliente puede pedir que no se guarde la traza de esta peticion. */
  trace: z.boolean().optional(),
  /**
   * Partida en curso. Con esto el servidor archiva la peticion y la respuesta
   * crudas de Jev bajo esa partida, para adjuntarlas al documento al guardarla.
   */
  matchId: z.string().trim().min(1).max(120).optional(),
});

export type DecisionRequest = z.infer<typeof decisionRequestSchema>;

/**
 * Respuesta cruda del endpoint /v1/systemone de TypeSafe. El campo `type` que
 * agrega la API se ignora al validar: solo nos quedan `choice`, `probabilities`
 * y `confidence`.
 */
export const systemOneAnswerSchema = z.object({
  choice: z.string().min(1),
  probabilities: z.record(z.string(), z.coerce.number()).optional(),
  confidence: z.coerce.number().optional(),
});

export const systemOneResponseSchema = z.object({
  /** Version que respondio (p.ej. `jev-1.13.0`), util para la traza y el log. */
  model: z.string().optional(),
  answers: z.record(z.string(), systemOneAnswerSchema),
  usage: z
    .object({
      input_tokens: z.coerce.number().optional(),
      output_tokens: z.coerce.number().optional(),
    })
    .optional(),
});

export type SystemOneAnswer = z.infer<typeof systemOneAnswerSchema>;
export type SystemOneResponse = z.infer<typeof systemOneResponseSchema>;

/** Fallos de un proveedor, ya normalizados para el navegador. */
export type ModelErrorCode =
  | 'model-unreachable'
  | 'model-timeout'
  | 'model-http'
  | 'model-malformed'
  | 'model-unauthorized'
  | 'model-not-configured';

/** Contrato de salida del API propio: decisiones ya normalizadas. */
export interface DecisionResponse {
  model: string;
  latencyMs: number;
  /** Solo los corredores que seguian vivos cuando se pregunto. */
  players: Partial<Record<Player, PlayerDecision>>;
  usage: { inputTokens: number | null; outputTokens: number | null };
}

export interface ErrorResponse {
  error: string;
  code: ModelErrorCode | 'bad-request';
}

/**
 * Una partida entera, tal como se guarda en la coleccion `matches`.
 *
 * El navegador la manda a `POST /api/matches` cuando la ronda cierra y el
 * servidor le agrega la fecha (`at`) y el `_id`. No es un resumen: lleva la
 * ronda completa —configuracion, desenlace, decisiones del modelo, eventos y
 * el muestreo de posiciones— para poder analizarla despues. Cada documento
 * tiene `matchId` propio, asi que dos partidas nunca se confunden.
 */
export const matchOutcomeSchema = z.enum(['winner', 'draw', 'truce']);

/** Posicion de un corredor en un instante muestreado. */
export const matchSamplePlayerSchema = z.object({
  x: z.number(),
  y: z.number(),
  alive: z.boolean(),
  cell: z.object({
    col: z.number().int().nonnegative(),
    row: z.number().int().nonnegative(),
  }),
  /** Cuantos vivos comparten su celda en ese instante. */
  cellCount: z.number().int().nonnegative(),
});

const matchSamplePlayersShape = Object.fromEntries(
  PLAYERS.map((player) => [player, matchSamplePlayerSchema]),
) as Record<Player, typeof matchSamplePlayerSchema>;

/** Una foto de la mesa: la bola y los diez corredores en un `clockMs`. */
export const matchSampleSchema = z.object({
  clockMs: z.number().nonnegative(),
  ball: z.object({ x: z.number(), y: z.number(), vx: z.number(), vy: z.number() }),
  players: z.object(matchSamplePlayersShape),
});

/** Una jugada del modelo, con lo que respondio para cada jugador vivo. */
export const matchDecisionSchema = z.object({
  clockMs: z.number().nonnegative(),
  model: z.string(),
  latencyMs: z.number().nonnegative(),
  /** Direccion elegida por color, p.ej. `{ rojo: "arriba-derecha" }`. */
  moves: z.record(z.string(), z.string()),
  /** Probabilidad que dio a cada direccion, por color. */
  probabilities: z.record(z.string(), z.record(z.string(), z.number())),
});

/** Un evento del motor con el reloj de ronda en que ocurrio. */
export const matchEventSchema = z.object({
  clockMs: z.number().nonnegative(),
  type: z.enum(['wall', 'kill', 'death', 'serve', 'game-over', 'truce']),
  player: playerSchema.optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  cause: z.enum(['ball', 'crowd']).optional(),
  toward: playerSchema.optional(),
  winner: playerSchema.nullable().optional(),
});

/** La configuracion con la que se jugo: sin esto el analisis no es comparable. */
export const matchConfigSchema = z.object({
  intervalMs: z.number().int().nonnegative(),
  /** Velocidad de la bola al cerrar la ronda, en px/s. */
  ballSpeed: z.number().nonnegative(),
  runnerSpeed: z.number().nonnegative(),
  killRadius: z.number(),
  dangerRadius: z.number(),
  survivalMs: z.number().nonnegative(),
  grid: z.object({
    cols: z.number().int().positive(),
    rows: z.number().int().positive(),
    cell: z.number().positive(),
    limit: z.number().int().positive(),
    strikes: z.number().int().positive(),
    checkMs: z.number().positive(),
  }),
});

/** El desenlace y los contadores finales de la ronda. */
export const matchResultSchema = z.object({
  clockMs: z.number().nonnegative(),
  /** Meta de tiempo de la ronda (el minuto). Queda explicita para el analisis. */
  survivalMs: z.number().positive(),
  /** `true` si la ronda llego al minuto: la unica forma de guardarse. */
  reachedMinute: z.boolean(),
  decisions: z.number().int().nonnegative(),
  avgLatencyMs: z.number().nonnegative().nullable(),
  bounces: z.number().int().nonnegative(),
  kills: z.number().int().nonnegative(),
  /** De esas muertes, cuantas fueron por aglomeracion en una celda. */
  crowdKills: z.number().int().nonnegative(),
  aliveCount: z.number().int().nonnegative(),
  /** Colores vivos al cerrar: 1 con ganador, 0 en empate, 10 en tregua. */
  alive: z.array(playerSchema),
});

export const matchDocumentSchema = z.object({
  /** Identidad unica de la partida (`crypto.randomUUID`), la clave del analisis. */
  matchId: z.string().min(1).max(120),
  /** Numero de ronda desde que se abrio la pestana. */
  round: z.number().int().positive(),
  /** Como acabo: gano uno, se la llevo la grilla o hubo tregua colectiva. */
  outcome: matchOutcomeSchema,
  /** Ganador individual; `null` en empate y en tregua. */
  winner: playerSchema.nullable(),
  /** Modelo que estaba decidiendo cuando cerro la ronda. */
  model: z.string().trim().min(1).max(120),
  config: matchConfigSchema,
  result: matchResultSchema,
  /** Muestreo de la mesa durante toda la ronda. */
  samples: z.array(matchSampleSchema).max(20_000),
  decisions: z.array(matchDecisionSchema).max(20_000),
  events: z.array(matchEventSchema).max(50_000),
});

/**
 * Una llamada cruda a Jev, archivada para adjuntarla a la partida.
 *
 * La peticion (`state` + `questions`) y la respuesta las arma el servidor, no
 * el navegador; por eso no viajan en `MatchDocument` y se enlazan por
 * `matchId` al guardar. Es lo que permite analizar exactamente que vio el
 * modelo y que contesto en cada turno.
 */
export const modelCallSchema = z.object({
  /** Reloj de ronda en que se hizo la llamada. */
  clockMs: z.number().nonnegative(),
  /** Modelo pedido (alias o version). */
  model: z.string(),
  /** El cuerpo exacto que viajo a Jev: `model`, `state` y `questions`. */
  request: z.object({
    model: z.string(),
    state: z.string(),
    questions: z.record(z.string(), z.unknown()),
  }),
  /** El JSON exacto que devolvio Jev; `null` si la llamada fallo. */
  response: z.unknown().nullable(),
  usage: z.object({
    inputTokens: z.number().nullable(),
    outputTokens: z.number().nullable(),
  }),
  latencyMs: z.number().nonnegative(),
  status: z.enum(['ok', 'error']),
  errorCode: z.string().nullable(),
});

export type ModelCall = z.infer<typeof modelCallSchema>;

export type MatchDocument = z.infer<typeof matchDocumentSchema>;

/**
 * Una partida solo se guarda si llego al minuto. Las que terminan antes (gano
 * uno, o la grilla vacio la mesa) no son completas y se descartan.
 */
export const isCompleteMatch = (match: Pick<MatchDocument, 'outcome'>): boolean =>
  match.outcome === 'truce';
export type MatchSample = z.infer<typeof matchSampleSchema>;
export type MatchDecision = z.infer<typeof matchDecisionSchema>;
export type MatchEventRecord = z.infer<typeof matchEventSchema>;
export type MatchConfig = z.infer<typeof matchConfigSchema>;
