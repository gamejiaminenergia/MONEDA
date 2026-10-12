import type { Agent, Embalse, MarketState, MonthRecord, Resource } from '@/lib/bolsa/types';

/** Una partida terminada, lista para enviar al historico. */
export interface BolsaSessionRecord {
  sessionId: string;
  model: string;
  scenario: string;
  outcome: 'agentes' | 'escasez';
  months: MonthRecord[];
  periods: MarketState['periods'];
  resources: Resource[];
  agents: Agent[];
  embalses: Embalse[];
  score: MarketState['score'];
  log: string[];
}
