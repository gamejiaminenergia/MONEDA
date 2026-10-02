import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_LIVES, PADDLE_MIN_POS, W } from '@/lib/game/constants';
import { GameEngine } from '@/lib/game/engine';
import type { GameEvent, SideDecision } from '@/lib/game/types';

const decision = (moves: [string, string]): SideDecision => ({
  choice: moves.join('|'),
  moves: moves as SideDecision['moves'],
  probabilities: { [moves.join('|')]: 1 },
  marginals: [
    { subir: 0, bajar: 0, izquierda: 0, derecha: 0, quedarse: 0, ...{ [moves[0]]: 1 } },
    { subir: 0, bajar: 0, izquierda: 0, derecha: 0, quedarse: 0, ...{ [moves[1]]: 1 } },
  ] as SideDecision['marginals'],
  confidence: 1,
  source: 'model',
});

function runUntil(
  engine: GameEngine,
  predicate: (events: GameEvent[]) => boolean,
  maxSteps = 4000,
): GameEvent[] {
  const collected: GameEvent[] = [];
  for (let step = 0; step < maxSteps; step++) {
    const events = engine.step(16);
    collected.push(...events);
    if (predicate(collected)) break;
  }
  return collected;
}

describe('GameEngine (cuatro equipos)', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine({ random: () => 0.25 });
    engine.skipServeDelay();
  });

  it('arranca con los cuatro equipos vivos y sus vidas completas', () => {
    const ui = engine.ui();
    expect(ui.aliveCount).toBe(4);
    expect(ui.startingLives).toBe(DEFAULT_LIVES);
    for (const side of ['left', 'right', 'top', 'bottom'] as const) {
      expect(ui.sides[side].lives).toBe(DEFAULT_LIVES);
      expect(ui.sides[side].alive).toBe(true);
    }
  });

  it('no avanza cuando esta en pausa', () => {
    engine.setPaused(true);
    const before = engine.view().ball.x;
    expect(engine.step(16)).toEqual([]);
    expect(engine.view().ball.x).toBe(before);
  });

  it('el equipo que no cubre la bola pierde una vida', () => {
    const events = runUntil(engine, (all) => all.some((event) => event.type === 'life-lost'));
    const lost = events.find((event) => event.type === 'life-lost');

    expect(lost?.type).toBe('life-lost');
    if (lost?.type !== 'life-lost') throw new Error('sin evento de vida');
    expect(lost.lives).toBe(DEFAULT_LIVES - 1);
    expect(engine.ui().sides[lost.side].lives).toBe(DEFAULT_LIVES - 1);
    expect(engine.ui().sides[lost.side].alive).toBe(true);
  });

  it('el equipo que pierde todas sus vidas muere y su pared queda sellada', () => {
    engine.reset({ lives: 1 });
    engine.skipServeDelay();
    const events = runUntil(engine, (all) => all.some((event) => event.type === 'death'));
    const death = events.find((event) => event.type === 'death');

    expect(death?.type).toBe('death');
    if (death?.type !== 'death') throw new Error('sin evento de muerte');
    expect(engine.isAlive(death.side)).toBe(false);
    expect(engine.ui().sides[death.side].lives).toBe(0);
    expect(engine.aliveSides()).toHaveLength(3);
  });

  it('la partida termina cuando queda un solo equipo vivo', () => {
    engine.reset({ lives: 1 });
    engine.skipServeDelay();
    runUntil(engine, () => engine.finished);

    expect(engine.finished).toBe(true);
    expect(engine.aliveSides()).toHaveLength(1);
    expect(engine.ui().winner).toBe(engine.aliveSides()[0]);
    expect(engine.step(16)).toEqual([]);
  });

  it('un equipo muerto no recibe decisiones', () => {
    engine.reset({ lives: 1 });
    engine.skipServeDelay();
    runUntil(engine, (all) => all.some((event) => event.type === 'death'));
    const dead = engine.aliveSides().length === 3 ? engine.ui() : null;
    const deadSide = (['left', 'right', 'top', 'bottom'] as const).find((side) => !engine.isAlive(side));

    expect(dead).not.toBeNull();
    expect(deadSide).toBeDefined();
    if (!deadSide) throw new Error('sin equipo muerto');

    engine.applyDecision(deadSide, decision(['quedarse', 'quedarse']));
    expect(engine.ui().sides[deadSide].choice).toBeNull();
  });

  it('cuenta el rally cuando un paddle intercepta la bola', () => {
    const arrival = engine.snapshot().sides.right.arrival;
    engine.movePaddle('right', 0, arrival);
    engine.movePaddle('right', 1, PADDLE_MIN_POS);

    const events = runUntil(engine, (all) => all.some((event) => event.type === 'paddle-hit'));
    const hit = events.find((event) => event.type === 'paddle-hit');

    expect(hit?.type).toBe('paddle-hit');
    expect(hit?.side).toBe('right');
    expect(engine.ui().rally).toBe(1);
    expect(engine.ui().maxRally).toBe(1);
  });

  it('aplica la decision del modelo a los dos paddles', () => {
    engine.applyDecision('top', decision(['izquierda', 'derecha']));
    const before = engine.view().paddles.top.map((paddle) => paddle.pos);
    engine.step(16);
    const after = engine.view().paddles.top.map((paddle) => paddle.pos);
    expect(after[0]).toBeLessThan(before[0] as number);
    expect(after[1]).toBeGreaterThan(before[1] as number);
  });

  it('expone la llegada prevista de los cuatro equipos', () => {
    const snapshot = engine.snapshot();
    for (const side of ['left', 'right', 'top', 'bottom'] as const) {
      expect(snapshot.sides[side].arrival).toBeGreaterThanOrEqual(0);
      expect(snapshot.sides[side].arrival).toBeLessThanOrEqual(W);
    }
    expect(snapshot.startingLives).toBe(DEFAULT_LIVES);
    expect(Object.keys(snapshot.sides)).toHaveLength(4);
  });

  it('la trayectoria no depende del tamano del frame (paso fijo)', () => {
    const simulate = (frameMs: number): { x: number; y: number } => {
      const run = new GameEngine({ random: () => 0.25 });
      run.skipServeDelay();
      // 600 ms: la bola alcanza a volar pero nadie llega a perder una vida.
      for (let elapsed = 0; elapsed < 600; elapsed += frameMs) run.step(frameMs);
      const ball = run.view().ball;
      return { x: ball.x, y: ball.y };
    };

    const smooth = simulate(8);
    const choppy = simulate(25);

    expect(Math.abs(smooth.y - choppy.y)).toBeLessThan(2);
    expect(Math.abs(smooth.x - choppy.x)).toBeLessThan(2);
  });
});
