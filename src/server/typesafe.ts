import 'server-only';

import {
  systemOneResponseSchema,
  type SystemOneResponse,
} from '@/lib/ai/contracts';
import type { QuestionSet } from '@/lib/game/prompt';
import { elapsedMs, logger, logsPrompts } from './log';
import { ModelError } from './model-error';

const log = logger.child('typesafe');

/** Cuerpo exacto que se manda a `/v1/systemone`. */
export interface SystemOneRequest {
  model: string;
  state: string;
  questions: QuestionSet;
}

export interface SystemOneInput {
  model: string;
  state: string;
  questions: QuestionSet;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Respuesta ya validada mas los cuerpos crudos: la consola del navegador
 * muestra el JSON tal cual salio y tal cual llego, sin reconstruirlo.
 */
export interface SystemOneCall extends SystemOneResponse {
  requestBody: SystemOneRequest;
  responseBody: unknown;
}

export interface TypesafeConfig {
  url: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

/** TypeSafe es un servicio remoto: la URL y el modelo son suyos, no ajustes. */
const DEFAULT_URL = 'https://api.typesafe.ai';
const DEFAULT_MODEL = 'jev-latest';

export function typesafeConfig(): TypesafeConfig {
  const timeout = Number(process.env.TYPESAFE_TIMEOUT_MS);
  // Una variable vacia (`TYPESAFE_URL=`) cuenta como ausente: el default manda.
  const url = (process.env.TYPESAFE_URL ?? '').trim() || DEFAULT_URL;
  const model = (process.env.TYPESAFE_MODEL ?? '').trim() || DEFAULT_MODEL;
  return {
    url: url.replace(/\/+$/, ''),
    apiKey: (process.env.TYPESAFE_API_KEY ?? '').trim(),
    model,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 30_000,
  };
}

/**
 * Una decision contra la API de TypeSafe. Mismo contrato que el `/v1/systemone`
 * local, con dos diferencias que importan:
 *  - la peticion lleva `Authorization: Bearer <TYPESAFE_API_KEY>`, que solo
 *    vive en el servidor (el navegador nunca ve la clave);
 *  - un 401/403 es `model-unauthorized`, no un fallo generico, porque casi
 *    siempre significa clave ausente, vencida o sin saldo.
 */
export async function askSystemOne(input: SystemOneInput): Promise<SystemOneCall> {
  const { url, apiKey, timeoutMs } = typesafeConfig();
  if (!apiKey) {
    throw new ModelError(
      'model-not-configured',
      'TypeSafe no esta configurado: falta TYPESAFE_API_KEY',
    );
  }

  const startedAt = Date.now();
  const questions = Object.keys(input.questions).length;
  const signals = [AbortSignal.timeout(input.timeoutMs ?? timeoutMs)];
  if (input.signal) signals.push(input.signal);

  log.debug('consulta enviada', {
    model: input.model,
    questions,
    stateChars: input.state.length,
    timeoutMs: input.timeoutMs ?? timeoutMs,
  });
  if (logsPrompts()) {
    log.debug('prompt', { model: input.model, state: input.state, questions: input.questions });
  }

  const requestBody: SystemOneRequest = {
    model: input.model,
    state: input.state,
    questions: input.questions,
  };

  let response: Response;
  try {
    response = await fetch(`${url}/v1/systemone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.any(signals),
      cache: 'no-store',
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'TimeoutError') {
      log.warn('timeout', { model: input.model, ms: elapsedMs(startedAt), timeoutMs: input.timeoutMs ?? timeoutMs });
      throw new ModelError('model-timeout', `TypeSafe no respondio en ${input.timeoutMs ?? timeoutMs} ms`, { cause });
    }
    // El cliente cerro la pestana o cancelo: no es un fallo de TypeSafe.
    if (input.signal?.aborted || (cause instanceof Error && cause.name === 'AbortError')) {
      log.debug('consulta cancelada', { model: input.model, ms: elapsedMs(startedAt) });
      throw cause;
    }
    log.error('no se pudo contactar TypeSafe', { url, model: input.model, error: cause });
    throw new ModelError('model-unreachable', `No se pudo contactar TypeSafe en ${url}`, { cause });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 401 || response.status === 403) {
      log.warn('TypeSafe rechazo la clave', { status: response.status, model: input.model, ms: elapsedMs(startedAt) });
      throw new ModelError(
        'model-unauthorized',
        `TypeSafe rechazo la API key (${response.status})${body ? `: ${body.slice(0, 200)}` : ''}`,
      );
    }
    log.warn('TypeSafe respondio con error', {
      status: response.status,
      model: input.model,
      ms: elapsedMs(startedAt),
      body: body.slice(0, 200),
    });
    throw new ModelError('model-http', `TypeSafe respondio ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    log.warn('la respuesta de TypeSafe no era JSON', { status: response.status, model: input.model, ms: elapsedMs(startedAt) });
    throw new ModelError('model-malformed', 'La respuesta de TypeSafe no era JSON', { cause });
  }

  const parsed = systemOneResponseSchema.safeParse(payload);
  if (!parsed.success) {
    log.warn('la respuesta de TypeSafe no cumple el contrato', {
      model: input.model,
      ms: elapsedMs(startedAt),
      issues: parsed.error.issues.length,
    });
    throw new ModelError('model-malformed', 'La respuesta de TypeSafe no cumple el contrato esperado');
  }

  log.info('respuesta', {
    model: input.model,
    ms: elapsedMs(startedAt),
    answers: Object.keys(parsed.data.answers).length,
    inTokens: parsed.data.usage?.input_tokens ?? null,
    outTokens: parsed.data.usage?.output_tokens ?? null,
  });
  return { ...parsed.data, requestBody, responseBody: payload };
}

export interface TypesafeModel {
  name: string;
  description: string | null;
}

/** Catalogo de modelos de TypeSafe (`GET /v1/models`). */
export async function listTypesafeModels(timeoutMs = 6000): Promise<TypesafeModel[]> {
  const { url, apiKey } = typesafeConfig();
  if (!apiKey) {
    throw new ModelError('model-not-configured', 'TypeSafe no esta configurado: falta TYPESAFE_API_KEY');
  }

  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(`${url}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
  } catch (cause) {
    log.debug('no se pudo listar modelos', { url, ms: elapsedMs(startedAt), error: cause });
    throw new ModelError('model-unreachable', `No se pudo contactar TypeSafe en ${url}`, { cause });
  }
  if (response.status === 401 || response.status === 403) {
    log.warn('TypeSafe rechazo la clave al listar modelos', { status: response.status, url, ms: elapsedMs(startedAt) });
    throw new ModelError('model-unauthorized', `TypeSafe rechazo la API key (${response.status})`);
  }
  if (!response.ok) {
    log.debug('listado de modelos con error', { status: response.status, url, ms: elapsedMs(startedAt) });
    throw new ModelError('model-http', `TypeSafe respondio ${response.status}`);
  }

  const payload = (await response.json()) as {
    models?: { name?: unknown; description?: unknown }[];
  };
  const models = (payload.models ?? [])
    .flatMap((model) => {
      if (typeof model.name !== 'string') return [];
      return [{ name: model.name, description: typeof model.description === 'string' ? model.description : null }];
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  log.debug('modelos disponibles', { count: models.length, ms: elapsedMs(startedAt), names: models.map((model) => model.name) });
  return models;
}
