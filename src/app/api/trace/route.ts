import { NextResponse } from 'next/server';

import { logger } from '@/server/log';
import { clearTraces, listTraces, traceSummary } from '@/server/trace';

const log = logger.child('api/trace');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/trace?limit=50
 *
 * Devuelve las ultimas peticiones al modelo y el resumen de la sesion (tokens y
 * costo). `limit=0` trae solo el resumen: el HUD lo sondea sin arrastrar los
 * prompts completos.
 */
export function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('limit');
  const parsed = Number(raw);
  const limit = raw !== null && Number.isFinite(parsed) ? Math.trunc(parsed) : 50;
  const safeLimit = Math.max(0, Math.min(200, limit));

  return NextResponse.json({
    records: listTraces(safeLimit),
    summary: traceSummary(),
  });
}

/** DELETE /api/trace — vacia la traza de la sesion. */
export function DELETE() {
  clearTraces();
  log.debug('traza vaciada');
  return NextResponse.json({ ok: true, summary: traceSummary() });
}
