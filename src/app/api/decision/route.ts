import { NextResponse } from 'next/server';

import type { DecisionResponse, ErrorResponse } from '@/lib/ai/contracts';
import { decisionRequestSchema } from '@/lib/ai/contracts';
import { heuristicDecision } from '@/lib/ai/heuristic';
import { normalizeDecision } from '@/lib/ai/normalize';
import { buildQuestions, buildStatePrompt } from '@/lib/game/prompt';
import { SIDES, SIDE_NAME, type Side } from '@/lib/game/sides';
import type { DecisionBundle } from '@/lib/game/types';
import { askSystemOne, OllamaError, ollamaConfig } from '@/server/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEURISTIC = 'heuristic';

type Strategy = 'auto' | 'model' | 'heuristic';

function strategyFromEnv(): Strategy {
  const value = process.env.DECISION_STRATEGY;
  return value === 'model' || value === 'heuristic' ? value : 'auto';
}

function fail(error: string, code: ErrorResponse['code'], status: number) {
  return NextResponse.json<ErrorResponse>({ error, code }, { status });
}

const aliveSides = (snapshot: { sides: Record<Side, { alive: boolean }> }): Side[] =>
  SIDES.filter((side) => snapshot.sides[side].alive);

/**
 * POST /api/decision
 *
 * Recibe el estado del juego (datos) y devuelve la jugada de cada equipo vivo.
 * Todo el trabajo con el LLM ocurre aqui: el navegador nunca habla con Ollama,
 * asi que no hay problemas de CORS ni de exponer la URL del servidor.
 *
 * El prompt incluye siempre las vidas de los cuatro equipos y la regla de
 * muerte, para que ningun modelo juegue sin saber que a las N derrotas muere.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('El cuerpo de la peticion no es JSON valido', 'bad-request', 400);
  }

  const parsed = decisionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return fail('El estado del juego no tiene el formato esperado', 'bad-request', 400);
  }

  const { snapshot } = parsed.data;
  const config = ollamaConfig();
  const strategy: Strategy = parsed.data.strategy ?? strategyFromEnv();
  const requestedModel = parsed.data.model?.trim();
  const model = requestedModel && requestedModel !== 'auto' ? requestedModel : config.model;
  const startedAt = Date.now();

  const heuristic = (fallbackReason: string | null): DecisionResponse => ({
    model: HEURISTIC,
    strategy: 'heuristic',
    latencyMs: Date.now() - startedAt,
    sides: heuristicDecision(snapshot),
    usage: { inputTokens: null, outputTokens: null },
    fallbackReason,
  });

  if (strategy === 'heuristic' || model === HEURISTIC) {
    return NextResponse.json(heuristic(null));
  }

  try {
    const alive = aliveSides(snapshot);
    if (alive.length === 0) {
      return NextResponse.json<DecisionResponse>({
        model,
        strategy: 'model',
        latencyMs: Date.now() - startedAt,
        sides: {},
        usage: { inputTokens: null, outputTokens: null },
        fallbackReason: 'no queda ningun equipo vivo',
      });
    }

    const result = await askSystemOne({
      model,
      state: buildStatePrompt(snapshot),
      questions: buildQuestions(alive),
      signal: request.signal,
      timeoutMs: config.timeoutMs,
    });

    const sides: DecisionBundle = {};
    for (const side of alive) {
      const answer = result.answers[SIDE_NAME[side]];
      if (!answer) {
        throw new OllamaError('ollama-malformed', `El modelo no respondio por el equipo ${SIDE_NAME[side]}`);
      }
      sides[side] = normalizeDecision(answer, side, 'model');
    }

    const response: DecisionResponse = {
      model,
      strategy: 'model',
      latencyMs: Date.now() - startedAt,
      sides,
      usage: {
        inputTokens: result.usage?.input_tokens ?? null,
        outputTokens: result.usage?.output_tokens ?? null,
      },
      fallbackReason: null,
    };
    return NextResponse.json(response);
  } catch (error) {
    // Si el cliente cancela, no hay a quien responder.
    if (error instanceof Error && error.name === 'AbortError') return new Response(null, { status: 499 });

    const ollamaError =
      error instanceof OllamaError
        ? error
        : new OllamaError('ollama-unreachable', error instanceof Error ? error.message : 'Error desconocido');

    if (strategy === 'auto') return NextResponse.json(heuristic(ollamaError.message));
    return fail(ollamaError.message, ollamaError.code, 502);
  }
}
