import { describe, expect, it } from 'vitest';

import { heuristicDecision } from '@/lib/ai/heuristic';
import { normalizeDecision } from '@/lib/ai/normalize';
import { CENTER, PAD_H } from '@/lib/game/constants';
import type { GameSnapshot, SideSnapshot } from '@/lib/game/types';

const side = (arrival: number, a: number, b: number, lives = 10, alive = true): SideSnapshot => ({
  arrival,
  paddles: [{ pos: a }, { pos: b }],
  lives,
  alive,
});

const snapshot: GameSnapshot = {
  ball: { x: 360, y: 200, vx: 250, vy: -80, verticalDirection: 'sube', horizontalDirection: 'right' },
  sides: {
    left: side(120, 210, 350),
    right: side(430, 210, 350),
    top: side(500, 200, 400),
    bottom: side(300, 250, 320),
  },
  startingLives: 10,
  rally: 0,
  paused: false,
  winner: null,
};

describe('normalizeDecision', () => {
  it('usa las probabilidades y saca el argmax por paddle (equipo de los lados)', () => {
    const result = normalizeDecision(
      {
        choice: 'subir|bajar',
        probabilities: { 'subir|bajar': 0.6, 'subir|subir': 0.3, 'bajar|bajar': 0.1 },
        confidence: 0.42,
      },
      'left',
      'model',
    );
    expect(result.moves).toEqual(['subir', 'bajar']);
    expect(result.marginals[0].subir).toBeCloseTo(0.9, 5);
    expect(result.marginals[1].bajar).toBeCloseTo(0.7, 5);
    expect(result.confidence).toBeCloseTo(0.42, 5);
  });

  it('en los equipos de arriba/abajo solo acepta moverse de lado', () => {
    const result = normalizeDecision(
      {
        choice: 'izquierda|derecha',
        probabilities: { 'izquierda|derecha': 0.5, 'derecha|derecha': 0.3, 'subir|subir': 0.2 },
      },
      'top',
      'model',
    );
    expect(result.moves).toEqual(['izquierda', 'derecha']);
    expect(Object.keys(result.probabilities)).not.toContain('subir|subir');
    expect(result.marginals[0].izquierda).toBeCloseTo(0.5 / 0.8, 5);
  });

  it('normaliza los pesos para que sumen uno', () => {
    const result = normalizeDecision(
      { choice: 'quedarse|quedarse', probabilities: { 'quedarse|quedarse': 8, 'izquierda|izquierda': 2 } },
      'bottom',
      'model',
    );
    const total = Object.values(result.probabilities).reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(1, 6);
    expect(result.moves).toEqual(['quedarse', 'quedarse']);
  });

  it('cae en la jugada declarada cuando no hay probabilidades', () => {
    const result = normalizeDecision({ choice: 'subir|bajar' }, 'right', 'model');
    expect(result.moves).toEqual(['subir', 'bajar']);
    expect(result.confidence).toBe(1);
  });
});

describe('heuristicDecision', () => {
  it('manda el paddle mas cercano a la llegada', () => {
    const bundle = heuristicDecision(snapshot);
    // Izquierda: llega a 120, el paddle A (210) esta mas cerca que B (350).
    expect(bundle.left?.moves[0]).toBe('subir');
    // Derecha: llega a 430, el paddle B (350) esta mas cerca.
    expect(bundle.right?.moves[1]).toBe('bajar');
    expect(bundle.left?.source).toBe('heuristic');
  });

  it('en los equipos de arriba/abajo se mueve en horizontal', () => {
    const bundle = heuristicDecision({
      ...snapshot,
      sides: { ...snapshot.sides, top: side(500, 200, 400), bottom: side(100, 250, 320) },
    });
    // Arriba: llega a 500, el paddle B (400) esta mas cerca y debe ir a la derecha.
    expect(bundle.top?.moves[1]).toBe('derecha');
    // Abajo: llega a 100, el paddle A (250) esta mas cerca y debe ir a la izquierda.
    expect(bundle.bottom?.moves[0]).toBe('izquierda');
  });

  it('no mueve al que ya esta encima de la llegada', () => {
    const bundle = heuristicDecision({
      ...snapshot,
      sides: {
        ...snapshot.sides,
        left: side(CENTER, CENTER, CENTER + PAD_H * 2),
      },
    });
    expect(bundle.left?.moves[0]).toBe('quedarse');
  });

  it('no decide por los equipos muertos', () => {
    const bundle = heuristicDecision({
      ...snapshot,
      sides: { ...snapshot.sides, top: side(500, 200, 400, 0, false) },
    });
    expect(bundle.top).toBeUndefined();
    expect(bundle.left).toBeDefined();
  });

  it('reparte la probabilidad entre las nueve combinaciones del eje', () => {
    const bundle = heuristicDecision(snapshot);
    expect(Object.keys(bundle.left?.probabilities ?? {})).toHaveLength(9);
    expect(Object.keys(bundle.top?.probabilities ?? {})).toHaveLength(9);
    const total = Object.values(bundle.top?.probabilities ?? {}).reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(1, 6);
  });
});
