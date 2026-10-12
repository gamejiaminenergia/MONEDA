import { NextResponse } from 'next/server';

import {
  bolsaDecisionRequestSchema,
  normalizePriceBand,
  normalizeQuantityBand,
  offerFromBands,
  type BolsaDecisionResponse,
} from '@/lib/ai/bolsa';
import type { ErrorResponse } from '@/lib/ai/contracts';
import { buildAgentQuestions, buildAgentState } from '@/lib/bolsa/prompt';
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
 * Recibe el estado del mercado y devuelve la oferta de cada agente vivo. A
 * diferencia de las bolitas, aqui hay **un Jev por agente**: cada uno decide su
 * oferta viendo solo su informacion privada. El navegador nunca habla con
 * TypeSafe ni ve la API key.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    log.warn('cuerpo invalido', { reason: 'no es JSON' });
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

  const alive = market.generators.filter((generator) => generator.alive);
  if (alive.length === 0) {
    return NextResponse.json<BolsaDecisionResponse>({
      model,
      latencyMs: Date.now() - startedAt,
      offers: {},
      usage: { inputTokens: null, outputTokens: null },
    });
  }

  // Las preguntas son las mismas para todos; cambia el estado privado de cada uno.
  const questions = buildAgentQuestions() as unknown as QuestionSet;

  const settled = await Promise.all(
    alive.map(async (generator) => {
      try {
        const call = await askSystemOne({
          model,
          state: buildAgentState(market, generator),
          questions,
          signal: request.signal,
          timeoutMs: config.timeoutMs,
        });
        const priceAnswer = call.answers.precio;
        const quantityAnswer = call.answers.cantidad;
        if (!priceAnswer || !quantityAnswer) {
          throw new ModelError('model-malformed', `Respuesta incompleta para ${generator.name}`);
        }
        const offer = offerFromBands(generator, normalizePriceBand(priceAnswer), normalizeQuantityBand(quantityAnswer));
        return { id: generator.id, offer, usage: call.usage ?? null, answered: call.model ?? null };
      } catch (error) {
        // Un agente sin respuesta no detiene la hora: el motor reusa su ultima oferta.
        log.warn('agente sin oferta', {
          id: generator.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    }),
  );

  const offers: Partial<Record<AgentId, Offer>> = {};
  let inputTokens: number | null = 0;
  let outputTokens: number | null = 0;
  let answered = 0;
  for (const item of settled) {
    if (!item) continue;
    offers[item.id] = item.offer;
    answered += 1;
    if (item.usage) {
      inputTokens = (inputTokens ?? 0) + (item.usage.input_tokens ?? 0);
      outputTokens = (outputTokens ?? 0) + (item.usage.output_tokens ?? 0);
    }
  }

  if (answered === 0) {
    log.error('ningun agente respondio', { model, ms: elapsedMs(startedAt) });
    return fail('Ningun agente obtuvo oferta del modelo', 'model-malformed', 502);
  }

  log.info('ofertas', {
    model,
    hora: market.hour,
    agentes: answered,
    inTokens: inputTokens,
    ms: elapsedMs(startedAt),
  });

  return NextResponse.json<BolsaDecisionResponse>({
    model,
    latencyMs: Date.now() - startedAt,
    offers,
    usage: { inputTokens, outputTokens },
  });
}
