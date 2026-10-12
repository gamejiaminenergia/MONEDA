/**
 * Tipos de BOLSA en su version mensual (2020-2025).
 *
 * Un MEM en miniatura con granularidad **mensual**: cada "turno" es un mes y las
 * series del clima y la demanda vienen del dato real de XM (`elecdb`).
 *
 * Modulo puro (sin React, sin `next/*`, sin DOM): el motor corre en Node.
 */

export const AGENT_IDS = [
  'azul',
  'verde',
  'turquesa',
  'rojo',
  'naranja',
  'amarillo',
  'morado',
  'rosa',
  'cian',
  'lima',
  'violeta',
  'marron',
] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export type ResourceType = 'hidro' | 'termica' | 'solar' | 'eolica';
export type AgentRole = 'generador' | 'comercializador';
export type Fuel = 'gas' | 'carbon' | 'acpm';

/** Un mes del horizonte. Las cinco series son el dato real de XM. */
export interface Period {
  /** 'YYYY-MM'. */
  month: string;
  /** Demanda del SIN del mes, GWh (`DemaSIN`). */
  demandGwh: number;
  /** Precio de bolsa real, COP/kWh (`PPPrecBolsNaci`); linea de referencia. */
  bolsaRef: number;
  /** Precio de escasez del mes, COP/kWh (`PrecEsca`). */
  escasez: number;
  /** Embalse promedio del mes, 0..1 (`PorcVoluUtilDiar`). */
  embalsePct: number;
  /** Aportes vs media historica (`PorcApor`); contexto hidrologico. */
  aportePct: number;
}

/** Una planta. Espeja `dim_recurso` + `fact_daily_recurso` (agregado a mes). */
export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  owner: AgentId;
  /** Energia maxima del mes a plena disponibilidad, GWh. */
  capacityGwh: number;
  /** Costo variable, COP/kWh. */
  cost: number;
  /** Energia firme mensual, GWh (`ENFICC`). */
  enfi: number;
  fuel: Fuel | null;
  /** Embalse que lo alimenta (solo hidro). */
  embalse: string | null;
  /** Emisiones, kg CO2 por MWh. */
  emissions: number;
}

/** Un embalse (para la ficha y el contexto; el nivel real manda por mes). */
export interface Embalse {
  id: string;
  name: string;
  region: string;
  river: string;
}

export interface Offer {
  price: number;
  quantityGwh: number;
}

export interface Agent {
  id: AgentId;
  name: string;
  color: string;
  role: AgentRole;
  cash: number;
  alive: boolean;
  resources: string[];
  lastOffers: Record<string, Offer>;
  /** Comercializador: demanda mensual, GWh. */
  demandGwh: number;
  coverage: number;
  contractPrice: number;
  tariff: number;
}

export interface DispatchedUnit {
  resourceId: string;
  agentId: AgentId;
  price: number;
  quantityGwh: number;
}

/** El resultado de un mes, para la torre de merito y las series. */
export interface MonthRecord {
  monthIndex: number;
  month: string;
  demandGwh: number;
  marginalPrice: number;
  deficitGwh: number;
  importedGwh: number;
  emissionsTon: number;
  dispatched: DispatchedUnit[];
}

export type MarketWinner = 'agentes' | 'escasez';

export type MarketEvent =
  | { monthIndex: number; type: 'mes'; record: MonthRecord }
  | { monthIndex: number; type: 'deficit'; deficitGwh: number }
  | { monthIndex: number; type: 'insolvente'; id: AgentId; role: AgentRole }
  | { monthIndex: number; type: 'fin'; winner: MarketWinner };

/** Marcador de la partida: cuantos meses se sirvieron y a que precio. */
export interface Score {
  monthsServed: number;
  deficitMonths: number;
  avgMarginal: number;
  avgBolsaRef: number;
  emissionsTon: number;
  insolvencies: number;
}

export interface MarketState {
  /** Indice del mes en curso, 0..months. */
  monthIndex: number;
  months: number;
  periods: Period[];
  demandGwh: number;
  embalsePct: number;
  escasez: number;
  marginalPrice: number | null;
  priceHistory: number[];
  bolsaHistory: number[];
  resources: Resource[];
  embalses: Embalse[];
  agents: Agent[];
  tieCapacityGwh: number;
  tiePrice: number;
  carbonPrice: number;
  reconciliationPerGwh: number;
  oefPenalty: number;
  deficitMonths: number;
  lastMonth: MonthRecord | null;
  winner: MarketWinner | null;
  finished: boolean;
  score: Score;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  tieCapacityGwh: number;
  tiePrice: number;
  carbonPrice: number;
  reconciliationPerGwh: number;
  oefPenalty: number;
  /** Los 72 meses (2020-2025) con las series reales. */
  periods: Period[];
  resources: Resource[];
  embalses: Embalse[];
  agents: Agent[];
}

export interface MarketOptions {
  random?: () => number;
}
