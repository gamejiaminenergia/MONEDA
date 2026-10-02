import { NextResponse } from 'next/server';

import type { DecisionResponse, ErrorResponse } from '@/lib/ai/contracts';
import { decisionRequestSchema } from '@/lib/ai/contracts';
import { normalizeDecision } from '@/lib/ai/normalize';
import { buildQuestions, buildStatePrompt } from '@/lib/game/prompt';
import { PLAYERS, PLAYER_NAME, type Player } from '@/lib/game/players';
import type { DecisionBundle } from '@/lib/game/types';
import { elapsedMs, logger, logsPrompts } from '@/server/log';
import { ModelError } from '@/server/model-error';
import { pushTrace } from '@/server/trace';
import { askSystemOne, typesafeConfig, type SystemOneRequest } from '@/server/typesafe';

const log = logger.child('api/decision');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fail(error: string, code: ErrorResponse['code'], status: number) {
  return NextResponse.json<ErrorResponse>({ error, code }, { status });
}

const alivePlayers = (snapshot: { players: Record<Player, { alive: boolean }> }): Player[] =>
  PLAYERS.filter((player) => snapshot.players[player].alive);

/**
 * POST /api/decision
 *
 * Recibe el estado del juego (datos) y devuelve la jugada de cada jugador vivo.
 * Todo el trabajo con el modelo ocurre aqui: el navegador nunca habla con
 * TypeSafe ni ve la API key.
 *
 * El prompt incluye siempre la amenaza que ve cada jugador y la regla de
 * muerte, para que el modelo no juegue sin saber que un roce lo elimina.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    log.warn('cuerpo de la peticion invalido', { reason: 'no es JSON' });
    return fail('El cuerpo de la peticion no es JSON valido', 'bad-request', 400);
  }

  const parsed = decisionRequestSchema.safeParse(body);
  if (!parsed.success) {
    log.warn('snapshot fuera de contrato', { issues: parsed.error.issues.length });
    return fail('El estado del juego no tiene el formato esperado', 'bad-request', 400);
  }

  const { snapshot } = parsed.data;
  const config = typesafeConfig();
  const requestedModel = parsed.data.model?.trim();
  const model = requestedModel && requestedModel !== 'auto' ? requestedModel : config.model;
  const traced = parsed.data.trace !== false;
  const startedAt = Date.now();

  if (!config.apiKey) {
    log.error('falta TYPESAFE_API_KEY', { model });
    return fail(
      'TypeSafe no esta configurado: falta TYPESAFE_API_KEY',
      'model-not-configured',
      502,
    );
  }

  // Se arma una sola vez: el mismo JSON se manda al modelo y se guarda en la
  // traza, para que la consola muestre exactamente lo que viajo.
  const alive = alivePlayers(snapshot);
  const state = buildStatePrompt(snapshot);
  const questions = buildQuestions(alive);
  const requestBody: SystemOneRequest = { model, state, questions };

  try {
    log.debug('consulta al modelo', {
      model,
      alive: alive.length,
      clockMs: snapshot.clockMs,
      ballSpeed: snapshot.ball.speed,
      fieldMin: snapshot.field.min,
    });

    if (alive.length === 0) {
      log.debug('sin jugadores vivos', { model, ms: elapsedMs(startedAt) });
      return NextResponse.json<DecisionResponse>({
        model,
        latencyMs: Date.now() - startedAt,
        players: {},
        usage: { inputTokens: null, outputTokens: null },
      });
    }

    const result = await askSystemOne({
      model,
      state,
      questions,
      signal: request.signal,
      timeoutMs: config.timeoutMs,
    });

    const players: DecisionBundle = {};
    for (const player of alive) {
      const answer = result.answers[PLAYER_NAME[player]];
      if (!answer) {
        log.warn('respuesta incompleta', {
          model,
          missing: PLAYER_NAME[player],
          answered: Object.keys(result.answers),
        });
        throw new ModelError('model-malformed', `El modelo no respondio por el jugador ${PLAYER_NAME[player]}`);
      }
      players[player] = normalizeDecision(answer);
    }

    const usage = {
      inputTokens: result.usage?.input_tokens ?? null,
      outputTokens: result.usage?.output_tokens ?? null,
    };

    if (traced) {
      pushTrace({
        model,
        answeredModel: result.model ?? null,
        request: requestBody,
        response: result.responseBody,
        moves: Object.fromEntries(
          Object.entries(players).map(([player, decision]) => [player, decision?.move ?? '—']),
        ),
        usage,
        latencyMs: Date.now() - startedAt,
        alive: alive.length,
        clockMs: snapshot.clockMs,
        status: 'ok',
        errorCode: null,
        message: null,
      });
    }

    log.info('decision', {
      model,
      answered: result.model ?? null,
      ms: elapsedMs(startedAt),
      alive: alive.length,
      inTokens: usage.inputTokens,
      outTokens: usage.outputTokens,
    });
    if (logsPrompts()) {
      log.debug('jugadas', {
        moves: Object.fromEntries(Object.entries(players).map(([player, move]) => [player, move?.move ?? '—'])),
      });
    }

    return NextResponse.json<DecisionResponse>({
      model,
      latencyMs: Date.now() - startedAt,
      players,
      usage,
    });
  } catch (error) {
    // Si el cliente cancela (cerro la pestana, recargo), no hay a quien
    // responder y tampoco es un fallo del modelo.
    if (request.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      log.debug('peticion cancelada por el cliente', { model, ms: elapsedMs(startedAt) });
      return new Response(null, { status: 499 });
    }

    const modelError =
      error instanceof ModelError
        ? error
        : new ModelError('model-unreachable', error instanceof Error ? error.message : 'Error desconocido');
    log.error('fallo del modelo', {
      code: modelError.code,
      model,
      ms: elapsedMs(startedAt),
      error: modelError,
    });
    if (traced) {
      pushTrace({
        model,
        answeredModel: null,
        request: requestBody,
        response: null,
        moves: null,
        usage: { inputTokens: null, outputTokens: null },
        latencyMs: Date.now() - startedAt,
        alive: alive.length,
        clockMs: snapshot.clockMs,
        status: 'error',
        errorCode: modelError.code,
        message: modelError.message,
      });
    }
    return fail(modelError.message, modelError.code, 502);
  }
}
