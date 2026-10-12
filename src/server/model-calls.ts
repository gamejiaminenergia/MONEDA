import 'server-only';

import type { ModelCall } from '@/lib/ai/contracts';

/**
 * Archivo en memoria de las llamadas crudas a Jev, agrupadas por partida.
 *
 * El navegador nunca ve el prompt ni la respuesta cruda: los arma el servidor.
 * Para que el documento guardado en Mongo los lleve, cada `/api/decision` con
 * `matchId` se archiva aqui, y `POST /api/matches` los adjunta al documento
 * antes de insertarlo.
 *
 * Es una ventana acotada y sin disco: se libera al guardar o descartar la
 * partida, y si algo queda colgado lo desaloja el tope. Una ronda es una partida
 * a la vez, asi que la partida en curso no se desaloja nunca.
 */

/** Tope de partidas concurrentes en la ventana (una activa, el resto colgadas). */
const MAX_MATCHES = 8;
/** Tope de llamadas por partida: una ronda de un minuto ronda las ~90. */
const MAX_CALLS = 1_000;

const callsByMatch = new Map<string, ModelCall[]>();

/** Archiva una llamada de una partida. */
export function recordModelCall(matchId: string, call: ModelCall): void {
  let calls = callsByMatch.get(matchId);
  if (!calls) {
    calls = [];
    callsByMatch.set(matchId, calls);
    // El Map conserva el orden de insercion: la primera clave es la mas vieja.
    if (callsByMatch.size > MAX_MATCHES) {
      const oldest = callsByMatch.keys().next().value;
      if (oldest !== undefined) callsByMatch.delete(oldest);
    }
  }
  if (calls.length < MAX_CALLS) calls.push(call);
}

/** Saca (y borra) las llamadas archivadas de una partida. */
export function takeModelCalls(matchId: string): ModelCall[] {
  const calls = callsByMatch.get(matchId);
  if (!calls) return [];
  callsByMatch.delete(matchId);
  return calls;
}

/** Partidas que hay ahora mismo en la ventana. Para diagnostico y tests. */
export function modelCallMatches(): number {
  return callsByMatch.size;
}

/** Vacia la ventana entera. Para tests. */
export function clearModelCalls(): void {
  callsByMatch.clear();
}
