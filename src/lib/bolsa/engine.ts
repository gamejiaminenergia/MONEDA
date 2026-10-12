import { INSOLVENCY_CASH, RATIONING_COST } from './constants';
import { availabilityFactor } from './hydrology';
import { dispatch, type BidEntry } from './market';
import type { Agent, MarketEvent, MarketOptions, MarketState, Offer, Resource, Scenario } from './types';

/** Un mercado fresco desde un escenario mensual. Determinista. */
export function createMarket(scenario: Scenario, _options: MarketOptions = {}): MarketState {
  const periods = scenario.periods.map((period) => ({ ...period }));
  const first = periods[0];
  const resources: Resource[] = scenario.resources.map((resource) => ({ ...resource }));
  const embalses = scenario.embalses.map((embalse) => ({ ...embalse }));
  const agents: Agent[] = scenario.agents.map((agent) => ({
    ...agent,
    resources: [...agent.resources],
    lastOffers: {},
    cash: 0,
    alive: true,
  }));

  for (const agent of agents) {
    if (agent.role !== 'generador') continue;
    for (const resourceId of agent.resources) {
      const resource = resources.find((item) => item.id === resourceId);
      if (!resource) continue;
      agent.lastOffers[resourceId] = { price: Math.round(resource.cost * 1.4), quantityGwh: resource.capacityGwh };
    }
  }

  return {
    monthIndex: 0,
    months: periods.length,
    periods,
    demandGwh: first?.demandGwh ?? 0,
    embalsePct: first?.embalsePct ?? 0.5,
    escasez: first?.escasez ?? 800,
    marginalPrice: null,
    priceHistory: [],
    bolsaHistory: [],
    resources,
    embalses,
    agents,
    tieCapacityGwh: scenario.tieCapacityGwh,
    tiePrice: scenario.tiePrice,
    carbonPrice: scenario.carbonPrice,
    reconciliationPerGwh: scenario.reconciliationPerGwh,
    oefPenalty: scenario.oefPenalty,
    deficitMonths: 0,
    lastMonth: null,
    winner: null,
    finished: false,
    score: { monthsServed: 0, deficitMonths: 0, avgMarginal: 0, avgBolsaRef: 0, emissionsTon: 0, insolvencies: 0 },
  };
}

/** Energia disponible de un recurso este mes (capacidad x factor de clima). */
export function availableEnergy(state: MarketState, resource: Resource): number {
  return resource.capacityGwh * availabilityFactor(resource, state.embalsePct);
}

export function effectiveQuantity(state: MarketState, resource: Resource, offer: Offer): number {
  return Math.max(0, Math.min(offer.quantityGwh, availableEnergy(state, resource)));
}

/** Utilidad en millones de COP: (marginal - costo) COP/kWh x GWh = millones. */
const profitMillions = (marginalPrice: number, cost: number, quantityGwh: number): number =>
  (marginalPrice - cost) * quantityGwh;

export type OfferMap = Partial<Record<string, Record<string, Offer>>>;

/** Suma de los pesos de demanda de los comercializadores vivos. */
function comercializadorWeight(agents: readonly Agent[]): number {
  return agents
    .filter((agent) => agent.role === 'comercializador' && agent.alive)
    .reduce((sum, agent) => sum + agent.demandGwh, 0);
}

/**
 * Avanza el mercado un mes: ofertas, despacho, liquidacion, OEF, racionamiento,
 * insolvencia y fin. El clima (embalse) es exogeno y viene del periodo. Muta `state`.
 */
export function stepMarket(state: MarketState, offers: OfferMap, _options: MarketOptions = {}): MarketEvent[] {
  if (state.finished) return [];
  const events: MarketEvent[] = [];
  const period = state.periods[state.monthIndex];
  if (!period) return events;
  const monthIndex = state.monthIndex;
  state.demandGwh = period.demandGwh;
  state.embalsePct = period.embalsePct;
  state.escasez = period.escasez;

  // 1. Ofertas efectivas por recurso.
  const bids: BidEntry[] = [];
  const resourceById = new Map(state.resources.map((resource) => [resource.id, resource]));
  const agentById = new Map(state.agents.map((agent) => [agent.id, agent]));
  for (const agent of state.agents) {
    if (agent.role !== 'generador' || !agent.alive) continue;
    for (const resourceId of agent.resources) {
      const resource = resourceById.get(resourceId);
      if (!resource) continue;
      const offer = offers[agent.id]?.[resourceId] ?? agent.lastOffers[resourceId] ?? { price: resource.cost, quantityGwh: 0 };
      agent.lastOffers[resourceId] = offer;
      bids.push({ resourceId, agentId: agent.id, price: offer.price, quantityGwh: effectiveQuantity(state, resource, offer) });
    }
  }

  // 2. Despacho por merito, TIE y precio marginal.
  const outcome = dispatch(bids, state.demandGwh, {
    scarcityPrice: period.escasez,
    tieCapacityGwh: state.tieCapacityGwh,
    tiePrice: state.tiePrice,
  });
  const marginal = outcome.marginalPrice;
  state.marginalPrice = marginal;
  state.priceHistory.push(marginal);
  state.bolsaHistory.push(period.bolsaRef);

  // 3a. Generadores: utilidad (menos carbono) y emisiones.
  let emissionsTon = 0;
  const producedByResource = new Map<string, number>();
  for (const unit of outcome.dispatched) {
    const resource = resourceById.get(unit.resourceId);
    const agent = resource ? agentById.get(resource.owner) : undefined;
    if (!resource || !agent) continue;
    const carbon = (state.carbonPrice * resource.emissions * unit.quantityGwh) / 1000;
    agent.cash += profitMillions(marginal, resource.cost, unit.quantityGwh) - carbon;
    emissionsTon += resource.emissions * unit.quantityGwh;
    producedByResource.set(unit.resourceId, (producedByResource.get(unit.resourceId) ?? 0) + unit.quantityGwh);
  }

  // 3b. OEF: en un mes estresado, quien no entrego su energia firme paga multa.
  const stressed = outcome.deficitGwh > 0 || marginal >= period.escasez;
  if (stressed) {
    for (const resource of state.resources) {
      if (resource.enfi <= 0) continue;
      const produced = producedByResource.get(resource.id) ?? 0;
      const shortfall = Math.max(0, resource.enfi - produced);
      if (shortfall <= 0) continue;
      const agent = agentById.get(resource.owner);
      if (agent) agent.cash -= shortfall * state.oefPenalty;
    }
  }

  // 3c. Comercializadores: contratos vs bolsa, perdidas y venta.
  const weight = comercializadorWeight(state.agents);
  const comercializadores = state.agents.filter((agent) => agent.role === 'comercializador' && agent.alive);
  const reconMillions = (state.reconciliationPerGwh * state.demandGwh * 1e6) / 1e6;
  const rationMillions = (RATIONING_COST * outcome.deficitGwh * 1e6) / 1e6;
  for (const agent of comercializadores) {
    const share = weight > 0 ? agent.demandGwh / weight : 0;
    const demand = share * state.demandGwh;
    const energy = demand * 1e6; // kWh
    const revenue = agent.tariff * energy;
    const contracted = agent.coverage * agent.contractPrice * energy;
    const spot = (1 - agent.coverage) * marginal * energy;
    const overheads = (reconMillions + rationMillions) * share;
    agent.cash += (revenue - contracted - spot) / 1e6 - overheads;
  }

  const record = {
    monthIndex,
    month: period.month,
    demandGwh: state.demandGwh,
    marginalPrice: marginal,
    deficitGwh: outcome.deficitGwh,
    importedGwh: outcome.importedGwh,
    emissionsTon,
    dispatched: outcome.dispatched,
  };
  state.lastMonth = record;
  events.push({ monthIndex, type: 'mes', record });

  // 4. Racionamiento (no termina la partida; cuenta y penaliza).
  if (outcome.deficitGwh > 0) {
    state.deficitMonths += 1;
    state.score.deficitMonths += 1;
    events.push({ monthIndex, type: 'deficit', deficitGwh: outcome.deficitGwh });
  } else {
    state.score.monthsServed += 1;
  }

  // 5. Insolvencia.
  for (const agent of state.agents) {
    if (agent.alive && agent.cash < INSOLVENCY_CASH) {
      agent.alive = false;
      state.score.insolvencies += 1;
      events.push({ monthIndex, type: 'insolvente', id: agent.id, role: agent.role });
    }
  }

  // 6. Puntaje acumulado.
  state.score.avgMarginal = state.priceHistory.reduce((sum, value) => sum + value, 0) / state.priceHistory.length;
  state.score.avgBolsaRef = state.bolsaHistory.reduce((sum, value) => sum + value, 0) / state.bolsaHistory.length;
  state.score.emissionsTon += emissionsTon;

  // 7. Fin: se acabo el horizonte o no queda ningun generador.
  const anyGenerator = state.agents.some((agent) => agent.role === 'generador' && agent.alive);
  state.monthIndex += 1;
  if (!anyGenerator) {
    state.finished = true;
    state.winner = 'escasez';
    events.push({ monthIndex: state.monthIndex, type: 'fin', winner: 'escasez' });
    return events;
  }
  if (state.monthIndex >= state.months) {
    state.finished = true;
    state.winner = 'agentes';
    events.push({ monthIndex: state.monthIndex, type: 'fin', winner: 'agentes' });
    return events;
  }
  const next = state.periods[state.monthIndex];
  if (next) {
    state.demandGwh = next.demandGwh;
    state.embalsePct = next.embalsePct;
    state.escasez = next.escasez;
  }
  return events;
}
