import { NextResponse } from 'next/server';

import {
  bolsaDecisionRequestSchema,
  normalizePriceBand,
  normalizeQuantityBand,
  offerFromBands,
  type BolsaDecisionResponse,
} from '@/lib/ai/bolsa';
import type { ErrorResponse } from '@/lib/ai/contracts';
import { buildGeneratorQuestions, buildGeneratorState } from '@/lib/bolsa/prompt';
import type { AgentId, Offer } from '@/lib/bolsa/types';
import type { QuestionSet } from '@/lib/game/prompt';
import { elapsedMs, logger } from '@/server/log';
import { ModelError } from '@/server/model-error';
import { askSystemOne, typesafeConfig } from '@/server/typesafe';

const log = logger.child('api/bolsa');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fail(error: string, code: ErrorResponse['code'], status: number) {
  return NextResponse.json<ErrorResponse>({ error, code }, { status });
}

/**
 * POST /api/bolsa/decision
 *
 * Devuelve la oferta de cada generador vivo, recurso por recurso. Hay **un Jev
 * por generador**: decide toda su cartera viendo solo su informacion privada. El
 * navegador nunca habla con TypeSafe ni ve la API key.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('El cuerpo de la peticion no es JSON valido', 'bad-request', 400);
  }

  const parsed = bolsaDecisionRequestSchema.safeParse(body);
  if (!parsed.success) {
    log.warn('estado fuera de contrato', { issues: parsed.error.issues.length });
    return fail('El estado del mercado no tiene el formato esperado', 'bad-request', 400);
  }

  const { market } = parsed.data;
  const config = typesafeConfig();
  const requested = parsed.data.model?.trim();
  const model = requested && requested !== 'auto' ? requested : config.model;
  const startedAt = Date.now();

  if (!config.apiKey) {
    log.error('falta TYPESAFE_API_KEY', { model });
    return fail('TypeSafe no esta configurado: falta TYPESAFE_API_KEY', 'model-not-configured', 502);
  }

  const generators = market.agents.filter((agent) => agent.role === 'generador' && agent.alive);
  if (generators.length === 0) {
    return NextResponse.json<BolsaDecisionResponse>({
      model,
      latencyMs: Date.now() - startedAt,
      offers: {},
      usage: { inputTokens: null, outputTokens: null },
    });
  }

  const settled = await Promise.all(
    generators.map(async (agent) => {
      try {
        const questions = buildGeneratorQuestions(agent, market) as unknown as QuestionSet;
        const call = await askSystemOne({
          model,
          state: buildGeneratorState(market, agent),
          questions,
          signal: request.signal,
          timeoutMs: config.timeoutMs,
        });
        const offers: Record<string, Offer> = {};
        for (const resourceId of agent.resources) {
          const resource = market.resources.find((item) => item.id === resourceId);
          const priceAnswer = call.answers[`${resourceId}__precio`];
          const quantityAnswer = call.answers[`${resourceId}__cantidad`];
          if (!resource || !priceAnswer || !quantityAnswer) continue;
          offers[resourceId] = offerFromBands(resource, normalizePriceBand(priceAnswer), normalizeQuantityBand(quantityAnswer));
        }
        if (Object.keys(offers).length === 0) {
          throw new ModelError('model-malformed', `Sin ofertas para ${agent.name}`);
        }
        return { id: agent.id, offers, usage: call.usage ?? null };
      } catch (error) {
        // Un generador sin respuesta no detiene la hora: el motor reusa su ultima oferta.
        log.warn('generador sin oferta', { id: agent.id, error: error instanceof Error ? error.message : String(error) });
        return null;
      }
    }),
  );

  const offers: Partial<Record<AgentId, Record<string, Offer>>> = {};
  let inputTokens: number | null = 0;
  let outputTokens: number | null = 0;
  let answered = 0;
  for (const item of settled) {
    if (!item) continue;
    offers[item.id] = item.offers;
    answered += 1;
    if (item.usage) {
      inputTokens = (inputTokens ?? 0) + (item.usage.input_tokens ?? 0);
      outputTokens = (outputTokens ?? 0) + (item.usage.output_tokens ?? 0);
    }
  }

  if (answered === 0) {
    log.error('ningun generador respondio', { model, ms: elapsedMs(startedAt) });
    return fail('Ningun generador obtuvo oferta del modelo', 'model-malformed', 502);
  }

  log.info('ofertas', { model, mes: market.monthIndex, generadores: answered, inTokens: inputTokens, ms: elapsedMs(startedAt) });

  return NextResponse.json<BolsaDecisionResponse>({
    model,
    latencyMs: Date.now() - startedAt,
    offers,
    usage: { inputTokens, outputTokens },
  });
}
