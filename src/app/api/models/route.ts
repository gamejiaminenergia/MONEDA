import { NextResponse } from 'next/server';

import { elapsedMs, logger } from '@/server/log';
import { ModelError } from '@/server/model-error';
import { listTypesafeModels, typesafeConfig } from '@/server/typesafe';

const log = logger.child('api/models');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/models — catalogo de modelos de TypeSafe.
 *
 * Nunca lanza: informa `reachable` y `configured` para que el panel muestre el
 * estado sin romper la partida.
 */
export async function GET() {
  const config = typesafeConfig();
  const startedAt = Date.now();

  if (!config.apiKey) {
    log.debug('sin TYPESAFE_API_KEY', { ms: elapsedMs(startedAt) });
    return NextResponse.json({
      reachable: false,
      configured: false,
      url: config.url,
      defaultModel: config.model,
      models: [],
      error: 'TypeSafe no esta configurado: falta TYPESAFE_API_KEY',
    });
  }

  try {
    const models = (await listTypesafeModels()).map((model) => ({
      name: model.name,
      parameterSize: null,
      description: model.description,
    }));
    log.debug('listado ok', { count: models.length, ms: elapsedMs(startedAt) });
    return NextResponse.json({
      reachable: true,
      configured: true,
      url: config.url,
      defaultModel: config.model,
      models,
      error: null,
    });
  } catch (error) {
    const message = error instanceof ModelError ? error.message : 'Error consultando TypeSafe';
    log.debug('listado sin conexion', { url: config.url, ms: elapsedMs(startedAt), error: message });
    // Si la red falla igual ofrecemos el modelo por defecto: el selector y la
    // comparativa no se quedan vacios por un corte temporal.
    return NextResponse.json({
      reachable: false,
      configured: true,
      url: config.url,
      defaultModel: config.model,
      models: [{ name: config.model, parameterSize: null, description: null }],
      error: message,
    });
  }
}
