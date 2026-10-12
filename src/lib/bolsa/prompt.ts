import { PRICE_BANDS, QUANTITY_BANDS, SCARCITY_PRICE } from './constants';
import type { Generator, MarketState } from './types';

/**
 * Prompt de BOLSA: convierte el estado en el texto que recibe el modelo para
 * **un** agente. Cada agente ve su informacion privada (costo, embalse, caja) y
 * del mercado solo lo publico (demanda, sequia, precios, capacidades agregadas).
 *
 * Vive fuera del motor: el motor no sabe que existe un modelo.
 */

export interface AgentQuestionSpec {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
}

export type AgentQuestions = Record<string, AgentQuestionSpec>;

const n = (value: number): number => Math.round(value);

/** Capacidad y agua agregadas del sistema, que si es informacion publica. */
function publicSummary(state: MarketState): { hydroCapacity: number; thermalCapacity: number; hydroEmbalse: number } {
  let hydroCapacity = 0;
  let thermalCapacity = 0;
  let hydroEmbalse = 0;
  for (const generator of state.generators) {
    if (!generator.alive) continue;
    if (generator.kind === 'hidro') {
      hydroCapacity += generator.capacityMw;
      hydroEmbalse += generator.embalseMw;
    } else {
      thermalCapacity += generator.capacityMw;
    }
  }
  return { hydroCapacity, thermalCapacity, hydroEmbalse };
}

/** La frase de la regla de juego, igual para todos los agentes. */
const RULES =
  'El operador ordena las ofertas de barata a cara y despacha hasta cubrir la demanda. ' +
  'El precio de la ultima unidad despachada lo reciben TODAS (precio marginal). ' +
  'Si la oferta no alcanza la demanda hay apagon y pierden todos. ' +
  'Si tu caja queda muy negativa quedas insolvente y sales del mercado. ' +
  'Aguantar las 24 horas sin apagon hace ganar a los agentes.';

export function buildAgentState(state: MarketState, generator: Generator): string {
  const { hydroCapacity, thermalCapacity, hydroEmbalse } = publicSummary(state);
  const history = state.priceHistory.slice(-4).map(n).join(', ') || 'sin datos aun';
  const marginal = state.marginalPrice === null ? 'sin dato' : `${n(state.marginalPrice)} COP/kWh`;
  const water =
    generator.kind === 'hidro'
      ? `Central hidraulica. Te quedan ${n(generator.embalseMw)} de ${n(generator.embalseMaxMw)} MWh embalsados y llueve segun la sequia.`
      : 'Central termica. Tienes combustible de sobra, pero tu costo es alto.';

  return (
    `Mercado mayorista de energia (BOLSA). Hora ${state.hour} de ${state.horizonHours}. ` +
    `Demanda prevista de esta hora: ${n(state.demandMw)} MWh. ` +
    `Sequia ${state.sequia.toFixed(2)} (0 = lluvia normal, 1 = muy seca; seca el embalse). ` +
    `Precio de escasez: ${SCARCITY_PRICE} COP/kWh. Precio marginal de la hora anterior: ${marginal}. ` +
    `Ultimos precios marginales: ${history}. ` +
    `El sistema tiene ${n(hydroCapacity)} MWh de capacidad hidraulica (${n(hydroEmbalse)} MWh embalsados) ` +
    `y ${n(thermalCapacity)} MWh de capacidad termica. ` +
    `Tu: ${generator.name}. ${water} Capacidad ${n(generator.capacityMw)} MWh. ` +
    `Costo variable ${n(generator.cost)} COP/kWh. Caja acumulada ${n(generator.cash)} millones de COP. ` +
    `${RULES} ` +
    'Ofrece por encima de tu costo o pierdes dinero; guarda agua si crees que la sequia aprieta. ' +
    'Tu oferta mueve el precio que cobran todos, no solo tu.'
  );
}

/** Dos preguntas tipadas por agente: banda de precio y banda de cantidad. */
export function buildAgentQuestions(): AgentQuestions {
  const priceCriteria: Record<string, string> = {};
  for (const band of PRICE_BANDS) priceCriteria[band.id] = `${n(band.price)} COP/kWh (${band.label})`;

  const quantityCriteria: Record<string, string> = {};
  for (const band of QUANTITY_BANDS) quantityCriteria[band.id] = band.label;

  return {
    precio: {
      type: 'choice',
      instructions: '¿A que precio ofertas tu energia esta hora? Elige la banda de precio.',
      criteria: priceCriteria,
    },
    cantidad: {
      type: 'choice',
      instructions: '¿Cuanta energia ofertas a ese precio, como fraccion de tu capacidad?',
      criteria: quantityCriteria,
    },
  };
}
