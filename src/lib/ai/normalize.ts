import { ALL_MOVES, isMove, type Move } from '@/lib/game/moves';
import { clamp } from '@/lib/game/physics';
import type { PlayerDecision } from '@/lib/game/types';

import type { SystemOneAnswer } from './contracts';

const argmax = (map: Record<string, number>): Move =>
  ALL_MOVES.reduce((best, move) => ((map[move] ?? 0) > (map[best] ?? 0) ? move : best), 'quedarse' as Move);

/**
 * Convierte la respuesta del modelo en una decision utilizable: probabilidades
 * saneadas sobre las nueve direcciones y la jugada mas probable.
 *
 * Las nueve valen para cualquier corredor: ya no hay ejes ni equipos con
 * movimientos restrictedos.
 */
export function normalizeDecision(answer: SystemOneAnswer): PlayerDecision {
  const raw: Record<string, number> = {};
  for (const [move, value] of Object.entries(answer.probabilities ?? {})) {
    if (!isMove(move)) continue;
    const probability = Number(value);
    if (!Number.isFinite(probability) || probability < 0) continue;
    raw[move] = probability;
  }

  // Si el modelo no mando probabilidades utiles, derivamos un one-hot de la eleccion.
  if (Object.keys(raw).length === 0) {
    raw[isMove(answer.choice) ? answer.choice : 'quedarse'] = 1;
  }

  const total = Object.values(raw).reduce((sum, value) => sum + value, 0);
  const probabilities: Record<string, number> = {};
  for (const [move, value] of Object.entries(raw)) {
    probabilities[move] = total > 0 ? value / total : 0;
  }

  const move = argmax(probabilities);
  const reported = Number(answer.confidence);
  const confidence =
    Number.isFinite(reported) && reported > 0 ? reported : (probabilities[move] ?? 0);

  return {
    choice: isMove(answer.choice) ? answer.choice : move,
    move,
    probabilities,
    confidence: clamp(confidence, 0, 1),
  };
}
