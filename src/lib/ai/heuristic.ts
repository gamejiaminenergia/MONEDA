import { PAD_H } from '@/lib/game/constants';
import { ALL_MOVES, isMoveForAxis, type Move } from '@/lib/game/moves';
import { clamp } from '@/lib/game/physics';
import { SIDES, SIDE_AXIS, type Axis, type Side } from '@/lib/game/sides';
import type { DecisionBundle, GameSnapshot, SideDecision } from '@/lib/game/types';

type MarginalMap = Record<Move, number>;

/** Traduce "moverme hacia -1/+1 en mi eje" a la jugada de ese equipo. */
const moveToward = (axis: Axis, direction: -1 | 1): Move =>
  axis === 'y' ? (direction < 0 ? 'subir' : 'bajar') : direction < 0 ? 'izquierda' : 'derecha';

/** Reparte 0.72 al elegido y el resto entre los otros dos del mismo eje. */
const sharpened = (axis: Axis, chosen: Move): MarginalMap => {
  const allowed = ALL_MOVES.filter((move) => isMoveForAxis(move, axis));
  const rest = (1 - 0.72) / Math.max(1, allowed.length - 1);
  const map = { subir: 0, bajar: 0, izquierda: 0, derecha: 0, quedarse: 0 } as MarginalMap;
  for (const move of allowed) map[move] = move === chosen ? 0.72 : rest;
  return map;
};

/** Jugada de un paddle: acercarse, quedarse si ya llego, o separarse del par. */
function planMove(
  axis: Axis,
  paddlePos: number,
  arrival: number,
  role: 'cover' | 'spread',
  partnerPos: number,
): Move {
  if (role === 'cover') {
    const delta = arrival - paddlePos;
    if (Math.abs(delta) < PAD_H / 3) return 'quedarse';
    return moveToward(axis, delta < 0 ? -1 : 1);
  }
  // El companero se abre para no amontonarse: si esta antes, sigue hacia atras.
  const gap = paddlePos - partnerPos;
  if (Math.abs(gap) > PAD_H * 0.9) return 'quedarse';
  return moveToward(axis, gap <= 0 ? -1 : 1);
}

function sideDecision(snapshot: GameSnapshot, side: Side): SideDecision {
  const axis = SIDE_AXIS[side];
  const view = snapshot.sides[side];
  const [a, b] = view.paddles;
  const nearest: 0 | 1 = Math.abs(b.pos - view.arrival) < Math.abs(a.pos - view.arrival) ? 1 : 0;

  const plan: [Move, Move] = [
    planMove(axis, a.pos, view.arrival, nearest === 0 ? 'cover' : 'spread', b.pos),
    planMove(axis, b.pos, view.arrival, nearest === 1 ? 'cover' : 'spread', a.pos),
  ];

  const marginals: [MarginalMap, MarginalMap] = [sharpened(axis, plan[0]), sharpened(axis, plan[1])];

  // Probabilidad de cada combinacion asumiendo independencia entre paddles.
  const allowed = ALL_MOVES.filter((move) => isMoveForAxis(move, axis));
  const probabilities: Record<string, number> = {};
  let total = 0;
  for (const first of allowed) {
    for (const second of allowed) {
      const value = marginals[0][first] * marginals[1][second];
      probabilities[`${first}|${second}`] = value;
      total += value;
    }
  }
  for (const key of Object.keys(probabilities)) {
    probabilities[key] = (probabilities[key] ?? 0) / (total || 1);
  }

  return {
    choice: `${plan[0]}|${plan[1]}`,
    moves: plan,
    probabilities,
    marginals,
    confidence: clamp((marginals[0][plan[0]] + marginals[1][plan[1]]) / 2, 0, 1),
    source: 'heuristic',
  };
}

/**
 * Linea base sin LLM. Sirve como respaldo cuando Ollama no responde y como
 * rival de referencia para comparar contra el modelo.
 */
export function heuristicDecision(snapshot: GameSnapshot): DecisionBundle {
  const bundle: DecisionBundle = {};
  for (const side of SIDES) {
    if (!snapshot.sides[side].alive) continue;
    bundle[side] = sideDecision(snapshot, side);
  }
  return bundle;
}
