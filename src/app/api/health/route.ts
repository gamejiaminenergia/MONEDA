import { NextResponse } from 'next/server';

import { ollamaConfig } from '@/server/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  const config = ollamaConfig();
  return NextResponse.json({
    ok: true,
    ollama: { url: config.url, model: config.model, timeoutMs: config.timeoutMs },
  });
}
