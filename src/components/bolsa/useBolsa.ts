'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { BolsaDecisionResponse } from '@/lib/ai/bolsa';
import { createMarket, stepMarket } from '@/lib/bolsa/engine';
import type { AgentId, MarketState } from '@/lib/bolsa/types';

/** Una hora cerrada, para la torre de merito y las series. */
export interface HourRecord {
  hour: number;
  demandMw: number;
  marginalPrice: number;
  deficitMw: number;
  dispatched: { id: AgentId; price: number; quantityMw: number }[];
}

/** Copia superficial de la mesa: el motor muta, React necesita una identidad nueva. */
function snapshot(state: MarketState): MarketState {
  return {
    ...state,
    priceHistory: [...state.priceHistory],
    generators: state.generators.map((generator) => ({ ...generator, lastOffer: { ...generator.lastOffer } })),
  };
}

const newSessionId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `ses-${Date.now()}`;

/**
 * Bucle de BOLSA: pide las ofertas al servidor (un Jev por agente), avanza una
 * hora y guarda la historia. El navegador nunca habla con TypeSafe: solo con
 * `/api/bolsa/decision`.
 */
export function useBolsa() {
  const [market, setMarket] = useState<MarketState>(() => createMarket());
  const [hours, setHours] = useState<HourRecord[]>([]);
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
      const events = stepMarket(next, data.offers);
      setMarket(next);
      if (data.usage.inputTokens) {
        setCost((previous) => ({ inputTokens: previous.inputTokens + (data.usage.inputTokens ?? 0), calls: previous.calls + 1 }));
      }
      for (const event of events) {
        if (event.type === 'hora') {
          setHours((previous) => [
            ...previous,
            {
              hour: event.hour,
              demandMw: event.demandMw,
              marginalPrice: event.marginalPrice,
              deficitMw: event.deficitMw,
              dispatched: event.dispatched,
            },
          ]);
          note(`Hora ${event.hour}: marginal ${Math.round(event.marginalPrice)} COP/kWh (demanda ${Math.round(event.demandMw)} MWh)`);
        } else if (event.type === 'apagon') {
          note(`APAGON en la hora ${event.hour}: faltaron ${Math.round(event.deficitMw)} MWh`);
        } else if (event.type === 'insolvente') {
          note(`${event.id} quedo insolvente y salio del mercado`);
        } else if (event.type === 'fin') {
          note(event.winner === 'agentes' ? 'Fin: ganan los agentes (se sirvio la demanda)' : 'Fin: gana la escasez (apagon)');
        }
      }
      setError(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Error desconocido';
      setError(message);
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

  const reset = useCallback(() => {
    setMarket(createMarket());
    setHours([]);
    setLog([]);
    setError(null);
    setRunning(false);
    setCost({ inputTokens: 0, calls: 0 });
    saved.current = false;
    setSessionId(newSessionId());
  }, []);

  // Al terminar, la partida entera se guarda en Mongo (de mejor esfuerzo).
  useEffect(() => {
    if (!market.finished || !market.winner || saved.current) return;
    saved.current = true;
    const body = {
      sessionId,
      model: model === 'auto' ? 'jev-latest' : model,
      outcome: market.winner,
      horizonHours: market.horizonHours,
      hours,
      generators: market.generators,
      log,
    };
    void fetch('/api/bolsa/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => undefined);
  }, [market.finished, market.winner, market.horizonHours, market.generators, hours, log, model, sessionId]);

  return {
    market,
    hours,
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
