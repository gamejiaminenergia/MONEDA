'use client';

import { useCallback, useEffect, useState } from 'react';

/** Cuerpo exacto que viajo hacia TypeSafe. */
export interface TraceRequestView {
  model: string;
  state: string;
  questions: Record<string, unknown>;
}

/** Misma forma que `TraceRecord` del servidor; aqui solo se pinta. */
export interface TraceRecordView {
  id: number;
  at: number;
  model: string;
  answeredModel: string | null;
  request: TraceRequestView;
  /** JSON crudo que devolvio TypeSafe; `null` si la peticion fallo. */
  response: unknown | null;
  moves: Record<string, string> | null;
  usage: { inputTokens: number | null; outputTokens: number | null };
  costUsd: number | null;
  latencyMs: number;
  alive: number;
  clockMs: number;
  status: 'ok' | 'error';
  errorCode: string | null;
  message: string | null;
}

export interface TraceSummaryView {
  requests: number;
  ok: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  pricedRequests: number;
  avgLatencyMs: number | null;
  costPerHourUsd: number | null;
  startedAt: number | null;
}

export interface TracePayload {
  records: TraceRecordView[];
  summary: TraceSummaryView;
}

interface UseTraceOptions {
  /** Cuantas peticiones traer. `0` pide solo el resumen (HUD). */
  limit: number;
  intervalMs?: number;
  enabled?: boolean;
  /** Escucha el stream SSE en vez de sondear. */
  live?: boolean;
}

async function fetchTrace(limit: number, signal?: AbortSignal): Promise<TracePayload> {
  const response = await fetch(`/api/trace?limit=${limit}`, {
    cache: 'no-store',
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error(`El servidor respondio ${response.status}`);
  return (await response.json()) as TracePayload;
}

/**
 * Traza del servidor. El HUD la sondea con `limit: 0` (solo el resumen, muy
 * barato) y la consola se suscribe al stream para verse en tiempo real.
 */
export function useTrace({ limit, intervalMs = 3000, enabled = true, live = false }: UseTraceOptions) {
  const [records, setRecords] = useState<TraceRecordView[]>([]);
  const [summary, setSummary] = useState<TraceSummaryView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const payload = await fetchTrace(limit, signal);
      setRecords(payload.records);
      setSummary(payload.summary);
      setError(null);
      return payload;
    },
    [limit],
  );

  /** Modo en vivo: un evento del servidor por cada peticion nueva. */
  useEffect(() => {
    if (!enabled || !live) return;
    const source = new EventSource('/api/trace/stream');

    const onTrace = (event: MessageEvent<string>): void => {
      try {
        const payload = JSON.parse(event.data) as TracePayload;
        setRecords(payload.records.slice(0, Math.max(1, limit)));
        setSummary(payload.summary);
        setError(null);
      } catch {
        // Un evento a medias no debe tumbar la consola.
      }
    };

    source.addEventListener('trace', onTrace as EventListener);
    source.onerror = () => setError('stream interrumpido, reintentando');

    return () => {
      source.removeEventListener('trace', onTrace as EventListener);
      source.close();
    };
  }, [enabled, live, limit]);

  /** Modo sondeo: el HUD, y respaldo si el stream no esta disponible. */
  useEffect(() => {
    if (!enabled || live) return;
    const controller = new AbortController();

    const tick = (): void => {
      void refresh(controller.signal).catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'sin conexion');
      });
    };

    tick();
    const timer = setInterval(tick, intervalMs);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [enabled, intervalMs, live, refresh]);

  const clear = useCallback(async () => {
    await fetch('/api/trace', { method: 'DELETE' });
    setRecords([]);
    await refresh();
  }, [refresh]);

  return { records, summary, error, clear, refresh };
}
