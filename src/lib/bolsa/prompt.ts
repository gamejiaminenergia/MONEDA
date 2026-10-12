import { PRICE_BANDS, QUANTITY_BANDS } from './constants';
import { availabilityFactor } from './hydrology';
import type { Agent, MarketState, Resource } from './types';

/**
 * Prompt de BOLSA (mensual): el texto que recibe el modelo para **un generador**.
 * Ve su cartera y del mercado solo lo publico (demanda, embalse, precios).
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

const TYPE_LABEL: Record<Resource['type'], string> = {
  hidro: 'hidraulica',
  termica: 'termica',
  solar: 'solar',
  eolica: 'eolica',
};

function resourceLine(state: MarketState, resource: Resource): string {
  const disponible = Math.round(resource.capacityGwh * availabilityFactor(resource, state.embalsePct));
  return (
    `${resource.name} (${TYPE_LABEL[resource.type]}, disponible ${disponible} GWh este mes de ${n(resource.capacityGwh)} GWh, ` +
    `costo ${n(resource.cost)} COP/kWh, ENFICC ${n(resource.enfi)} GWh, emisiones ${n(resource.emissions)} kg/MWh)`
  );
}

export function buildGeneratorState(state: MarketState, agent: Agent): string {
  const period = state.periods[state.monthIndex];
  const month = period?.month ?? '—';
  const history = state.priceHistory.slice(-4).map(n).join(', ') || 'sin datos aun';
  const marginal = state.marginalPrice === null ? 'sin dato' : `${n(state.marginalPrice)} COP/kWh`;
  const portfolio =
    agent.resources.length > 0
      ? `Tu cartera: ${agent.resources
          .map((id) => {
            const resource = state.resources.find((item) => item.id === id);
            return resource ? resourceLine(state, resource) : id;
          })
          .join('; ')}.`
      : 'No tienes plantas.';

  return (
    `Mercado mayorista de energia (BOLSA), mes ${month} (${state.monthIndex + 1} de ${state.months}). ` +
    `Demanda del mes: ${n(state.demandGwh)} GWh. Embalse del sistema al ${(state.embalsePct * 100).toFixed(0)}% ` +
    `(aporta ${period?.aportePct ?? 1}x la media historica). Precio de escasez del mes: ${n(state.escasez)} COP/kWh. ` +
    `Precio de bolsa real del mes (referencia): ${n(period?.bolsaRef ?? 0)} COP/kWh. ` +
    `Precio marginal del mes anterior: ${marginal}. Ultimos precios: ${history}. ` +
    `El sistema tiene TIE para importar hasta ${n(state.tieCapacityGwh)} GWh a ${n(state.tiePrice)} COP/kWh. ` +
    `Costo de carbono ${n(state.carbonPrice)} COP/kg. ` +
    `Eres ${agent.name} (generador). ${portfolio} Caja acumulada ${n(agent.cash)} millones de COP. ` +
    'El operador ordena las ofertas de barata a cara y despacha hasta cubrir la demanda; el precio de la ultima ' +
    'unidad lo reciben TODAS. Si no alcanza, entra el TIE; si aun falta, hay racionamiento. En un mes estresado, ' +
    'quien tenga ENFICC y no la entregue paga multa. Si tu caja queda muy negativa, sales del mercado. ' +
    'Ganar es terminar los 72 meses con al menos un generador solvente. ' +
    'Ofrece por encima del costo de cada planta o pierdes dinero; guarda agua si el embalse esta bajo; ' +
    'tu oferta mueve el precio que cobran todos.'
  );
}

export function buildGeneratorQuestions(agent: Agent, state: MarketState): AgentQuestions {
  const priceCriteria: Record<string, string> = {};
  for (const band of PRICE_BANDS) priceCriteria[band.id] = `${n(band.price)} COP/kWh (${band.label})`;

  const quantityCriteria: Record<string, string> = {};
  for (const band of QUANTITY_BANDS) quantityCriteria[band.id] = band.label;

  const questions: AgentQuestions = {};
  for (const resourceId of agent.resources) {
    const resource = state.resources.find((item) => item.id === resourceId);
    if (!resource) continue;
    questions[`${resourceId}__precio`] = {
      type: 'choice',
      instructions: `A que precio ofertas ${resource.name} este mes? Elige la banda de precio.`,
      criteria: priceCriteria,
    };
    questions[`${resourceId}__cantidad`] = {
      type: 'choice',
      instructions: `Cuanta energia ofertas de ${resource.name}, como fraccion de su disponibilidad?`,
      criteria: quantityCriteria,
    };
  }
  return questions;
}
