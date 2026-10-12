import { z } from 'zod';

import {
  fractionOfBand,
  isPriceBand,
  isQuantityBand,
  priceOfBand,
  type PriceBandId,
  type QuantityBandId,
} from '@/lib/bolsa/constants';
import type { AgentId, Offer, Resource } from '@/lib/bolsa/types';

import type { SystemOneAnswer } from './contracts';

/** Contratos de red de BOLSA (mensual). El cliente manda el mercado y recibe ofertas. */

export const agentIdSchema = z.enum([
  'azul',
  'verde',
  'turquesa',
  'rojo',
  'naranja',
  'amarillo',
  'morado',
  'rosa',
  'cian',
  'lima',
  'violeta',
  'marron',
]);

const periodSchema = z.object({
  month: z.string(),
  demandGwh: z.number(),
  bolsaRef: z.number(),
  escasez: z.number(),
  embalsePct: z.number(),
  aportePct: z.number(),
});

const resourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['hidro', 'termica', 'solar', 'eolica']),
  owner: agentIdSchema,
  capacityGwh: z.number().nonnegative(),
  cost: z.number(),
  enfi: z.number().nonnegative(),
  fuel: z.enum(['gas', 'carbon', 'acpm']).nullable(),
  embalse: z.string().nullable(),
  emissions: z.number().nonnegative(),
});

const embalseSchema = z.object({ id: z.string(), name: z.string(), region: z.string(), river: z.string() });

const agentSchema = z.object({
  id: agentIdSchema,
  name: z.string(),
  color: z.string(),
  role: z.enum(['generador', 'comercializador']),
  cash: z.number(),
  alive: z.boolean(),
  resources: z.array(z.string()),
  lastOffers: z.record(z.string(), z.object({ price: z.number(), quantityGwh: z.number().nonnegative() })),
  demandGwh: z.number().nonnegative(),
  coverage: z.number().min(0).max(1),
  contractPrice: z.number().nonnegative(),
  tariff: z.number().nonnegative(),
});

const dispatchedUnitSchema = z.object({
  resourceId: z.string(),
  agentId: agentIdSchema,
  price: z.number(),
  quantityGwh: z.number(),
});

const monthRecordSchema = z.object({
  monthIndex: z.number(),
  month: z.string(),
  demandGwh: z.number(),
  marginalPrice: z.number(),
  deficitGwh: z.number(),
  importedGwh: z.number(),
  emissionsTon: z.number(),
  dispatched: z.array(dispatchedUnitSchema),
});

const scoreSchema = z.object({
  monthsServed: z.number(),
  deficitMonths: z.number(),
  avgMarginal: z.number(),
  avgBolsaRef: z.number(),
  emissionsTon: z.number(),
  insolvencies: z.number(),
});

export const marketStateSchema = z.object({
  monthIndex: z.number().int().nonnegative(),
  months: z.number().int().positive(),
  periods: z.array(periodSchema).min(1).max(120),
  demandGwh: z.number().nonnegative(),
  embalsePct: z.number(),
  escasez: z.number().nonnegative(),
  marginalPrice: z.number().nullable(),
  priceHistory: z.array(z.number()),
  bolsaHistory: z.array(z.number()),
  resources: z.array(resourceSchema).min(1).max(64),
  embalses: z.array(embalseSchema).max(32),
  agents: z.array(agentSchema).min(1).max(32),
  tieCapacityGwh: z.number().nonnegative(),
  tiePrice: z.number().nonnegative(),
  carbonPrice: z.number().nonnegative(),
  reconciliationPerGwh: z.number().nonnegative(),
  oefPenalty: z.number().nonnegative(),
  deficitMonths: z.number().int().nonnegative(),
  lastMonth: monthRecordSchema.nullable(),
  winner: z.enum(['agentes', 'escasez']).nullable(),
  finished: z.boolean(),
  score: scoreSchema,
});

export const bolsaDecisionRequestSchema = z.object({
  market: marketStateSchema,
  model: z.string().trim().min(1).max(120).optional(),
  sessionId: z.string().trim().min(1).max(120).optional(),
});

export type BolsaDecisionRequest = z.infer<typeof bolsaDecisionRequestSchema>;

export interface BolsaDecisionResponse {
  model: string;
  latencyMs: number;
  offers: Partial<Record<AgentId, Record<string, Offer>>>;
  usage: { inputTokens: number | null; outputTokens: number | null };
}

function topBand<T extends string>(answer: SystemOneAnswer, isValid: (value: unknown) => value is T, fallback: T): T {
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

export const normalizePriceBand = (answer: SystemOneAnswer): PriceBandId =>
  isPriceBand(answer.choice) ? answer.choice : topBand(answer, isPriceBand, 'media');

export const normalizeQuantityBand = (answer: SystemOneAnswer): QuantityBandId =>
  isQuantityBand(answer.choice) ? answer.choice : topBand(answer, isQuantityBand, '100');

export function offerFromBands(resource: Resource, priceBand: PriceBandId, quantityBand: QuantityBandId): Offer {
  return {
    price: priceOfBand(priceBand),
    quantityGwh: Math.max(0, Math.min(resource.capacityGwh, fractionOfBand(quantityBand) * resource.capacityGwh)),
  };
}
