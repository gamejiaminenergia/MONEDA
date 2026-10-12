import type { BolsaDecisionResponse } from '@/lib/ai/bolsa';

import type { DecisionGateway, HistoryGateway } from './ports';
import type { BolsaSessionRecord } from './records';

/**
 * Adaptadores HTTP de los puertos del frontend. Son los unicos que conocen las
 * rutas (`/api/bolsa/*`); el modelo y el bucle no saben que existe `fetch`.
 */

export function createHttpDecisionGateway(model: () => string): DecisionGateway {
  return {
    async decide(market, signal): Promise<BolsaDecisionResponse> {
      const current = model();
      const response = await fetch('/api/bolsa/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market, ...(current !== 'auto' ? { model: current } : {}) }),
        signal,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `HTTP ${response.status}`);
      }
      return (await response.json()) as BolsaDecisionResponse;
    },
  };
}

/** El historico es de mejor esfuerzo: nunca lanza. */
export const httpHistoryGateway: HistoryGateway = {
  async save(record: BolsaSessionRecord): Promise<void> {
    try {
      await fetch('/api/bolsa/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
        keepalive: true,
      });
    } catch {
      // Un historico caido no puede romper la partida siguiente.
    }
  },
};
