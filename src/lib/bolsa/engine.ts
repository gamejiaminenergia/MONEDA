import { createGenerators } from './agents';
import {
  HORIZON_HOURS,
  INFLOW_NOISE,
  INSOLVENCY_CASH,
  SCARCITY_PRICE,
  demandForHour,
  sequiaForHour,
} from './constants';
import { dispatch, type OfferEntry } from './dispatch';
import type { AgentId, Generator, MarketEvent, MarketOptions, MarketState, Offer } from './types';

/** Un mercado fresco en la hora 0. Determinista salvo el azar de la lluvia. */
export function createMarket(options: MarketOptions = {}): MarketState {
  const horizonHours = options.horizonHours ?? HORIZON_HOURS;
  return {
    hour: 0,
    horizonHours,
    demandMw: demandForHour(0),
    sequia: sequiaForHour(0, horizonHours),
    marginalPrice: null,
    scarcityPrice: SCARCITY_PRICE,
    priceHistory: [],
    generators: createGenerators(),
    blackouts: 0,
    winner: null,
    finished: false,
  };
}

/** Cuanto puede ofrecer de verdad un agente: su capacidad y, si es hidro, su agua. */
export function effectiveQuantity(generator: Generator, offer: Offer): number {
  const byWater = generator.kind === 'hidro' ? generator.embalseMw : Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(offer.quantityMw, generator.capacityMw, byWater));
}

/** Millones de COP de utilidad de una unidad despachada. */
const profitMillions = (marginalPrice: number, cost: number, quantityMw: number): number =>
  ((marginalPrice - cost) * quantityMw * 1000) / 1_000_000;

/**
 * Avanza el mercado una hora: despacho, precio marginal, liquidacion, embalse,
 * insolvencia y fin de partida. Muta `state` (como el motor de las bolitas) y
 * devuelve los eventos de la hora.
 *
 * `offers` trae la oferta decidida por el modelo para cada agente vivo; si falta
 * una, se reusa la ultima (el modelo no dejo al agente sin orden).
 */
export function stepMarket(
  state: MarketState,
  offers: Partial<Record<AgentId, Offer>>,
  options: MarketOptions = {},
): MarketEvent[] {
  if (state.finished) return [];

  const random = options.random ?? Math.random;
  const events: MarketEvent[] = [];
  const hour = state.hour;

  // 1. Ofertas efectivas de los vivos (o la ultima conocida).
  const entries: OfferEntry[] = [];
  for (const generator of state.generators) {
    if (!generator.alive) continue;
    const offer = offers[generator.id] ?? generator.lastOffer;
    generator.lastOffer = offer;
    entries.push({ id: generator.id, offer: { price: offer.price, quantityMw: effectiveQuantity(generator, offer) } });
  }

  // 2. Orden de merito y precio marginal.
  const result = dispatch(entries, state.demandMw, state.scarcityPrice);

  // 3. Liquidacion: todos cobran el marginal; el costo es propio.
  const byId = new Map(state.generators.map((generator) => [generator.id, generator]));
  for (const unit of result.dispatched) {
    const generator = byId.get(unit.id);
    if (!generator) continue;
    generator.cash += profitMillions(result.marginalPrice, generator.cost, unit.quantityMw);
    if (generator.kind === 'hidro') {
      generator.embalseMw = Math.max(0, generator.embalseMw - unit.quantityMw);
    }
  }

  // 4. Lluvia: recarga el embalse, menos cuanto mas seca este la sequia.
  for (const generator of state.generators) {
    if (generator.kind !== 'hidro') continue;
    const rain = generator.inflowMw * (1 - state.sequia) * (1 - INFLOW_NOISE / 2 + INFLOW_NOISE * random());
    generator.embalseMw = Math.min(generator.embalseMaxMw, generator.embalseMw + Math.max(0, rain));
  }

  state.marginalPrice = result.marginalPrice;
  state.priceHistory.push(result.marginalPrice);
  events.push({
    hour,
    type: 'hora',
    demandMw: state.demandMw,
    marginalPrice: result.marginalPrice,
    deficitMw: result.deficitMw,
    dispatched: result.dispatched,
  });

  // 5. Apagon: la demanda no se cubrio; gana la escasez.
  if (result.deficitMw > 0) {
    state.blackouts += 1;
    state.finished = true;
    state.winner = 'escasez';
    events.push({ hour, type: 'apagon', deficitMw: result.deficitMw });
    events.push({ hour: state.hour, type: 'fin', winner: 'escasez' });
    return events;
  }

  // 6. Insolvencia: caja por debajo del umbral y el agente sale del mercado.
  for (const generator of state.generators) {
    if (generator.alive && generator.cash < INSOLVENCY_CASH) {
      generator.alive = false;
      events.push({ hour, type: 'insolvente', id: generator.id });
    }
  }

  // 7. Fin por catastrofe (todos fuera) o por horizonte cumplido.
  const anyAlive = state.generators.some((generator) => generator.alive);
  state.hour += 1;
  if (!anyAlive) {
    state.finished = true;
    state.winner = 'escasez';
    events.push({ hour: state.hour, type: 'fin', winner: 'escasez' });
    return events;
  }
  if (state.hour >= state.horizonHours) {
    state.finished = true;
    state.winner = 'agentes';
    events.push({ hour: state.hour, type: 'fin', winner: 'agentes' });
    return events;
  }

  state.demandMw = demandForHour(state.hour);
  state.sequia = sequiaForHour(state.hour, state.horizonHours);
  return events;
}
