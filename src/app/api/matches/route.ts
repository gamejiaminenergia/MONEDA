import { NextResponse } from 'next/server';

import { isCompleteMatch, matchDocumentSchema } from '@/lib/ai/contracts';
import { logger } from '@/server/log';
import { takeModelCalls } from '@/server/model-calls';
import { getMatch, listMatches, matchesConfigured, saveMatch } from '@/server/mongo';

/**
 * Historico de partidas.
 *
 * `POST` guarda una partida COMPLETA (la que aguanto el minuto) en la coleccion
 * `matches`, con las peticiones y respuestas crudas de Jev adjuntas; `GET`
 * devuelve el historico (resumen, o una partida entera con `?matchId=`);
 * `DELETE` descarta las llamadas archivadas de una ronda que no se guardo.
 * Todo el trabajo con Mongo ocurre aqui: el navegador nunca lo toca.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log = logger.child('api/matches');

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    log.warn('cuerpo de la peticion invalido', { reason: 'no es JSON' });
    return NextResponse.json({ error: 'El cuerpo de la peticion no es JSON valido' }, { status: 400 });
  }

  const parsed = matchDocumentSchema.safeParse(body);
  if (!parsed.success) {
    log.warn('partida fuera de contrato', { issues: parsed.error.issues.length });
    return NextResponse.json({ error: 'La partida no tiene el formato esperado' }, { status: 400 });
  }

  // Solo partidas completas: una ronda que no llego al minuto no se guarda.
  if (!isCompleteMatch(parsed.data)) {
    takeModelCalls(parsed.data.matchId);
    return NextResponse.json(
      { stored: false, reason: 'la partida no se completo' },
      { status: 200 },
    );
  }

  // Las llamadas crudas a Jev se enlazaron por `matchId` mientras se jugaba.
  const modelCalls = takeModelCalls(parsed.data.matchId);

  if (!matchesConfigured()) {
    // Sin Mongo configurado no es un error: el juego simplemente no lleva
    // historico. El cliente ignora la respuesta.
    return NextResponse.json({ stored: false, reason: 'MONGO_URL no configurado' }, { status: 200 });
  }

  const id = await saveMatch(parsed.data, modelCalls);
  if (!id) {
    return NextResponse.json({ stored: false, reason: 'no se pudo guardar' }, { status: 502 });
  }
  return NextResponse.json({ stored: true, id, modelCalls: modelCalls.length }, { status: 201 });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  // Una partida entera (con sus llamadas) por su `matchId`.
  const matchId = (params.get('matchId') ?? '').trim();
  if (matchId) {
    const match = await getMatch(matchId);
    if (!match) {
      return NextResponse.json({ configured: matchesConfigured(), error: 'partida no encontrada' }, { status: 404 });
    }
    return NextResponse.json({ configured: matchesConfigured(), match });
  }

  const raw = params.get('limit');
  const parsedLimit = Number(raw);
  // Sin limite valido: 50. Tope de 500 para no vaciar la coleccion de un tiron.
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(Math.trunc(parsedLimit), 500) : 50;

  const matches = await listMatches(limit);
  return NextResponse.json({ configured: matchesConfigured(), count: matches.length, matches });
}

/** Libera las llamadas archivadas de una ronda que no se va a guardar. */
export async function DELETE(request: Request) {
  const matchId = (new URL(request.url).searchParams.get('matchId') ?? '').trim();
  if (!matchId) {
    return NextResponse.json({ error: 'falta matchId' }, { status: 400 });
  }
  const discarded = takeModelCalls(matchId).length;
  log.debug('llamadas descartadas', { matchId, calls: discarded });
  return NextResponse.json({ discarded });
}
