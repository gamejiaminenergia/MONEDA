import { z } from 'zod';

import type { Side } from '@/lib/game/sides';
import type { SideDecision } from '@/lib/game/types';

/**
 * Contratos de red del juego. El cliente manda un snapshot (datos, no texto)
 * y recibe decisiones normalizadas. Nada de esto se confia sin validar.
 */

const sideSchema = z.enum(['left', 'right', 'top', 'bottom']);

const paddlesSchema = z.tuple([z.object({ pos: z.number() }), z.object({ pos: z.number() })]);

const sideSnapshotSchema = z.object({
  arrival: z.number(),
  paddles: paddlesSchema,
  lives: z.number().int().nonnegative(),
  alive: z.boolean(),
});

export const snapshotSchema = z.object({
  ball: z.object({
    x: z.number(),
    y: z.number(),
    vx: z.number(),
    vy: z.number(),
    verticalDirection: z.enum(['sube', 'baja', 'recta']),
    horizontalDirection: sideSchema,
  }),
  sides: z.object({
    left: sideSnapshotSchema,
    right: sideSnapshotSchema,
    top: sideSnapshotSchema,
    bottom: sideSnapshotSchema,
  }),
  startingLives: z.number().int().positive(),
  rally: z.number().int().nonnegative(),
  paused: z.boolean(),
  winner: sideSchema.nullable(),
});

export const decisionRequestSchema = z.object({
  snapshot: snapshotSchema,
  model: z.string().trim().min(1).max(120).optional(),
  strategy: z.enum(['auto', 'model', 'heuristic']).optional(),
});

export type DecisionRequest = z.infer<typeof decisionRequestSchema>;

/** Respuesta cruda del endpoint /v1/systemone de Ollama. */
export const systemOneAnswerSchema = z.object({
  choice: z.string().min(1),
  probabilities: z.record(z.string(), z.coerce.number()).optional(),
  confidence: z.coerce.number().optional(),
});

export const systemOneResponseSchema = z.object({
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

/** Contrato de salida del API propio: decisiones ya normalizadas. */
export interface DecisionResponse {
  model: string;
  strategy: 'model' | 'heuristic';
  latencyMs: number;
  /** Solo los equipos que seguian vivos cuando se pregunto. */
  sides: Partial<Record<Side, SideDecision>>;
  usage: { inputTokens: number | null; outputTokens: number | null };
  fallbackReason: string | null;
}

export interface ErrorResponse {
  error: string;
  code: 'ollama-unreachable' | 'ollama-timeout' | 'ollama-http' | 'ollama-malformed' | 'bad-request';
}
