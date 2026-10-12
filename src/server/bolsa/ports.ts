import 'server-only';

import type { SystemOneAnswer } from '@/lib/ai/contracts';
import type { QuestionSet } from '@/lib/game/prompt';

/**
 * Puertos del backend de BOLSA (Dependency Inversion).
 *
 * La logica de aplicacion depende de **estas interfaces**, no de TypeSafe ni de
 * Mongo. Los adaptadores concretos viven al lado (`model-gateway.ts`,
 * `session-repository.ts`) y se inyectan en el punto de composicion (`index.ts`).
 */

/** Respuesta del modelo, ya sin acoplarse a la forma cruda de TypeSafe. */
export interface ModelAnswer {
  answeredModel: string | null;
  answers: Record<string, SystemOneAnswer>;
  usage: { inputTokens: number | null; outputTokens: number | null };
}

export interface ModelRequest {
  model: string;
  state: string;
  questions: QuestionSet;
  timeoutMs: number;
  signal?: AbortSignal;
}

/** Puerto hacia el proveedor del modelo (System One de TypeSafe). */
export interface ModelGateway {
  ask(request: ModelRequest): Promise<ModelAnswer>;
}

/** Una partida terminada, tal como la guarda el historico. */
export interface SessionRecord {
  sessionId: string;
  model: string;
  scenario?: string | undefined;
  outcome: 'agentes' | 'escasez';
  months: unknown;
  periods?: unknown;
  resources: unknown;
  agents: unknown;
  embalses: unknown;
  score?: unknown;
  log: unknown;
}

/** Puerto de persistencia del historico de BOLSA. */
export interface SessionRepository {
  save(record: SessionRecord): Promise<string | null>;
  list(limit: number): Promise<unknown[]>;
}
