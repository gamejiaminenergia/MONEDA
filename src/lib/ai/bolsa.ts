import { z } from 'zod';

import {
  isPriceBand,
  isQuantityBand,
  fractionOfBand,
  priceOfBand,
  type PriceBandId,
  type QuantityBandId,
} from '@/lib/bolsa/constants';
import type { AgentId, Generator, Offer } from '@/lib/bolsa/types';

import type { SystemOneAnswer } from './contracts';

/**
 * Contratos de red de BOLSA. El cliente manda el estado del mercado (datos) y
 * recibe las ofertas ya normalizadas. Nada se confia sin validar.
 */

export const agentIdSchema = z.enum(['azul', 'verde', 'turquesa', 'rojo', 'naranja', 'amarillo']);

const generatorSchema = z.object({
  id: agentIdSchema,
  name: z.string(),
  color: z.string(),
  kind: z.enum(['hidro', 'termica']),
  capacityMw: z.number().nonnegative(),
  cost: z.number(),
  embalseMw: z.number().nonnegative(),
  embalseMaxMw: z.number().nonnegative(),
  inflowMw: z.number().nonnegative(),
  cash: z.number(),
  lastOffer: z.object({ price: z.number(), quantityMw: z.number().nonnegative() }),
  alive: z.boolean(),
});

export const marketStateSchema = z.object({
  hour: z.number().int().nonnegative(),
  horizonHours: z.number().int().positive(),
  demandMw: z.number().nonnegative(),
  sequia: z.number().min(0).max(1),
  marginalPrice: z.number().nullable(),
  scarcityPrice: z.number().nonnegative(),
  priceHistory: z.array(z.number()),
  generators: z.array(generatorSchema).min(1).max(12),
  blackouts: z.number().int().nonnegative(),
  winner: z.enum(['agentes', 'escasez']).nullable(),
  finished: z.boolean(),
});

export const bolsaDecisionRequestSchema = z.object({
  market: marketStateSchema,
  model: z.string().trim().min(1).max(120).optional(),
  /** Partida en curso: el servidor archiva las llamadas bajo este id. */
  sessionId: z.string().trim().min(1).max(120).optional(),
});

export type BolsaDecisionRequest = z.infer<typeof bolsaDecisionRequestSchema>;

export interface BolsaDecisionResponse {
  model: string;
  latencyMs: number;
  /** Oferta por agente que seguia vivo cuando se pregunto. */
  offers: Partial<Record<AgentId, Offer>>;
  usage: { inputTokens: number | null; outputTokens: number | null };
}

/** Elige la banda mas probable cuando el modelo no devolvio una valida. */
function topBand<T extends string>(
  answer: SystemOneAnswer,
  isValid: (value: unknown) => value is T,
  fallback: T,
): T {
  let best: T | null = null;
  let bestProbability = -1;
  for (const [key, value] of Object.entries(answer.probabilities ?? {})) {
    if (!isValid(key)) continue;
    const probability = Number(value);
    if (!Number.isFinite(probability) || probability <= bestProbability) continue;
    bestProbability = probability;
    best = key;
  }
  return best ?? fallback;
}

export function normalizePriceBand(answer: SystemOneAnswer): PriceBandId {
  return isPriceBand(answer.choice) ? answer.choice : topBand(answer, isPriceBand, 'media');
}

export function normalizeQuantityBand(answer: SystemOneAnswer): QuantityBandId {
  return isQuantityBand(answer.choice) ? answer.choice : topBand(answer, isQuantityBand, '100');
}

/** Convierte las dos bandas elegidas en la oferta concreta del agente. */
export function offerFromBands(
  generator: Pick<Generator, 'capacityMw'>,
  priceBand: PriceBandId,
  quantityBand: QuantityBandId,
): Offer {
  return {
    price: priceOfBand(priceBand),
    quantityMw: Math.max(0, Math.min(generator.capacityMw, fractionOfBand(quantityBand) * generator.capacityMw)),
  };
}
