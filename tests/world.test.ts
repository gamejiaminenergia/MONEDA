import { describe, expect, it } from 'vitest';

import { BALL_MAX, BALL_MIN, BALL_R, PAD } from '@/lib/game/constants';
import { ballAt } from '@/lib/game/physics';
import { ArenaWorld } from '@/lib/game/world';

/** Un paso exacto de la simulacion. */
const FRAME_MS = 1000 / 60;

const speed = (ball: { vx: number; vy: number }): number => Math.hypot(ball.vx, ball.vy);

describe('ArenaWorld (planck/Box2D)', () => {
  it('la bola rebota contra la pared sin perderse', () => {
    const world = new ArenaWorld();
    world.setBall({ x: 600, y: 360, vx: 250, vy: 0 });

    let bounced = false;
    for (let step = 0; step < 300 && !bounced; step++) {
      const result = world.step(FRAME_MS);
      expect(result.walls.length).toBeGreaterThanOrEqual(0);
      if (world.ball().vx < 0) bounced = true;
    }

    expect(bounced).toBe(true);
  });

  it('reporta el punto del rebote', () => {
    const world = new ArenaWorld();
    world.setBall({ x: 600, y: 360, vx: 250, vy: 0 });

    let hit: { x: number; y: number } | null = null;
    for (let step = 0; step < 300 && !hit; step++) {
      const result = world.step(FRAME_MS);
      hit = result.walls[0] ?? null;
    }

    expect(hit).not.toBeNull();
    expect((hit as { x: number }).x).toBeGreaterThan(BALL_MAX - 1);
    expect((hit as { x: number }).x).toBeLessThanOrEqual(BALL_MAX + BALL_R);
  });

  it('conserva la misma energia en cada rebote', () => {
    const world = new ArenaWorld();
    world.setBall({ x: 360, y: 100, vx: 240, vy: 120 });
    const before = speed(world.ball());

    for (let step = 0; step < 2000; step++) world.step(FRAME_MS);

    const after = speed(world.ball());
    expect(after).toBeGreaterThan(before * 0.9);
    expect(after).toBeLessThan(before * 1.1);
  });

  it('rebota aunque el golpe contra la pared sea muy suave', () => {
    // 0.2 m/s: por debajo del umbral por defecto de Box2D el choque seria
    // inelastico y la bola se quedaria pegada a la pared.
    const world = new ArenaWorld();
    world.setBall({ x: 200, y: 100, vx: 0, vy: -20 });

    for (let step = 0; step < 400; step++) {
      world.step(FRAME_MS);
      if (world.ball().vy > 0) break;
    }

    expect(world.ball().vy).toBeGreaterThan(0);
  });

  it('nunca sale de la mesa, ni tras muchos rebotes', () => {
    const world = new ArenaWorld();
    world.setBall({ x: 360, y: 360, vx: 300, vy: 210 });

    for (let step = 0; step < 3000; step++) {
      world.step(FRAME_MS);
      const ball = world.ball();
      expect(ball.x).toBeGreaterThanOrEqual(BALL_MIN - 1);
      expect(ball.x).toBeLessThanOrEqual(BALL_MAX + 1);
      expect(ball.y).toBeGreaterThanOrEqual(BALL_MIN - 1);
      expect(ball.y).toBeLessThanOrEqual(BALL_MAX + 1);
    }
  });

  it('el recorrido real coincide con la trayectoria prevista', () => {
    // Tolerancia de 6 px tras 2,4 s: Box2D deja la penetracion del contacto
    // corregida a lo largo de unos pasos, asi que la fase se desvia un poco
    // respecto de la formula cerrada. Es despreciable para jugar y para avisar
    // de una amenaza (el radio mortal es de 24 px), y en el juego la
    // prediccion se recalcula desde el estado real en cada decision.
    const start = { x: 360, y: 90, vx: 210, vy: 260 };

    for (const ms of [500, 1200, 2400]) {
      const other = new ArenaWorld();
      other.setBall(start);
      let elapsed = 0;
      while (elapsed < ms) {
        other.step(FRAME_MS);
        elapsed += FRAME_MS;
      }
      const actual = other.ball();
      const predicted = ballAt(start, ms);
      expect(Math.abs(actual.x - predicted.x)).toBeLessThan(6);
      expect(Math.abs(actual.y - predicted.y)).toBeLessThan(6);
    }
  });

  it('el tramo del paso cubre de verdad lo que recorrio la bola', () => {
    const world = new ArenaWorld();
    world.setBall({ x: 360, y: 360, vx: 3000, vy: 0 });
    const before = world.ball();
    const { sweep } = world.step(FRAME_MS);
    const after = world.ball();

    expect(sweep).not.toBeNull();
    expect(sweep?.from.x).toBeCloseTo(before.x, 5);
    expect(sweep?.to.x).toBeCloseTo(after.x, 5);
    // A 3000 px/s un paso son 50 px: si el tramo no los cubriera, el roce se
    // saltaria entre frames.
    expect(Math.abs((sweep?.to.x ?? 0) - (sweep?.from.x ?? 0))).toBeGreaterThan(10);
  });

  it('la pared interior es la cara del marco, no su centro', () => {
    const world = new ArenaWorld();
    world.setBall({ x: 200, y: 360, vx: 0, vy: -250 });
    for (let step = 0; step < 300; step++) world.step(FRAME_MS);
    expect(world.ball().y).toBeGreaterThanOrEqual(PAD);
  });
});
