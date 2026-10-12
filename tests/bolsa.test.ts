import { describe, expect, it } from 'vitest';

import { createGenerators } from '@/lib/bolsa/agents';
import { dispatch } from '@/lib/bolsa/dispatch';
import { createMarket, effectiveQuantity, stepMarket } from '@/lib/bolsa/engine';
import type { AgentId, Generator, MarketState, Offer } from '@/lib/bolsa/types';

const generator = (id: AgentId): Generator => {
  const found = createGenerators().find((item) => item.id === id);
  if (!found) throw new Error(`agente ${id} no existe`);
  return found;
};

/** Un mercado de un solo agente para aislar la mecanica. */
function soloMarket(overrides: Partial<Generator> = {}, horizonHours = 1): MarketState {
  const market = createMarket({ horizonHours, random: () => 0.5 });
  const base = generator('azul');
  market.generators = [{ ...base, inflowMw: 0, ...overrides }];
  market.demandMw = 100;
  return market;
}

const offer = (price: number, quantityMw: number): Offer => ({ price, quantityMw });

describe('dispatch', () => {
  it('despacha de barata a cara y paga el marginal a todos', () => {
    const result = dispatch(
      [
        { id: 'azul', offer: offer(100, 100) },
        { id: 'rojo', offer: offer(300, 100) },
      ],
      150,
      900,
    );
    expect(result.marginalPrice).toBe(300);
    expect(result.servedMw).toBe(150);
    expect(result.deficitMw).toBe(0);
    expect(result.dispatched).toHaveLength(2);
    const rojo = result.dispatched.find((unit) => unit.id === 'rojo');
    expect(rojo?.quantityMw).toBe(50);
  });

  it('si no alcanza la oferta, el precio salta al de escasez y hay deficit', () => {
    const result = dispatch([{ id: 'azul', offer: offer(100, 100) }], 300, 900);
    expect(result.marginalPrice).toBe(900);
    expect(result.servedMw).toBe(100);
    expect(result.deficitMw).toBe(200);
  });
});

describe('effectiveQuantity', () => {
  it('una hidraulica no puede ofrecer mas agua de la que tiene', () => {
    const hidro = { ...generator('azul'), embalseMw: 50 };
    expect(effectiveQuantity(hidro, offer(100, 200))).toBe(50);
  });

  it('nadie ofrece mas que su capacidad', () => {
    const termica = generator('rojo');
    expect(effectiveQuantity(termica, offer(300, 999))).toBe(termica.capacityMw);
  });
});

describe('stepMarket', () => {
  it('liquida la utilidad y gasta el embalse', () => {
    const market = soloMarket();
    stepMarket(market, { azul: offer(420, 100) });
    // (420 - 60) COP/kWh * 100 MWh * 1000 / 1e6 = 36 millones.
    expect(market.generators[0]?.cash).toBeCloseTo(36, 5);
    expect(market.generators[0]?.embalseMw).toBeCloseTo(800, 5);
    expect(market.marginalPrice).toBe(420);
    expect(market.priceHistory).toEqual([420]);
  });

  it('gana la escasez cuando la demanda no se cubre', () => {
    const market = soloMarket({}, 3);
    market.demandMw = 300;
    const events = stepMarket(market, { azul: offer(100, 100) });
    expect(market.finished).toBe(true);
    expect(market.winner).toBe('escasez');
    expect(market.blackouts).toBe(1);
    expect(events.some((event) => event.type === 'apagon')).toBe(true);
  });

  it('ganan los agentes si se aguanta todo el horizonte', () => {
    // Capacidad de sobra para cubrir la demanda de las dos horas (la curva crece).
    const market = soloMarket({ capacityMw: 700 }, 2);
    stepMarket(market, { azul: offer(420, 700) });
    expect(market.finished).toBe(false);
    const events = stepMarket(market, { azul: offer(420, 700) });
    expect(market.finished).toBe(true);
    expect(market.winner).toBe('agentes');
    expect(events.some((event) => event.type === 'fin' && event.winner === 'agentes')).toBe(true);
  });

  it('saca del mercado al agente que queda insolvente', () => {
    // Caja ya por debajo del umbral: la siguiente hora lo liquida.
    const market = soloMarket({ cost: 430, capacityMw: 700 }, 3);
    market.generators[0]!.cash = -200;
    const events = stepMarket(market, { azul: offer(420, 100) });
    expect(events.some((event) => event.type === 'insolvente')).toBe(true);
    expect(market.generators[0]?.alive).toBe(false);
    expect(market.winner).toBe('escasez');
  });

  it('reusa la ultima oferta del agente si el modelo no responde', () => {
    const market = soloMarket({}, 2);
    market.generators[0]!.lastOffer = offer(420, 100);
    stepMarket(market, {}); // sin ofertas nuevas
    expect(market.marginalPrice).toBe(420);
    expect(market.generators[0]?.cash).toBeCloseTo(36, 5);
  });

  it('juega un dia completo y siempre acaba con un ganador', () => {
    const market = createMarket();
    const offers: Partial<Record<AgentId, Offer>> = {};
    for (const generator of market.generators) {
      offers[generator.id] = offer(generator.kind === 'hidro' ? 230 : 420, generator.capacityMw);
    }
    const random = () => 0.6;
    let guard = 0;
    while (!market.finished && guard < 100) {
      stepMarket(market, offers, { random });
      guard += 1;
    }
    expect(market.finished).toBe(true);
    expect(['agentes', 'escasez']).toContain(market.winner);
    expect(market.priceHistory.length).toBeGreaterThan(0);
  });

  it('es determinista con el mismo azar', () => {
    const run = () => {
      const market = createMarket({ horizonHours: 3 });
      const random = () => 0.25;
      stepMarket(market, {}, { random });
      stepMarket(market, {}, { random });
      return market.generators.map((item) => ({ id: item.id, embalse: item.embalseMw, cash: item.cash }));
    };
    expect(run()).toEqual(run());
  });
});
