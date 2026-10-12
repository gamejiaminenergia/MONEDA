import { NextResponse } from 'next/server';

import { bolsaDecisionRequestSchema, type BolsaDecisionResponse } from '@/lib/ai/bolsa';
import type { ErrorResponse } from '@/lib/ai/contracts';
import { createOfferService } from '@/server/bolsa';
import { logger } from '@/server/log';
import { ModelError } from '@/server/model-error';

const log = logger.child('api/bolsa');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fail(error: string, code: ErrorResponse['code'], status: number) {
  return NextResponse.json<ErrorResponse>({ error, code }, { status });
}

/**
 * POST /api/bolsa/decision — controlador de la decision mensual.
 *
 * Solo valida el estado, delega en el servicio (`OfferService`) y traduce
 * errores. No sabe de TypeSafe ni de prompts: eso vive en el backend.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('El cuerpo de la peticion no es JSON valido', 'bad-request', 400);
  }

  const parsed = bolsaDecisionRequestSchema.safeParse(body);
  if (!parsed.success) {
    log.warn('estado fuera de contrato', { issues: parsed.error.issues.length });
    return fail('El estado del mercado no tiene el formato esperado', 'bad-request', 400);
  }

  try {
    const service = createOfferService();
    const result = await service.decide(parsed.data.market, {
      ...(parsed.data.model ? { model: parsed.data.model } : {}),
      signal: request.signal,
    });
    return NextResponse.json<BolsaDecisionResponse>(result);
  } catch (error) {
    if (request.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      return new Response(null, { status: 499 });
    }
    const modelError =
      error instanceof ModelError
        ? error
        : new ModelError('model-unreachable', error instanceof Error ? error.message : 'Error desconocido');
    log.error('fallo del modelo', { code: modelError.code, error: modelError });
    return fail(modelError.message, modelError.code, 502);
  }
}
