import type { AgentId, DispatchResult, DispatchedUnit, Offer } from './types';

export interface OfferEntry {
  id: AgentId;
  offer: Offer;
}

/**
 * Orden de merito + precio marginal.
 *
 * Apila las ofertas de la mas barata a la mas cara y despacha hasta cubrir la
 * demanda. El precio de la ultima unidad despachada es el que reciben **todas**
 * (aqui vive la interaccion que las bolitas no tenian). Si la oferta no alcanza,
 * el precio salta al de escasez y queda un deficit.
 *
 * Es puro: no conoce agentes ni embalses, solo ofertas y demanda.
 */
export function dispatch(entries: readonly OfferEntry[], demandMw: number, scarcityPrice: number): DispatchResult {
  const sorted = [...entries]
    .filter((entry) => entry.offer.quantityMw > 0)
    .sort((a, b) => a.offer.price - b.offer.price);

  const dispatched: DispatchedUnit[] = [];
  let servedMw = 0;
  let marginalPrice = 0;

  for (const entry of sorted) {
    if (servedMw >= demandMw) break;
    const remaining = demandMw - servedMw;
    const quantityMw = Math.min(entry.offer.quantityMw, remaining);
    if (quantityMw <= 0) continue;
    dispatched.push({ id: entry.id, price: entry.offer.price, quantityMw });
    servedMw += quantityMw;
    marginalPrice = entry.offer.price;
  }

  const deficitMw = Math.max(0, demandMw - servedMw);
  return {
    marginalPrice: deficitMw > 0 ? scarcityPrice : marginalPrice,
    dispatched,
    servedMw,
    deficitMw,
  };
}
