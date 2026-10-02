import 'server-only';

import { costOf, type TokenUsage } from '@/lib/ai/pricing';
import type { SystemOneRequest } from './typesafe';

/**
 * Traza de las peticiones al modelo: que se pregunto, que se respondio, cuanto
 * tardo y cuanto costo. Vive en memoria del servidor (buffer circular) para que
 * la consola del navegador pueda mostrarla sin exponer la API key.
 *
 * No se escribe a disco y no sobrevive un reinicio: es una ventana de la
 * sesion, no un historico. El historico pide SQLite/Postgres (ver README).
 */

export type TraceStatus = 'ok' | 'error';

export interface TraceRecord {
  id: number;
  /** epoch ms del momento en que se registro. */
  at: number;
  /** Modelo pedido (alias o version). */
  model: string;
  /** Modelo que respondio, tal como lo reporta TypeSafe. */
  answeredModel: string | null;
  /** JSON exacto que se mando a `/v1/systemone`. */
  request: SystemOneRequest;
  /** JSON exacto que devolvio TypeSafe; `null` si fallo antes de responder. */
  response: unknown | null;
  /** Jugada normalizada por jugador, ya resuelta por el servidor. */
  moves: Record<string, string> | null;
  usage: TokenUsage;
  costUsd: number | null;
  latencyMs: number;
  alive: number;
  clockMs: number;
  status: TraceStatus;
  errorCode: string | null;
  message: string | null;
}

export interface TraceSummary {
  requests: number;
  ok: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /** Peticiones cuyo modelo tiene precio conocido. */
  pricedRequests: number;
  avgLatencyMs: number | null;
  /** Proyeccion con lo medido desde que arranco el servidor. */
  costPerHourUsd: number | null;
  startedAt: number | null;
}

const rawMax = Number(process.env.TRACE_BUFFER);
const MAX_RECORDS = Number.isFinite(rawMax) && rawMax > 0 ? Math.trunc(rawMax) : 200;

/** Mas viejo primero; al pasarse, se tira lo mas viejo. */
const buffer: TraceRecord[] = [];
/** Quien quiera enterarse de cada peticion nueva (el stream SSE). */
const listeners = new Set<() => void>();
let nextId = 1;
let startedAt: number | null = null;
let totals = emptyTotals();

function emptyTotals() {
  return {
    requests: 0,
    ok: 0,
    errors: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    pricedRequests: 0,
    latencySumMs: 0,
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

/** Avisa en cada peticion nueva y en cada limpieza. Devuelve el unsubscribe. */
export function subscribeTrace(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type TraceInput = Omit<TraceRecord, 'id' | 'at' | 'costUsd'>;

/**
 * Guarda una peticion. El costo se calcula aqui con el modelo que de verdad
 * respondio (`answeredModel`), no con el alias pedido: si TypeSafe algun dia
 * cobra distinto por version, el numero sale bien.
 */
export function pushTrace(entry: TraceInput): TraceRecord {
  const at = Date.now();
  const record: TraceRecord = {
    ...entry,
    id: nextId++,
    at,
    costUsd: entry.status === 'ok' ? costOf(entry.usage, entry.answeredModel ?? entry.model) : null,
  };

  buffer.push(record);
  if (buffer.length > MAX_RECORDS) buffer.splice(0, buffer.length - MAX_RECORDS);

  startedAt ??= at;
  totals.requests += 1;
  totals.ok += record.status === 'ok' ? 1 : 0;
  totals.errors += record.status === 'error' ? 1 : 0;
  totals.inputTokens += record.usage.inputTokens ?? 0;
  totals.outputTokens += record.usage.outputTokens ?? 0;
  totals.latencySumMs += record.latencyMs;
  if (record.costUsd !== null) {
    totals.costUsd += record.costUsd;
    totals.pricedRequests += 1;
  }
  notify();
  return record;
}

/** Ultimas peticiones, la mas reciente primero. `0` devuelve solo el resumen. */
export function listTraces(limit = 50): TraceRecord[] {
  if (limit <= 0) return [];
  return buffer.slice(-limit).reverse();
}

export function traceSummary(): TraceSummary {
  const elapsedMs = startedAt ? Date.now() - startedAt : 0;
  // Con menos de 10 s de ventana la proyeccion por hora es puro ruido.
  const costPerHourUsd =
    startedAt !== null && elapsedMs > 10_000 ? (totals.costUsd / elapsedMs) * 3_600_000 : null;

  return {
    requests: totals.requests,
    ok: totals.ok,
    errors: totals.errors,
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    costUsd: totals.costUsd,
    pricedRequests: totals.pricedRequests,
    avgLatencyMs: totals.requests > 0 ? Math.round(totals.latencySumMs / totals.requests) : null,
    costPerHourUsd,
    startedAt,
  };
}

export function clearTraces(): void {
  buffer.length = 0;
  nextId = 1;
  startedAt = null;
  totals = emptyTotals();
  notify();
}

/** Tamano actual del buffer, para pruebas y diagnostico. */
export function traceBufferSize(): number {
  return buffer.length;
}
