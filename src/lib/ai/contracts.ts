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
  runnerSpeed: z.number().nonnegative(),
  clockMs: z.number().nonnegative(),
  paused: z.boolean(),
  winner: playerSchema.nullable(),
});

export const decisionRequestSchema = z.object({
  snapshot: snapshotSchema,
  model: z.string().trim().min(1).max(120).optional(),
  /** El cliente puede pedir que no se guarde la traza de esta peticion. */
  trace: z.boolean().optional(),
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
