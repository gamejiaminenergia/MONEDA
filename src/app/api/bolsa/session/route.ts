import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { ErrorResponse } from '@/lib/ai/contracts';
import { mongoSessionRepository } from '@/server/bolsa';
import { logger } from '@/server/log';

const log = logger.child('api/bolsa/session');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sessionSchema = z.object({
  sessionId: z.string().trim().min(1).max(120),
  model: z.string().trim().min(1).max(120),
  scenario: z.string().trim().min(1).max(60).optional(),
  outcome: z.enum(['agentes', 'escasez']),
  months: z.array(z.unknown()).max(120),
  periods: z.array(z.unknown()).max(120).optional(),
  resources: z.array(z.unknown()).max(64),
  agents: z.array(z.unknown()).max(32),
  embalses: z.array(z.unknown()).max(32),
  score: z.unknown().optional(),
  log: z.array(z.string()).max(500),
});

/** POST /api/bolsa/session — controlador: valida y delega en el repositorio. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ErrorResponse>({ error: 'El cuerpo no es JSON valido', code: 'bad-request' }, { status: 400 });
  }
  const parsed = sessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<ErrorResponse>({ error: 'La sesion no tiene el formato esperado', code: 'bad-request' }, { status: 400 });
  }
  const id = await mongoSessionRepository.save(parsed.data);
  if (!id) {
    return NextResponse.json({ stored: false, reason: 'mongo-no-configurado' }, { status: 200 });
  }
  return NextResponse.json({ stored: true, id }, { status: 201 });
}

/** GET /api/bolsa/session — ultimas sesiones (resumen). */
export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get('limit') ?? 50);
  const sessions = await mongoSessionRepository.list(Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 50);
  log.debug('sesiones listadas', { count: sessions.length });
  return NextResponse.json({ sessions });
}
