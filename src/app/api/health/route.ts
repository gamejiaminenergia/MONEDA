import { NextResponse } from 'next/server';

import { logger } from '@/server/log';
import { typesafeConfig } from '@/server/typesafe';

const log = logger.child('api/health');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/health — estado del servidor y configuracion efectiva de TypeSafe.
 * Nunca incluye la API key: solo si esta configurada o no.
 */
export function GET() {
  const config = typesafeConfig();
  log.debug('estado', { url: config.url, model: config.model, timeoutMs: config.timeoutMs });
  return NextResponse.json({
    ok: true,
    typesafe: {
      url: config.url,
      model: config.model,
      timeoutMs: config.timeoutMs,
      configured: config.apiKey.length > 0,
    },
  });
}
