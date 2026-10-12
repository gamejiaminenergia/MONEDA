import 'server-only';

import { normalizePriceBand, normalizeQuantityBand, offerFromBands } from '@/lib/ai/bolsa';
import type { SystemOneAnswer } from '@/lib/ai/contracts';
import type { Agent, MarketState, Offer } from '@/lib/bolsa/types';

/**
 * Mapea las respuestas crudas del modelo a ofertas concretas por recurso. Es una
 * sola responsabilidad (SRP): normalizar, no orquestar ni llamar al proveedor.
 */
export function mapAnswersToOffers(
  market: MarketState,
  agent: Agent,
  answers: Record<string, SystemOneAnswer>,
): Record<string, Offer> {
  const offers: Record<string, Offer> = {};
  for (const resourceId of agent.resources) {
    const resource = market.resources.find((item) => item.id === resourceId);
    const priceAnswer = answers[`${resourceId}__precio`];
    const quantityAnswer = answers[`${resourceId}__cantidad`];
    if (!resource || !priceAnswer || !quantityAnswer) continue;
    offers[resourceId] = offerFromBands(resource, normalizePriceBand(priceAnswer), normalizeQuantityBand(quantityAnswer));
  }
  return offers;
}
