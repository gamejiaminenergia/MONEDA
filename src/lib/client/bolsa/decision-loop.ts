import type { OfferMap } from '@/lib/bolsa/engine';

import type { DecisionGateway } from './ports';
import type { BolsaSession } from './session';

export interface BolsaLoopOptions {
  session: BolsaSession;
  /** Puerto de decisiones (Dependency Inversion). */
  decision: DecisionGateway;
  intervalMs: () => number;
  onError?: (message: string) => void;
}

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });

/**
 * Bucle de BOLSA: pide las ofertas por el puerto `DecisionGateway`, avanza un
 * mes y se detiene limpio cuando se pausa o se desmonta. Mantiene a lo sumo una
 * peticion en vuelo.
 */
export class BolsaDecisionLoop {
  private controller: AbortController | null = null;
  private running = false;

  constructor(private readonly options: BolsaLoopOptions) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.controller = new AbortController();
    void this.run(this.controller.signal);
  }

  stop(): void {
    this.running = false;
    this.controller?.abort();
    this.controller = null;
  }

  private async run(signal: AbortSignal): Promise<void> {
    const { session, decision, intervalMs, onError } = this.options;
    while (this.running && !signal.aborted) {
      if (session.finished) {
        await sleep(200, signal);
        continue;
      }
      try {
        const data = await decision.decide(session.state(), signal);
        if (signal.aborted) break;
        session.recordUsage(data.usage);
        session.step(data.offers as OfferMap);
      } catch (error) {
        if (signal.aborted) break;
        this.running = false;
        onError?.(error instanceof Error ? error.message : 'Error consultando el modelo');
        return;
      }
      await sleep(Math.max(0, intervalMs()), signal);
    }
  }
}
