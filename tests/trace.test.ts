import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearTraces,
  listTraces,
  pushTrace,
  subscribeTrace,
  traceBufferSize,
  traceSummary,
  type TraceInput,
} from '@/server/trace';

const ok = (over: Partial<TraceInput> = {}): TraceInput => ({
  model: 'jev-latest',
  answeredModel: 'jev-1.13.0',
  request: {
    model: 'jev-latest',
    state: 'estado de prueba',
    questions: {
      rojo: { type: 'choice', instructions: 'x', criteria: { arriba: 'arriba' } },
    },
  },
  response: {
    model: 'jev-1.13.0',
    answers: { rojo: { choice: 'arriba', confidence: 0.6 } },
    usage: { input_tokens: 3_500, output_tokens: 1_100 },
  },
  moves: { rojo: 'arriba' },
  usage: { inputTokens: 3_500, outputTokens: 1_100 },
  latencyMs: 240,
  alive: 10,
  clockMs: 1_200,
  status: 'ok',
  errorCode: null,
  message: null,
  ...over,
});

beforeEach(() => {
  clearTraces();
});

describe('traza de peticiones', () => {
  it('acumula tokens, costo y latencia de la sesion', () => {
    pushTrace(ok());
    pushTrace(ok());
    const summary = traceSummary();

    expect(summary.requests).toBe(2);
    expect(summary.ok).toBe(2);
    expect(summary.inputTokens).toBe(7_000);
    expect(summary.outputTokens).toBe(2_200);
    expect(summary.avgLatencyMs).toBe(240);
    expect(summary.costUsd).toBeCloseTo(0.000294, 9);
  });

  it('precia con el modelo que respondio, no con el alias pedido', () => {
    const record = pushTrace(ok({ model: 'jev-preview', answeredModel: 'jev-1.13.0' }));
    expect(record.costUsd).toBeCloseTo(0.000147, 9);
  });

  it('los errores suman pero no cuestan', () => {
    pushTrace(
      ok({
        status: 'error',
        errorCode: 'model-timeout',
        message: 'no respondio',
        response: null,
        moves: null,
        usage: { inputTokens: null, outputTokens: null },
      }),
    );
    const summary = traceSummary();
    expect(summary.errors).toBe(1);
    expect(summary.ok).toBe(0);
    expect(summary.costUsd).toBe(0);
    expect(summary.pricedRequests).toBe(0);
    expect(listTraces()[0]?.errorCode).toBe('model-timeout');
  });

  it('devuelve lo mas reciente primero y respeta el limite', () => {
    for (let index = 0; index < 5; index += 1) pushTrace(ok({ clockMs: index * 100 }));
    const listed = listTraces(3);
    expect(listed).toHaveLength(3);
    expect(listed[0]?.clockMs).toBe(400);
    expect(listed[2]?.clockMs).toBe(200);
    expect(listTraces(0)).toEqual([]);
  });

  it('el buffer no crece sin fin', () => {
    for (let index = 0; index < 205; index += 1) pushTrace(ok());
    expect(traceBufferSize()).toBeLessThanOrEqual(200);
    // El resumen es de la sesion, no del buffer: los 205 cuentan.
    expect(traceSummary().requests).toBe(205);
  });

  it('limpiar deja la sesion a cero', () => {
    pushTrace(ok());
    clearTraces();
    expect(traceBufferSize()).toBe(0);
    expect(traceSummary().requests).toBe(0);
    expect(traceSummary().costUsd).toBe(0);
    expect(traceSummary().startedAt).toBeNull();
  });

  it('avisa a los suscriptores en cada peticion nueva', () => {
    const avisos: number[] = [];
    const unsubscribe = subscribeTrace(() => avisos.push(traceSummary().requests));

    pushTrace(ok());
    pushTrace(ok());
    unsubscribe();
    pushTrace(ok());

    expect(avisos).toEqual([1, 2]);
  });
});
