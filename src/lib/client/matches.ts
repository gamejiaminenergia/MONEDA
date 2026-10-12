import type { MatchDocument } from '@/lib/ai/contracts';

/**
 * Envia una partida completa al historico (`POST /api/matches`).
 *
 * Es de mejor esfuerzo: si el servidor no responde o Mongo no esta, la partida
 * sigue como si nada. Nunca lanza, para que no haya que defender la llamada en
 * el bucle del juego.
 */
export async function submitMatch(record: MatchDocument): Promise<void> {
  try {
    await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
      keepalive: true,
    });
  } catch {
    // El historico es un extra: no puede romper la ronda siguiente.
  }
}

/**
 * Le dice al servidor que suelte las peticiones/respuestas crudas de Jev que
 * habia archivado para una ronda que no se va a guardar (acabo antes del
 * minuto, o se reinicio a mano). Es de mejor esfuerzo, igual que `submitMatch`.
 */
export async function discardMatch(matchId: string): Promise<void> {
  try {
    await fetch(`/api/matches?matchId=${encodeURIComponent(matchId)}`, { method: 'DELETE' });
  } catch {
    // Sin limpieza el servidor las desaloja solo por el tope de la ventana.
  }
}
