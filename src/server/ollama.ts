import 'server-only';

import {
  systemOneResponseSchema,
  type SystemOneResponse,
} from '@/lib/ai/contracts';
import type { QuestionSet } from '@/lib/game/prompt';

export type OllamaErrorCode =
  | 'ollama-unreachable'
  | 'ollama-timeout'
  | 'ollama-http'
  | 'ollama-malformed';

export class OllamaError extends Error {
  readonly code: OllamaErrorCode;

  constructor(code: OllamaErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'OllamaError';
    this.code = code;
  }
}

export interface OllamaConfig {
  url: string;
  model: string;
  timeoutMs: number;
}

const DEFAULT_URL = 'http://127.0.0.1:11434';

export function ollamaConfig(): OllamaConfig {
  const timeout = Number(process.env.OLLAMA_TIMEOUT_MS);
  return {
    url: (process.env.OLLAMA_URL ?? DEFAULT_URL).replace(/\/+$/, ''),
    model: process.env.OLLAMA_MODEL ?? 'nimble',
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 30_000,
  };
}

export interface SystemOneInput {
  model: string;
  state: string;
  questions: QuestionSet;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Una decision. Timeout + abort combinados para no dejar peticiones colgadas. */
export async function askSystemOne(input: SystemOneInput): Promise<SystemOneResponse> {
  const { url, timeoutMs } = ollamaConfig();
  const signals = [AbortSignal.timeout(input.timeoutMs ?? timeoutMs)];
  if (input.signal) signals.push(input.signal);

  let response: Response;
  try {
    response = await fetch(`${url}/v1/systemone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: input.model,
        state: input.state,
        questions: input.questions,
      }),
      signal: AbortSignal.any(signals),
      cache: 'no-store',
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'TimeoutError') {
      throw new OllamaError('ollama-timeout', `Ollama no respondio en ${input.timeoutMs ?? timeoutMs} ms`, { cause });
    }
    if (cause instanceof Error && cause.name === 'AbortError') throw cause;
    throw new OllamaError('ollama-unreachable', `No se pudo contactar Ollama en ${url}`, { cause });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new OllamaError('ollama-http', `Ollama respondio ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new OllamaError('ollama-malformed', 'La respuesta de Ollama no era JSON', { cause });
  }

  const parsed = systemOneResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new OllamaError('ollama-malformed', 'La respuesta de Ollama no cumple el contrato esperado');
  }
  return parsed.data;
}

export interface OllamaModel {
  name: string;
  size: number | null;
  parameterSize: string | null;
}

/** Lista de modelos instalados en el servidor de Ollama. */
export async function listOllamaModels(timeoutMs = 4000): Promise<OllamaModel[]> {
  const { url } = ollamaConfig();
  let response: Response;
  try {
    response = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
  } catch (cause) {
    throw new OllamaError('ollama-unreachable', `No se pudo contactar Ollama en ${url}`, { cause });
  }
  if (!response.ok) throw new OllamaError('ollama-http', `Ollama respondio ${response.status}`);

  const payload = (await response.json()) as {
    models?: {
      name?: unknown;
      size?: unknown;
      details?: { parameter_size?: unknown };
    }[];
  };

  return (payload.models ?? [])
    .flatMap((model) => {
      if (typeof model.name !== 'string') return [];
      const parameterSize = model.details?.parameter_size;
      return [
        {
          name: model.name,
          size: typeof model.size === 'number' ? model.size : null,
          parameterSize: typeof parameterSize === 'string' ? parameterSize : null,
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
