import { describe, expect, it } from 'vitest';

import { availabilityFactor, hydroFactor } from '@/lib/bolsa/hydrology';
import { createMarket, effectiveQuantity, stepMarket } from '@/lib/bolsa/engine';
import { dispatch } from '@/lib/bolsa/market';
import { HISTORICO_SCENARIO, PERIODS, getScenario } from '@/lib/bolsa/scenario';
import type { Agent, Resource, Scenario } from '@/lib/bolsa/types';

const resource = (overrides: Partial<Resource> = {}): Resource => ({
  id: 'h',
  name: 'Hidro',
  type: 'hidro',
  owner: 'azul',
  capacityGwh: 1000,
  cost: 50,
  enfi: 0,
  fuel: null,
  embalse: 'e',
  emissions: 0,
  ...overrides,
});

const generator = (overrides: Partial<Agent> = {}): Agent => ({
  id: 'azul',
  name: 'Gen',
  color: '#000',
  role: 'generador',
  cash: 0,
  alive: true,
  resources: ['h'],
  lastOffers: {},
  demandGwh: 0,
  coverage: 0,
  contractPrice: 0,
  tariff: 0,
  ...overrides,
});

const comercializador = (overrides: Partial<Agent> = {}): Agent => ({
  id: 'cian',
  name: 'Com',
  color: '#111',
  role: 'comercializador',
  cash: 0,
  alive: true,
  resources: [],
  lastOffers: {},
  demandGwh: 100,
  coverage: 1,
  contractPrice: 50,
  tariff: 100,
  ...overrides,
});

function testScenario(overrides: Partial<Scenario> = {}): Scenario {
  const period = (month: string) => ({ month, demandGwh: 100, bolsaRef: 200, escasez: 800, embalsePct: 1, aportePct: 1 });
  return {
    id: 'test',
    name: 'test',
    description: '',
    tieCapacityGwh: 0,
    tiePrice: 750,
    carbonPrice: 0,
    reconciliationPerGwh: 0,
    oefPenalty: 120,
    periods: [period('2020-01'), period('2020-02')],
    resources: [resource()],
    embalses: [{ id: 'e', name: 'E', region: 'r', river: 'rio' }],
    agents: [generator(), comercializador()],
    ...overrides,
  };
}

describe('dispatch', () => {
  it('despacha de barata a cara y paga el marginal a todos', () => {
    const result = dispatch(
      [
        { resourceId: 'a', agentId: 'azul', price: 100, quantityGwh: 100 },
        { resourceId: 'b', agentId: 'rojo', price: 300, quantityGwh: 100 },
      ],
      150,
      { scarcityPrice: 900, tieCapacityGwh: 0, tiePrice: 0 },
    );
    expect(result.marginalPrice).toBe(300);
    expect(result.servedGwh).toBe(150);
    expect(result.dispatched.find((unit) => unit.resourceId === 'b')?.quantityGwh).toBe(50);
  });

  it('el TIE cubre el deficit antes del racionamiento', () => {
    const result = dispatch([{ resourceId: 'a', agentId: 'azul', price: 100, quantityGwh: 100 }], 200, {
      scarcityPrice: 900,
      tieCapacityGwh: 60,
      tiePrice: 760,
    });
    expect(result.importedGwh).toBe(60);
    expect(result.deficitGwh).toBe(40);
    expect(result.marginalPrice).toBe(900);
  });
});

describe('hidrologia', () => {
  it('la hidro disponible sigue al embalse y la solar tiene factor de planta', () => {
    expect(hydroFactor(0.3)).toBeCloseTo(0.3, 5);
    expect(availabilityFactor(resource(), 0.3)).toBeCloseTo(0.3, 5);
    expect(availabilityFactor(resource({ type: 'solar' }), 1)).toBeCloseTo(0.25, 5);
    expect(availabilityFactor(resource({ type: 'termica' }), 1)).toBe(1);
  });

  it('no puede ofrecer mas de lo disponible con el embalse bajo', () => {
    const market = createMarket(testScenario());
    market.embalsePct = 0.3;
    expect(effectiveQuantity(market, market.resources[0]!, { price: 100, quantityGwh: 1000 })).toBeCloseTo(300, 5);
  });
});

describe('stepMarket', () => {
  it('liquida generador y comercializador', () => {
    const market = createMarket(testScenario());
    stepMarket(market, { azul: { h: { price: 420, quantityGwh: 1000 } } });
    const gen = market.agents.find((agent) => agent.id === 'azul');
    const com = market.agents.find((agent) => agent.id === 'cian');
    // Generador: (420 - 50) COP/kWh * 100 GWh = 37.000 millones de COP.
    expect(gen?.cash).toBeCloseTo(37000, 0);
    // Comercializador cubierto 100%: (100 - 50) * 100 GWh = 5.000 millones.
    expect(com?.cash).toBeCloseTo(5000, 0);
    expect(market.marginalPrice).toBe(420);
    expect(market.score.monthsServed).toBe(1);
  });

  it('cuenta el racionamiento pero no termina la partida', () => {
    const market = createMarket(testScenario({ resources: [resource({ capacityGwh: 50 })] }));
    const events = stepMarket(market, { azul: { h: { price: 100, quantityGwh: 50 } } });
    expect(market.deficitMonths).toBe(1);
    expect(events.some((event) => event.type === 'deficit')).toBe(true);
    expect(market.finished).toBe(false);
  });

  it('en un mes estresado, quien no entrega su ENFICC paga multa', () => {
    const market = createMarket(testScenario({ resources: [resource({ enfi: 200 })] }));
    market.periods[0]!.escasez = 400;
    market.escasez = 400;
    stepMarket(market, { azul: { h: { price: 420, quantityGwh: 1000 } } });
    const gen = market.agents.find((agent) => agent.id === 'azul');
    // Marginal 420 >= escasez 400 -> estresado. Bruto (420-50)*100 = 37.000;
    // multa (200-100)*120 = 12.000 -> 25.000.
    expect(gen?.cash).toBeCloseTo(25000, 0);
  });

  it('ganan los agentes al terminar los meses con un generador solvente', () => {
    const market = createMarket(testScenario());
    stepMarket(market, { azul: { h: { price: 420, quantityGwh: 1000 } } });
    const events = stepMarket(market, { azul: { h: { price: 420, quantityGwh: 1000 } } });
    expect(market.winner).toBe('agentes');
    expect(events.some((event) => event.type === 'fin' && event.winner === 'agentes')).toBe(true);
  });

  it('pierde la escasez si todos los generadores caen', () => {
    const market = createMarket(
      testScenario({ resources: [resource({ cost: 900, enfi: 0 })], oefPenalty: 0 }),
    );
    let guard = 0;
    while (!market.finished && guard < 10) {
      stepMarket(market, { azul: { h: { price: 100, quantityGwh: 1000 } } });
      guard += 1;
    }
    expect(market.finished).toBe(true);
    expect(market.winner).toBe('escasez');
  });
});

describe('escenario historico', () => {
  it('trae los 72 meses reales (2020-2025)', () => {
    expect(PERIODS).toHaveLength(72);
    expect(PERIODS[0]?.month).toBe('2020-01');
    expect(PERIODS[71]?.month).toBe('2025-12');
    expect(getScenario('historico').periods).toHaveLength(72);
    // El pico real de bolsa fue octubre de 2024.
    const peak = HISTORICO_SCENARIO.periods.reduce((best, period) => (period.bolsaRef > best.bolsaRef ? period : best));
    expect(peak.month).toBe('2024-10');
  });

  it('es determinista (el clima es exogeno)', () => {
    const run = () => {
      const market = createMarket(HISTORICO_SCENARIO);
      stepMarket(market, { azul: { guavio: { price: 230, quantityGwh: 1000 } } });
      return market.marginalPrice;
    };
    expect(run()).toBe(run());
  });
});
