'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { BolsaDecisionLoop } from '@/lib/client/bolsa/decision-loop';
import { createHttpDecisionGateway, httpHistoryGateway } from '@/lib/client/bolsa/gateways';
import { BolsaSession } from '@/lib/client/bolsa/session';
import type { OfferMap } from '@/lib/bolsa/engine';

/**
 * Controlador de BOLSA (MVC): une el modelo (`BolsaSession`) con los puertos
 * (`DecisionGateway`, `HistoryGateway`) y expone a la vista el estado y las
 * acciones. React solo se re-renderiza cuando la sesion marca un cambio
 * (`useSyncExternalStore`), igual que `useEngineUi` en las bolitas.
 */
export function useBolsa() {
  const [session] = useState(() => new BolsaSession(httpHistoryGateway));
  const ui = useSyncExternalStore(session.subscribe, session.ui, session.serverUi);

  const [running, setRunning] = useState(false);
  const [model, setModel] = useState('auto');
  const [speedMs, setSpeedMs] = useState(1000);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    session.setModel(model);
  }, [model, session]);

  const decision = useMemo(() => createHttpDecisionGateway(() => model), [model]);

  const onLoopError = useCallback((message: string) => {
    setError(message);
    setRunning(false);
  }, []);

  const setPlaying = useCallback((next: boolean) => {
    if (next) setError(null);
    setRunning(next);
  }, []);

  useEffect(() => {
    if (!running) return;
    const loop = new BolsaDecisionLoop({ session, decision, intervalMs: () => speedMs, onError: onLoopError });
    loop.start();
    return () => loop.stop();
  }, [running, session, decision, speedMs, onLoopError]);

  const tick = useCallback(async () => {
    if (session.finished) return;
    try {
      const data = await decision.decide(session.state(), new AbortController().signal);
      session.recordUsage(data.usage);
      session.step(data.offers as OfferMap);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error consultando el modelo');
    }
  }, [session, decision]);

  const reset = useCallback(
    (scenarioId?: string) => {
      setRunning(false);
      setError(null);
      session.reset(scenarioId);
    },
    [session],
  );

  return {
    scenarioId: ui.scenarioId,
    market: ui.market,
    months: ui.months,
    log: ui.log,
    cost: ui.cost,
    running,
    speedMs,
    model,
    error,
    setRunning: setPlaying,
    setSpeedMs,
    setModel,
    tick,
    reset,
  };
}
