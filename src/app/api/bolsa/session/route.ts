import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { ErrorResponse } from '@/lib/ai/contracts';
import { logger } from '@/server/log';
import { listSessions, saveSession } from '@/server/mongo';

const log = logger.child('api/bolsa/session');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sessionSchema = z.object({
  sessionId: z.string().trim().min(1).max(120),
  model: z.string().trim().min(1).max(120),
  outcome: z.enum(['agentes', 'escasez']),
  horizonHours: z.number().int().positive(),
  hours: z.array(z.unknown()).max(500),
  generators: z.array(z.unknown()).max(24),
  log: z.array(z.string()).max(500),
});

/** POST /api/bolsa/session — guarda una partida terminada. De mejor esfuerzo. */
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
  const id = await saveSession(parsed.data);
  if (!id) {
    return NextResponse.json({ stored: false, reason: 'mongo-no-configurado' }, { status: 200 });
  }
  return NextResponse.json({ stored: true, id }, { status: 201 });
}

/** GET /api/bolsa/session — ultimas sesiones (resumen). */
export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get('limit') ?? 50);
  const sessions = await listSessions(Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 50);
  log.debug('sesiones listadas', { count: sessions.length });
  return NextResponse.json({ sessions });
}
