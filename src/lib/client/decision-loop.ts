import type { DecisionResponse } from '@/lib/ai/contracts';
import type { GameEngine } from '@/lib/game/engine';
import { SIDES } from '@/lib/game/sides';

export interface DecisionLoopHandlers {
  onResult?: (result: DecisionResponse, roundTripMs: number) => void;
  onError?: (message: string) => void;
  onIdle?: () => void;
}

export interface DecisionLoopOptions extends DecisionLoopHandlers {
  engine: GameEngine;
  /** Debe devolver la decision, ya sea del modelo o del heuristico. */
  request: (snapshot: ReturnType<GameEngine['snapshot']>, signal: AbortSignal) => Promise<DecisionResponse>;
  intervalMs: () => number;
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
 * Bucle de decisiones: mantiene como maximo una peticion en vuelo, respeta el
 * intervalo configurado y se detiene limpio cuando se pausa o se desmonta.
 */
export class DecisionLoop {
  private controller: AbortController | null = null;
  private running = false;

  constructor(private readonly options: DecisionLoopOptions) {}

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
    this.options.engine.setThinking(false);
  }

  private async run(signal: AbortSignal): Promise<void> {
    const { engine, request, intervalMs, onError, onIdle, onResult } = this.options;

    while (this.running && !signal.aborted) {
      if (engine.isPaused || engine.finished) {
        onIdle?.();
        await sleep(150, signal);
        continue;
      }

      const startedAt = performance.now();
      engine.setThinking(true);
      try {
        const result = await request(engine.snapshot(), signal);
        if (signal.aborted) break;
        const roundTripMs = performance.now() - startedAt;
        for (const side of SIDES) {
          const decision = result.sides[side];
          if (decision) engine.applyDecision(side, decision);
        }
        engine.recordLatency(roundTripMs, result.strategy === 'model' ? 'model' : 'heuristic');
        onResult?.(result, roundTripMs);
      } catch (error) {
        if (signal.aborted) break;
        onError?.(error instanceof Error ? error.message : 'Error consultando el modelo');
      } finally {
        engine.setThinking(false);
      }

      const elapsed = performance.now() - startedAt;
      await sleep(Math.max(0, intervalMs() - elapsed), signal);
    }
  }
}
