import { listTraces, subscribeTrace, traceSummary } from '@/server/trace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cuantas peticiones viajan en cada evento del stream. */
const STREAM_RECORDS = 30;
/** Latido para que el navegador y los proxies no corten una conexion quieta. */
const HEARTBEAT_MS = 15_000;

/**
 * GET /api/trace/stream
 *
 * Server-Sent Events con la traza de la sesion. Manda el estado completo en
 * cada peticion nueva (el buffer es pequeno) y un latido cada 15 s. Es lo que
 * usa la consola para verse en tiempo real sin sondear.
 */
export function GET(request: Request) {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stop = (): void => {
    if (closed) return;
    closed = true;
    unsubscribe?.();
    unsubscribe = null;
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (): void => {
        if (closed) return;
        const payload = JSON.stringify({
          records: listTraces(STREAM_RECORDS),
          summary: traceSummary(),
        });
        try {
          controller.enqueue(encoder.encode(`event: trace\ndata: ${payload}\n\n`));
        } catch {
          // El cliente cerro entre el aviso y el envio: se corta sin ruido.
          stop();
        }
      };

      send();
      unsubscribe = subscribeTrace(send);

      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          stop();
        }
      }, HEARTBEAT_MS);

      request.signal.addEventListener(
        'abort',
        () => {
          stop();
          try {
            controller.close();
          } catch {
            // Ya cerrado por el consumidor.
          }
        },
        { once: true },
      );
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
