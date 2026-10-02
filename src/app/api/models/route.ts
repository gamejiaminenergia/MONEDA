import { NextResponse } from 'next/server';

import { listOllamaModels, OllamaError, ollamaConfig } from '@/server/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/models — modelos instalados en Ollama (nunca lanza: informa el estado). */
export async function GET() {
  const { url } = ollamaConfig();
  try {
    const models = await listOllamaModels();
    return NextResponse.json({ reachable: true, url, models, error: null });
  } catch (error) {
    return NextResponse.json({
      reachable: false,
      url,
      models: [],
      error: error instanceof OllamaError ? error.message : 'Error consultando Ollama',
    });
  }
}
