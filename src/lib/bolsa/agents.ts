import type { AgentId, Generator } from './types';

/**
 * Catalogo de los seis agentes del mercado.
 *
 * Tres hidraulicas baratas con embalse limitado y tres termicas caras pero
 * firmes. La capacidad termica (600 MWh) cubre casi toda la demanda base; el
 * pico de la tarde necesita a las hidraulicas. Si gastan el agua temprano, la
 * sequia las deja secas y el pico no se cubre: ahi nace el apagon.
 */

interface AgentSpec {
  id: AgentId;
  name: string;
  color: string;
  kind: Generator['kind'];
  capacityMw: number;
  cost: number;
  embalseMw: number;
  inflowMw: number;
}

const SPECS: readonly AgentSpec[] = [
  { id: 'azul', name: 'Hidro Azul', color: '#5b8dff', kind: 'hidro', capacityMw: 220, cost: 60, embalseMw: 900, inflowMw: 55 },
  { id: 'verde', name: 'Hidro Verde', color: '#38ff9c', kind: 'hidro', capacityMw: 200, cost: 72, embalseMw: 800, inflowMw: 50 },
  { id: 'turquesa', name: 'Hidro Turquesa', color: '#2ee6c5', kind: 'hidro', capacityMw: 180, cost: 85, embalseMw: 700, inflowMw: 45 },
  { id: 'rojo', name: 'Termica Roja', color: '#ff5c5c', kind: 'termica', capacityMw: 220, cost: 300, embalseMw: 0, inflowMw: 0 },
  { id: 'naranja', name: 'Termica Naranja', color: '#ff9f43', kind: 'termica', capacityMw: 200, cost: 360, embalseMw: 0, inflowMw: 0 },
  { id: 'amarillo', name: 'Termica Amarilla', color: '#ffd93d', kind: 'termica', capacityMw: 180, cost: 430, embalseMw: 0, inflowMw: 0 },
];

/** Orden vigente de arranque: hidro barata llena, termica cara llena. */
const DEFAULT_PRICE: Record<Generator['kind'], number> = { hidro: 100, termica: 420 };

/** Generadores frescos, uno por agente. Cada partida arranca de aqui. */
export function createGenerators(): Generator[] {
  return SPECS.map((spec) => ({
    id: spec.id,
    name: spec.name,
    color: spec.color,
    kind: spec.kind,
    capacityMw: spec.capacityMw,
    cost: spec.cost,
    embalseMw: spec.embalseMw,
    embalseMaxMw: spec.embalseMw,
    inflowMw: spec.inflowMw,
    cash: 0,
    lastOffer: { price: DEFAULT_PRICE[spec.kind], quantityMw: spec.capacityMw },
    alive: true,
  }));
}
