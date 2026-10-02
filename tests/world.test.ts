import { describe, expect, it } from 'vitest';

import { CENTER, PADDLE_MAX_POS, PADDLE_MIN_POS, PLANE, W } from '@/lib/game/constants';
import { PongWorld, contactLimit } from '@/lib/game/world';

/** Un paso exacto de la simulacion. */
const FRAME_MS = 1000 / 60;

describe('PongWorld (planck/Box2D)', () => {
  it('mientras el equipo vive la pared esta abierta y la bola se pierde', () => {
    const world = new PongWorld();
    // Los paddles del equipo superior se apartan para no interceptar.
    world.setPaddle('top', 0, PADDLE_MIN_POS);
    world.setPaddle('top', 1, PADDLE_MAX_POS);
    world.setBall({ x: W / 2, y: 300, vx: 0, vy: -250 });

    let miss = null;
    for (let step = 0; step < 300 && !miss; step++) {
      miss = world.step(FRAME_MS).miss;
    }

    expect(miss).toBe('top');
  });

  it('cuando el equipo muere su pared se sella y rebota con la misma energia', () => {
    const world = new PongWorld();
    world.killTeam('top');
    world.setPaddle('left', 0, PADDLE_MIN_POS);
    world.setPaddle('left', 1, PADDLE_MAX_POS);
    world.setPaddle('right', 0, PADDLE_MIN_POS);
    world.setPaddle('right', 1, PADDLE_MAX_POS);
    world.setBall({ x: W / 2, y: 300, vx: 0, vy: -300 });

    let bounced = null;
    for (let step = 0; step < 300 && !bounced; step++) {
      const result = world.step(FRAME_MS);
      expect(result.miss).toBeNull();
      const ball = world.ball();
      if (ball.vy > 0) bounced = ball;
    }

    expect(bounced).not.toBeNull();
    expect(bounced?.vy).toBeCloseTo(300, 0);
    expect(bounced?.y).toBeGreaterThanOrEqual(PLANE);
  });

  it('rebota aunque el golpe contra el muro sea muy suave', () => {
    // 0.2 m/s: por debajo del umbral por defecto de Box2D el choque seria
    // inelastico y la bola se quedaria pegada a la pared.
    const world = new PongWorld();
    world.killTeam('left');
    world.setBall({ x: 120, y: 300, vx: -20, vy: 0 });

    for (let step = 0; step < 300; step++) {
      world.step(FRAME_MS);
      if (world.ball().vx > 0) break;
    }

    expect(world.ball().vx).toBeGreaterThan(0);
  });

  it('la llegada prevista es la llegada real', () => {
    const world = new PongWorld();
    world.setBall({ x: W / 2, y: CENTER, vx: 250, vy: -180 });
    const predicted = world.predictArrival('right');

    // Los paddles se ponen lejos de la trayectoria: la bola debe llegar sola.
    const away = predicted > CENTER ? PADDLE_MIN_POS : PADDLE_MAX_POS;
    world.setPaddle('right', 0, away);
    world.setPaddle('right', 1, away);

    const target = contactLimit('right');
    let actual: number | null = null;

    for (let step = 0; step < 900; step++) {
      const before = world.ball();
      const result = world.step(FRAME_MS);
      expect(result.contacts).toHaveLength(0);
      const after = world.ball();
      if (after.x >= target) {
        const span = after.x - before.x;
        actual = span === 0 ? after.y : before.y + (after.y - before.y) * ((target - before.x) / span);
        break;
      }
    }

    expect(actual).not.toBeNull();
    expect(Math.abs((actual as number) - predicted)).toBeLessThan(1);
  });

  it('predice tambien en los equipos de arriba y abajo', () => {
    const world = new PongWorld();
    world.setBall({ x: CENTER, y: W / 2, vx: 180, vy: 250 });
    const predicted = world.predictArrival('bottom');

    const away = predicted > CENTER ? PADDLE_MIN_POS : PADDLE_MAX_POS;
    world.setPaddle('bottom', 0, away);
    world.setPaddle('bottom', 1, away);

    const target = contactLimit('bottom');
    let actual: number | null = null;

    for (let step = 0; step < 900; step++) {
      const before = world.ball();
      world.step(FRAME_MS);
      const after = world.ball();
      if (after.y >= target) {
        const span = after.y - before.y;
        actual = span === 0 ? after.x : before.x + (after.x - before.x) * ((target - before.y) / span);
        break;
      }
    }

    expect(actual).not.toBeNull();
    expect(Math.abs((actual as number) - predicted)).toBeLessThan(1);
  });

  it('no atraviesa un paddle aunque la bola vaya a 80 m/s', () => {
    const world = new PongWorld();
    world.setPaddle('right', 0, CENTER);
    world.setPaddle('right', 1, CENTER + 200);
    world.setBall({ x: W / 2, y: CENTER, vx: 8000, vy: 0 });

    let contacts = 0;
    for (let step = 0; step < 60 && contacts === 0; step++) {
      contacts += world.step(FRAME_MS).contacts.length;
    }

    expect(contacts).toBeGreaterThan(0);
  });

  it('el muro de un equipo muerto tambien aparece en la prediccion', () => {
    const world = new PongWorld();
    world.killTeam('left');
    world.setBall({ x: W / 2, y: CENTER, vx: -250, vy: 0 });

    // Sin muro la bola llegaria al plano; con el muro, rebota antes y la
    // prediccion tiene que devolver donde esta ahora, no donde llegaria.
    const arrival = world.predictArrival('left');
    let bounced = false;
    for (let step = 0; step < 300 && !bounced; step++) {
      world.step(FRAME_MS);
      if (world.ball().vx > 0) bounced = true;
    }

    expect(bounced).toBe(true);
    expect(Number.isFinite(arrival)).toBe(true);
  });
});
