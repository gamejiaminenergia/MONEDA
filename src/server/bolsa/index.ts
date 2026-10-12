import 'server-only';

import { typesafeConfig } from '../typesafe';
import { typesafeGateway } from './model-gateway';
import { OfferService } from './offer-service';
import { mongoSessionRepository } from './session-repository';

/**
 * Punto de composicion del backend: aqui se unen los servicios con sus
 * adaptadores concretos. Es el unico sitio que decide "TypeSafe" y "Mongo"; asi
 * los servicios dependen de interfaces y se pueden probar con dobles.
 */
export function createOfferService(): OfferService {
  const config = typesafeConfig();
  return new OfferService(typesafeGateway, {
    defaultModel: config.model,
    timeoutMs: config.timeoutMs,
    hasApiKey: config.apiKey.length > 0,
  });
}

export { mongoSessionRepository };
export type { SessionRepository, SessionRecord } from './ports';
