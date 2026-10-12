import type { BolsaDecisionResponse } from '@/lib/ai/bolsa';
import type { MarketState } from '@/lib/bolsa/types';

import type { BolsaSessionRecord } from './records';

/**
 * Puertos del frontend de BOLSA (Dependency Inversion).
 *
 * La sesion y el bucle dependen de **estas interfaces**, no de `fetch`. Los
 * adaptadores HTTP viven en `gateways.ts`; asi el frontend se puede probar con
 * dobles y cambiar de transporte (HTTP, WebSocket, memoria) sin tocar el modelo.
 */

/** Puerto hacia el backend de decisiones. */
export interface DecisionGateway {
  decide(market: MarketState, signal: AbortSignal): Promise<BolsaDecisionResponse>;
}

/** Puerto de historico. */
export interface HistoryGateway {
  save(record: BolsaSessionRecord): Promise<void>;
}
