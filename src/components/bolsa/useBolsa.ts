'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { BolsaDecisionResponse } from '@/lib/ai/bolsa';
import { createMarket, stepMarket, type OfferMap } from '@/lib/bolsa/engine';
import { HISTORICO_SCENARIO, getScenario } from '@/lib/bolsa/scenario';
import type { MonthRecord, MarketState } from '@/lib/bolsa/types';

/** Copia profunda de la mesa: el motor muta, React necesita una identidad nueva. */
function snapshot(state: MarketState): MarketState {
  return {
    ...state,
    priceHistory: [...state.priceHistory],
    bolsaHistory: [...state.bolsaHistory],
    resources: state.resources.map((resource) => ({ ...resource })),
    embalses: state.embalses.map((embalse) => ({ ...embalse })),
    agents: state.agents.map((agent) => ({ ...agent, resources: [...agent.resources], lastOffers: { ...agent.lastOffers } })),
    score: { ...state.score },
    lastMonth: state.lastMonth ? { ...state.lastMonth, dispatched: state.lastMonth.dispatched.map((unit) => ({ ...unit })) } : null,
  };
}

const newSessionId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `ses-${Date.now()}`;

/** Bucle de BOLSA mensual: un Jev por generador por mes. El navegador no ve la clave. */
export function useBolsa() {
  const [scenarioId, setScenarioId] = useState(HISTORICO_SCENARIO.id);
  const [market, setMarket] = useState<MarketState>(() => createMarket(HISTORICO_SCENARIO));
  const [months, setMonths] = useState<MonthRecord[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [speedMs, setSpeedMs] = useState(1000);
  const [model, setModel] = useState('auto');
  const [error, setError] = useState<string | null>(null);
  const [cost, setCost] = useState({ inputTokens: 0, calls: 0 });
  const [sessionId, setSessionId] = useState(newSessionId);

  const marketRef = useRef(market);
  const inFlight = useRef(false);
  const saved = useRef(false);

  useEffect(() => {
    marketRef.current = market;
  }, [market]);

  const note = useCallback((line: string) => {
    setLog((previous) => [...previous.slice(-60), line]);
  }, []);

  const tick = useCallback(async () => {
    if (inFlight.current) return;
    const state = marketRef.current;
    if (state.finished) {
      setRunning(false);
      return;
    }
    inFlight.current = true;
    try {
      const response = await fetch('/api/bolsa/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market: state, ...(model !== 'auto' ? { model } : {}) }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `HTTP ${response.status}`);
      }
      const data = (await response.json()) as BolsaDecisionResponse;
      const next = snapshot(state);
      const events = stepMarket(next, data.offers as OfferMap);
      setMarket(next);
      if (data.usage.inputTokens) {
        setCost((previous) => ({ inputTokens: previous.inputTokens + (data.usage.inputTokens ?? 0), calls: previous.calls + 1 }));
      }
      for (const event of events) {
        if (event.type === 'mes') {
          setMonths((previous) => [...previous, event.record]);
          const record = event.record;
          note(
            `${record.month}: marginal ${Math.round(record.marginalPrice)} COP/kWh (bolsa real ${Math.round(next.periods[record.monthIndex]?.bolsaRef ?? 0)}, demanda ${Math.round(record.demandGwh)} GWh${record.importedGwh > 0 ? `, TIE ${Math.round(record.importedGwh)}` : ''})`,
          );
        } else if (event.type === 'deficit') {
          note(`Racionamiento en el mes: faltaron ${Math.round(event.deficitGwh)} GWh`);
        } else if (event.type === 'insolvente') {
          note(`${event.id} (${event.role}) quedo insolvente`);
        } else if (event.type === 'fin') {
          note(event.winner === 'agentes' ? 'Fin: ganan los agentes (sobrevivio al menos un generador)' : 'Fin: gana la escasez (sin generadores)');
        }
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error desconocido');
      setRunning(false);
    } finally {
      inFlight.current = false;
    }
  }, [model, note]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => void tick(), speedMs);
    return () => clearInterval(id);
  }, [running, speedMs, tick]);

  const reset = useCallback(
    (nextScenarioId = scenarioId) => {
      const scenario = getScenario(nextScenarioId);
      setScenarioId(nextScenarioId);
      setMarket(createMarket(scenario));
      setMonths([]);
      setLog([]);
      setError(null);
      setRunning(false);
      setCost({ inputTokens: 0, calls: 0 });
      saved.current = false;
      setSessionId(newSessionId());
    },
    [scenarioId],
  );

  // Al terminar, la partida entera se guarda en Mongo (de mejor esfuerzo).
  useEffect(() => {
    if (!market.finished || !market.winner || saved.current) return;
    saved.current = true;
    const body = {
      sessionId,
      model: model === 'auto' ? 'jev-latest' : model,
      scenario: scenarioId,
      outcome: market.winner,
      months,
      periods: market.periods,
      resources: market.resources,
      agents: market.agents,
      embalses: market.embalses,
      score: market.score,
      log,
    };
    void fetch('/api/bolsa/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => undefined);
  }, [market.finished, market.winner, market.periods, market.resources, market.agents, market.embalses, market.score, months, log, model, scenarioId, sessionId]);

  return {
    scenarioId,
    market,
    months,
    log,
    running,
    speedMs,
    model,
    error,
    cost,
    setRunning,
    setSpeedMs,
    setModel,
    tick,
    reset,
  };
}
