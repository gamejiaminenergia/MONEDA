import { describe, expect, it } from 'vitest';

import type { SystemOneAnswer } from '@/lib/ai/contracts';
import type { HistoryGateway } from '@/lib/client/bolsa/ports';
import type { BolsaSessionRecord } from '@/lib/client/bolsa/records';
import { BolsaSession } from '@/lib/client/bolsa/session';
import { createMarket, type OfferMap } from '@/lib/bolsa/engine';
import { HISTORICO_SCENARIO } from '@/lib/bolsa/scenario';
import { OfferService } from '@/server/bolsa/offer-service';
import type { ModelGateway, ModelRequest } from '@/server/bolsa/ports';

/**
 * Pruebas de la arquitectura (MVC + SOLID): los servicios y la sesion dependen
 * de puertos (interfaces), asi que se prueban con **dobles** sin TypeSafe ni
 * Mongo. Si esto compila y pasa, la inversion de dependencias funciona.
 */

/** Doble del `ModelGateway`: responde siempre con bandas fijas. */
const fakeGateway = (): ModelGateway => ({
  async ask(request: ModelRequest) {
    const answers: Record<string, SystemOneAnswer> = {};
    for (const key of Object.keys(request.questions)) {
      if (key.endsWith('__precio')) answers[key] = { choice: 'barata', probabilities: { barata: 1 } };
      else if (key.endsWith('__cantidad')) answers[key] = { choice: '100', probabilities: { '100': 1 } };
    }
    return { answeredModel: 'fake', answers, usage: { inputTokens: 10, outputTokens: 2 } };
  },
});

describe('OfferService (backend, puerto ModelGateway)', () => {
  it('decide ofertas por cartera usando el gateway inyectado', async () => {
    const market = createMarket(HISTORICO_SCENARIO);
    const service = new OfferService(fakeGateway(), { defaultModel: 'fake-model', timeoutMs: 1000, hasApiKey: true });
    const result = await service.decide(market);
    expect(result.model).toBe('fake-model');
    expect(result.offers.azul?.guavio).toEqual({ price: 100, quantityGwh: 1400 });
    expect(result.offers.amarillo?.gecelca).toEqual({ price: 100, quantityGwh: 1300 });
    expect(result.usage.inputTokens).toBeGreaterThan(0);
  });

  it('respeta el modelo solicitado', async () => {
    const service = new OfferService(fakeGateway(), { defaultModel: 'default', timeoutMs: 1000, hasApiKey: true });
    const result = await service.decide(createMarket(HISTORICO_SCENARIO), { model: 'otro' });
    expect(result.model).toBe('otro');
  });

  it('falla cerrado si no hay API key', async () => {
    const service = new OfferService(fakeGateway(), { defaultModel: 'm', timeoutMs: 1000, hasApiKey: false });
    await expect(service.decide(createMarket(HISTORICO_SCENARIO))).rejects.toThrow(/TYPESAFE_API_KEY/);
  });
});

describe('BolsaSession (frontend, puerto HistoryGateway)', () => {
  const offersFor = (market: ReturnType<typeof createMarket>): OfferMap => {
    const offers: OfferMap = {};
    for (const resource of market.resources) {
      offers[resource.owner] = { ...offers[resource.owner], [resource.id]: { price: Math.round(resource.cost * 1.5), quantityGwh: resource.capacityGwh } };
    }
    return offers;
  };

  it('avanza meses y guarda la partida al terminar, via el puerto inyectado', () => {
    const saved: BolsaSessionRecord[] = [];
    const history: HistoryGateway = { async save(record) { saved.push(record); } };
    const session = new BolsaSession(history);

    let guard = 0;
    while (!session.finished && guard < 100) {
      session.step(offersFor(session.state()));
      guard += 1;
    }

    expect(session.finished).toBe(true);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.months).toHaveLength(HISTORICO_SCENARIO.periods.length);
    expect(['agentes', 'escasez']).toContain(saved[0]?.outcome);
    expect(saved[0]?.sessionId).toBeTruthy();
  });

  it('reset reinicia la partida y vuelve a permitir guardar', () => {
    const saved: BolsaSessionRecord[] = [];
    const history: HistoryGateway = { async save(record) { saved.push(record); } };
    const session = new BolsaSession(history);
    session.reset();
    expect(session.ui().months).toHaveLength(0);
    expect(session.ui().market.monthIndex).toBe(0);
  });
});
