/**
 * Tipos del mercado de BOLSA.
 *
 * Modulo puro: sin React, sin `next/*` y sin DOM. El motor corre igual en Node
 * (los tests lo ejercitan sin navegador), como el motor del juego de bolitas.
 */

/** Los seis agentes del mercado, identificados por color (como las bolitas). */
export const AGENT_IDS = ['azul', 'verde', 'turquesa', 'rojo', 'naranja', 'amarillo'] as const;
export type AgentId = (typeof AGENT_IDS)[number];

/** Hidro: barata pero gasta embalse. Termica: firme pero cara. */
export type AgentKind = 'hidro' | 'termica';

export interface Generator {
  id: AgentId;
  name: string;
  color: string;
  kind: AgentKind;
  /** Capacidad maxima por hora, en MWh. */
  capacityMw: number;
  /** Costo variable, en COP/kWh. */
  cost: number;
  /** Energia embalsada disponible (solo hidro), en MWh. */
  embalseMw: number;
  /** Techo del embalse (solo hidro), en MWh. */
  embalseMaxMw: number;
  /** Lluvia base que recarga el embalse por hora (solo hidro), en MWh. */
  inflowMw: number;
  /** Caja acumulada, en millones de COP. */
  cash: number;
  /** Orden vigente; se reusa si el modelo no responde. */
  lastOffer: Offer;
  alive: boolean;
}

/** Una oferta por hora: precio (COP/kWh) y cantidad (MWh). */
export interface Offer {
  price: number;
  quantityMw: number;
}

export interface DispatchedUnit {
  id: AgentId;
  price: number;
  quantityMw: number;
}

export interface DispatchResult {
  /** Precio que reciben todos los despachados (COP/kWh). */
  marginalPrice: number;
  dispatched: DispatchedUnit[];
  servedMw: number;
  deficitMw: number;
}

export type MarketEvent =
  | {
      hour: number;
      type: 'hora';
      demandMw: number;
      marginalPrice: number;
      deficitMw: number;
      dispatched: DispatchedUnit[];
    }
  | { hour: number; type: 'apagon'; deficitMw: number }
  | { hour: number; type: 'insolvente'; id: AgentId }
  | { hour: number; type: 'fin'; winner: 'agentes' | 'escasez' };

export type MarketWinner = 'agentes' | 'escasez';

export interface MarketState {
  /** Hora actual, 0..horizonHours. */
  hour: number;
  horizonHours: number;
  /** Demanda de la hora en curso, MWh. */
  demandMw: number;
  /** Sequia 0..1: seca el embalse. */
  sequia: number;
  /** Precio marginal de la ultima hora (null en la hora 0). */
  marginalPrice: number | null;
  /** Precio de escasez: techo cuando no alcanza la oferta. */
  scarcityPrice: number;
  /** Serie de precios marginales, una por hora cerrada. */
  priceHistory: number[];
  generators: Generator[];
  blackouts: number;
  winner: MarketWinner | null;
  finished: boolean;
}

export interface MarketOptions {
  random?: () => number;
  horizonHours?: number;
}
