import type { AgentId, DispatchedUnit } from './types';

export interface BidEntry {
  resourceId: string;
  agentId: AgentId;
  price: number;
  quantityGwh: number;
}

export interface MarketRules {
  scarcityPrice: number;
  /** Capacidad de importacion por TIE, GWh. */
  tieCapacityGwh: number;
  /** Precio de la importacion TIE, COP/kWh. */
  tiePrice: number;
}

export interface DispatchOutcome {
  dispatched: DispatchedUnit[];
  marginalPrice: number;
  servedGwh: number;
  importedGwh: number;
  /** Deficit que queda despues de la capacidad TIE. */
  deficitGwh: number;
}

/**
 * Orden de merito + precio marginal + valvula TIE (mensual).
 *
 * Apila las ofertas de barata a cara, despacha hasta cubrir la demanda y el
 * precio de la ultima unidad lo cobran **todas**. Si hay deficit, primero importa
 * por TIE; si aun falta, el precio salta al de escasez y queda racionamiento.
 */
export function dispatch(bids: readonly BidEntry[], demandGwh: number, rules: MarketRules): DispatchOutcome {
  const sorted = [...bids].filter((bid) => bid.quantityGwh > 0).sort((a, b) => a.price - b.price);

  const dispatched: DispatchedUnit[] = [];
  let servedGwh = 0;
  let marginalPrice = 0;

  for (const bid of sorted) {
    if (servedGwh >= demandGwh) break;
    const remaining = demandGwh - servedGwh;
    const quantityGwh = Math.min(bid.quantityGwh, remaining);
    if (quantityGwh <= 0) continue;
    dispatched.push({ resourceId: bid.resourceId, agentId: bid.agentId, price: bid.price, quantityGwh });
    servedGwh += quantityGwh;
    marginalPrice = bid.price;
  }

  let deficitGwh = Math.max(0, demandGwh - servedGwh);
  let importedGwh = 0;
  if (deficitGwh > 0 && rules.tieCapacityGwh > 0) {
    importedGwh = Math.min(deficitGwh, rules.tieCapacityGwh);
    deficitGwh -= importedGwh;
    marginalPrice = Math.max(marginalPrice, rules.tiePrice);
  }
  if (deficitGwh > 0) marginalPrice = rules.scarcityPrice;

  return { dispatched, marginalPrice, servedGwh, importedGwh, deficitGwh };
}
