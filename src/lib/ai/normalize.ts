import { ALL_MOVES, MOVE_DIR, isMoveForAxis, splitCombo, type Move } from '@/lib/game/moves';
import { SIDE_AXIS, type Side } from '@/lib/game/sides';
import type { DecisionSource, SideDecision } from '@/lib/game/types';

import type { SystemOneAnswer } from './contracts';

type MarginalMap = Record<Move, number>;

const emptyMarginals = (): MarginalMap => ({
  subir: 0,
  bajar: 0,
  izquierda: 0,
  derecha: 0,
  quedarse: 0,
});

const argmax = (map: MarginalMap, allowed: readonly Move[]): Move =>
  allowed.reduce((best, move) => (map[move] > map[best] ? move : best), allowed[0] as Move);

/**
 * Convierte la respuesta del modelo en una decision utilizable:
 * probabilidades saneadas, marginales por paddle y una jugada por paddle.
 *
 * `side` decide el eje: un equipo de los lados solo puede subir o bajar, uno
 * de arriba/abajo solo puede correrse a los lados.
 */
export function normalizeDecision(
  answer: SystemOneAnswer,
  side: Side,
  source: DecisionSource,
): SideDecision {
  const axis = SIDE_AXIS[side];
  const allowed = ALL_MOVES.filter((move) => isMoveForAxis(move, axis));

  const raw: Record<string, number> = {};
  for (const [combo, value] of Object.entries(answer.probabilities ?? {})) {
    if (!splitCombo(combo, axis)) continue;
    const probability = Number(value);
    if (!Number.isFinite(probability) || probability < 0) continue;
    raw[combo] = probability;
  }

  // Si el modelo no mando probabilidades utiles, derivamos un one-hot de la eleccion.
  if (Object.keys(raw).length === 0) {
    const fallback = splitCombo(answer.choice, axis)
      ? answer.choice
      : `${allowed[2] ?? 'quedarse'}|${allowed[2] ?? 'quedarse'}`;
    raw[fallback] = 1;
  }

  const total = Object.values(raw).reduce((sum, value) => sum + value, 0);
  const probabilities: Record<string, number> = {};
  for (const [combo, value] of Object.entries(raw)) {
    probabilities[combo] = total > 0 ? value / total : 0;
  }

  const marginals: [MarginalMap, MarginalMap] = [emptyMarginals(), emptyMarginals()];
  for (const [combo, probability] of Object.entries(probabilities)) {
    const parts = splitCombo(combo, axis);
    if (!parts) continue;
    marginals[0][parts[0]] += probability;
    marginals[1][parts[1]] += probability;
  }

  const moves: [Move, Move] = [argmax(marginals[0], allowed), argmax(marginals[1], allowed)];
  const reported = Number(answer.confidence);
  const confidence =
    Number.isFinite(reported) && reported > 0
      ? reported
      : (marginals[0][moves[0]] + marginals[1][moves[1]]) / 2;

  return {
    choice: splitCombo(answer.choice, axis) ? answer.choice : `${moves[0]}|${moves[1]}`,
    moves,
    probabilities,
    marginals,
    confidence: Math.max(0, Math.min(1, confidence)),
    source,
  };
}

/** Direcciones listas para el motor. */
export function directionOf(move: Move): -1 | 0 | 1 {
  return MOVE_DIR[move];
}
