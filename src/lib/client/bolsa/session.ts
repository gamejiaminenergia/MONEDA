import { createMarket, stepMarket, type OfferMap } from '@/lib/bolsa/engine';
import { HISTORICO_SCENARIO, getScenario } from '@/lib/bolsa/scenario';
import type { MarketEvent, MarketState, MonthRecord } from '@/lib/bolsa/types';

import type { HistoryGateway } from './ports';


/**
 * Sesion de BOLSA en el navegador: mantiene el estado del mercado, la historia
 * de meses, la bitacora y el costo, y notifica a React por `subscribe` (el mismo
 * patron que el motor de las bolitas con `useSyncExternalStore`).
 *
 * Es logica de cliente pura: sin React y sin acceso a TypeSafe. El navegador solo
 * habla con `/api/bolsa/decision`.
 */

export interface SessionCost {
  inputTokens: number;
  calls: number;
}

export interface BolsaUi {
  scenarioId: string;
  market: MarketState;
  months: MonthRecord[];
  log: string[];
  cost: SessionCost;
}

const newSessionId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `ses-${Date.now()}`;

/** Snapshot estable para SSR: el mercado es determinista, asi que coincide. */
const IDLE_STATE = createMarket(HISTORICO_SCENARIO);
export const IDLE_UI: BolsaUi = {
  scenarioId: HISTORICO_SCENARIO.id,
  market: IDLE_STATE,
  months: [],
  log: [],
  cost: { inputTokens: 0, calls: 0 },
};

export class BolsaSession {
  private scenarioId: string;
  private market: MarketState;
  private months: MonthRecord[] = [];
  private log: string[] = [];
  private cost: SessionCost = { inputTokens: 0, calls: 0 };
  private listeners = new Set<() => void>();
  private uiCache: BolsaUi;
  private sessionId = newSessionId();
  private saved = false;
  private model = 'auto';

  constructor(
    private readonly history: HistoryGateway,
    scenarioId: string = HISTORICO_SCENARIO.id,
  ) {
    this.scenarioId = scenarioId;
    this.market = createMarket(getScenario(scenarioId));
    this.uiCache = this.buildUi();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Snapshot para el navegador. */
  ui = (): BolsaUi => this.uiCache;

  /** Snapshot para el servidor/SSR: identico al primero del navegador. */
  serverUi = (): BolsaUi => IDLE_UI;

  state = (): MarketState => this.market;

  get finished(): boolean {
    return this.market.finished;
  }

  setModel(model: string): void {
    this.model = model;
  }

  recordUsage(usage: { inputTokens: number | null }): void {
    if (!usage.inputTokens) return;
    this.cost = { inputTokens: this.cost.inputTokens + usage.inputTokens, calls: this.cost.calls + 1 };
    this.commit();
  }

  /** Aplica las ofertas del modelo y avanza un mes. */
  step(offers: OfferMap): MarketEvent[] {
    const events = stepMarket(this.market, offers);
    for (const event of events) {
      if (event.type === 'mes') {
        this.months.push(event.record);
      } else if (event.type === 'deficit') {
        this.log.push(`Racionamiento en el mes: faltaron ${Math.round(event.deficitGwh)} GWh`);
      } else if (event.type === 'insolvente') {
        this.log.push(`${event.id} (${event.role}) quedo insolvente`);
      } else if (event.type === 'fin') {
        this.log.push(event.winner === 'agentes' ? 'Fin: ganan los agentes (sobrevivio al menos un generador)' : 'Fin: gana la escasez (sin generadores)');
      }
    }
    const last = this.months[this.months.length - 1];
    if (last) {
      this.log.push(
        `${last.month}: marginal ${Math.round(last.marginalPrice)} COP/kWh (demanda ${Math.round(last.demandGwh)} GWh${last.importedGwh > 0 ? `, TIE ${Math.round(last.importedGwh)}` : ''})`,
      );
    }
    this.commit();
    return events;
  }

  reset(scenarioId: string = this.scenarioId): void {
    this.scenarioId = scenarioId;
    this.market = createMarket(getScenario(scenarioId));
    this.months = [];
    this.log = [];
    this.cost = { inputTokens: 0, calls: 0 };
    this.saved = false;
    this.sessionId = newSessionId();
    this.commit();
  }

  private buildUi(): BolsaUi {
    return {
      scenarioId: this.scenarioId,
      market: this.market,
      months: [...this.months],
      log: [...this.log],
      cost: { ...this.cost },
    };
  }

  private commit(): void {
    this.uiCache = this.buildUi();
    for (const listener of this.listeners) listener();
    this.persistIfFinished();
  }

  private persistIfFinished(): void {
    const winner = this.market.winner;
    if (!this.market.finished || !winner || this.saved) return;
    this.saved = true;
    void this.history.save({
      sessionId: this.sessionId,
      model: this.model === 'auto' ? 'jev-latest' : this.model,
      scenario: this.scenarioId,
      outcome: winner,
      months: this.months,
      periods: this.market.periods,
      resources: this.market.resources,
      agents: this.market.agents,
      embalses: this.market.embalses,
      score: this.market.score,
      log: this.log,
    });
  }
}
