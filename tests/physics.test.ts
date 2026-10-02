import { describe, expect, it } from 'vitest';

import { MAX_VY, PAD_H } from '@/lib/game/constants';
import { arrangementOf, bounceOff, clamp, relationOf } from '@/lib/game/physics';

describe('bounceOff', () => {
  it('en los equipos de los lados refleja la X y saca el angulo del desvio en Y', () => {
    const result = bounceOff(280, { x: 40, y: 298, vx: -250, vy: 0 }, 'left');
    expect(result.vx).toBe(250);
    expect(result.vy).toBeCloseTo(0.5 * MAX_VY, 5);
  });

  it('en los equipos de arriba/abajo refleja la Y y saca el angulo del desvio en X', () => {
    const result = bounceOff(360, { x: 378, y: 40, vx: 0, vy: -250 }, 'top');
    expect(result.vy).toBe(250);
    expect(result.vx).toBeCloseTo(0.5 * MAX_VY, 5);
  });

  it('satura el angulo en el borde del paddle', () => {
    const result = bounceOff(280, { x: 680, y: 380, vx: 250, vy: 0 }, 'right');
    expect(result.vx).toBe(-250);
    expect(result.vy).toBe(MAX_VY);
  });

  it('el angulo nunca supera el rango del paddle', () => {
    const result = bounceOff(360, { x: 0, y: 680, vx: 0, vy: 250 }, 'bottom');
    expect(result.vy).toBe(-250);
    expect(Math.abs(result.vx)).toBeLessThanOrEqual(MAX_VY);
  });
});

describe('relaciones', () => {
  it('clasifica la llegada respecto al paddle', () => {
    expect(relationOf(100, 280)).toBe('arriba');
    expect(relationOf(280, 280)).toBe('altura');
    expect(relationOf(400, 280)).toBe('abajo');
  });

  it('describe la pareja de paddles', () => {
    expect(arrangementOf(200, 300)).toBe('A sobre B');
    expect(arrangementOf(300, 200)).toBe('A bajo B');
    expect(arrangementOf(280, 285)).toBe('A junto a B');
  });

  it('el desvio del paddle se mide en el largo de la pala', () => {
    const offset = (PAD_H / 2) * 0.5;
    const result = bounceOff(360, { x: 360, y: 360 + offset, vx: -250, vy: 0 }, 'left');
    expect(result.vy).toBeCloseTo(0.5 * MAX_VY, 5);
  });

  it('clamp respeta los limites', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });
});
