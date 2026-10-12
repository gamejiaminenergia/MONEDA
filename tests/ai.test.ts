import { describe, expect, it } from 'vitest';

import { normalizeDecision } from '@/lib/ai/normalize';
import { GameEngine } from '@/lib/game/engine';
import { moveToward } from '@/lib/game/moves';
import { PLAYERS } from '@/lib/game/players';
import type { DecisionBundle, GameSnapshot } from '@/lib/game/types';

describe('normalizeDecision', () => {
  it('usa las probabilidades y saca la direccion mas probable', () => {
    const result = normalizeDecision({
      choice: 'abajo-derecha',
      probabilities: { 'abajo-derecha': 0.6, derecha: 0.3, arriba: 0.1 },
      confidence: 0.42,
    });
    expect(result.move).toBe('abajo-derecha');
    expect(result.probabilities.derecha).toBeCloseTo(0.3, 5);
    expect(result.confidence).toBeCloseTo(0.42, 5);
  });

  it('descarta las jugadas que no existen', () => {
    const result = normalizeDecision({
      choice: 'subir|bajar',
      probabilities: { diagonal: 0.5, '{}': 0.2, derecha: 0.3 },
    });
    expect(Object.keys(result.probabilities)).toEqual(['derecha']);
    expect(result.move).toBe('derecha');
  });

  it('normaliza los pesos para que sumen uno', () => {
    const result = normalizeDecision({
      choice: 'quedarse',
      probabilities: { quedarse: 8, izquierda: 2 },
    });
    const total = Object.values(result.probabilities).reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(1, 6);
    expect(result.move).toBe('quedarse');
  });

  it('cae en la jugada declarada cuando no hay probabilidades', () => {
    const result = normalizeDecision({ choice: 'arriba-izquierda' });
    expect(result.move).toBe('arriba-izquierda');
    expect(result.confidence).toBe(1);
  });

  it('si la declaracion tampoco vale, se queda quieto', () => {
    const result = normalizeDecision({ choice: 'nonsense' });
    expect(result.move).toBe('quedarse');
    expect(result.choice).toBe('quedarse');
  });
});

/**
 * Politica de prueba: cada jugador camina hacia la bola. Es justo lo contrario
 * de jugar bien, y por eso sirve: garantiza el roce y prueba que la muerte y el
 * "ultimo en pie" cierran la ronda sin depender de ningun reloj de pared.
 */
function seekBall(snapshot: GameSnapshot): DecisionBundle {
  const bundle: DecisionBundle = {};
  for (const player of PLAYERS) {
    const view = snapshot.players[player];
    if (!view.alive) continue;
    const move = moveToward(snapshot.ball.x - view.x, snapshot.ball.y - view.y);
    bundle[player] = { choice: move, move, probabilities: { [move]: 1 }, confidence: 1 };
  }
  return bundle;
}

describe('bucle de rondas', () => {
  /** PRNG con semilla para que la partida sea reproducible en cada corrida. */
  const seededRandom = (seed: number): (() => number) => {
    let state = seed;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  it('toda ronda termina: en tregua o con la bola matando a todos', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const engine = new GameEngine({ random: seededRandom(seed) });
      let elapsed = 0;
      let lastDecisionAt = Number.NEGATIVE_INFINITY;

      while (!engine.finished && elapsed < 180_000) {
        if (elapsed - lastDecisionAt >= 700) {
          const bundle = seekBall(engine.snapshot());
          for (const target of PLAYERS) {
            const decision = bundle[target];
            if (decision) engine.applyDecision(target, decision);
          }
          lastDecisionAt = elapsed;
        }
        engine.step(16);
        elapsed += 16;
      }

      expect(engine.finished).toBe(true);
      const winner = engine.ui().winner;
      const alive = engine.alivePlayers();
      if (winner === 'players') {
        // Aguanto el minuto: reviven los muertos y ganan las bolitas.
        expect(alive).toHaveLength(PLAYERS.length);
      } else {
        // La bola negra mato a todos: ella gana.
        expect(winner).toBe('ball');
        expect(alive).toHaveLength(0);
      }

      // El reinicio que dispara la UI deja la mesa lista para la ronda siguiente.
      engine.reset();
      expect(engine.finished).toBe(false);
      expect(engine.ui().winner).toBeNull();
      expect(engine.alivePlayers()).toHaveLength(PLAYERS.length);
      expect(engine.isPaused).toBe(false);
    }
  });
});
