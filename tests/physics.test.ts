import { describe, expect, it } from 'vitest';

import { BALL_MAX, BALL_MIN, PLAY_MAX, PLAY_MIN } from '@/lib/game/constants';
import { ALL_MOVES, MOVE_VEC, moveToward } from '@/lib/game/moves';
import {
  ballAt,
  clampPlay,
  distance,
  distanceToSegment,
  flightOf,
  predictThreat,
  reflect,
  segmentHitsCircle,
} from '@/lib/game/physics';

const ball = (over: Partial<{ x: number; y: number; vx: number; vy: number }> = {}) => ({
  x: 360,
  y: 360,
  vx: 250,
  vy: -180,
  ...over,
});

describe('clamps de la mesa', () => {
  it('un corredor no puede salirse', () => {
    expect(clampPlay(-100)).toBe(PLAY_MIN);
    expect(clampPlay(10_000)).toBe(PLAY_MAX);
    expect(clampPlay(400)).toBe(400);
  });
});

describe('barrido de la bola contra un corredor', () => {
  it('un roce se detecta aunque el corredor este en el medio del tramo', () => {
    const a = { x: 100, y: 300 };
    const b = { x: 400, y: 300 };
    expect(distanceToSegment({ x: 250, y: 310 }, a, b)).toBeCloseTo(10, 5);
    expect(segmentHitsCircle(a, b, { x: 250, y: 310 }, 24)).toBe(true);
    expect(segmentHitsCircle(a, b, { x: 250, y: 400 }, 24)).toBe(false);
  });

  it('no toca a quien queda fuera del extremo del tramo', () => {
    const a = { x: 100, y: 300 };
    const b = { x: 200, y: 300 };
    expect(segmentHitsCircle(a, b, { x: 100, y: 308 }, 9)).toBe(true);
    expect(segmentHitsCircle(a, b, { x: 260, y: 300 }, 9)).toBe(false);
  });

  it('una bola a 80 m/s no se salta a nadie en un paso', () => {
    // El segmento del paso cubre todo lo recorrido: la velocidad da igual.
    const a = { x: 40, y: 360 };
    const b = { x: 680, y: 360 };
    expect(segmentHitsCircle(a, b, { x: 360, y: 360 }, 24)).toBe(true);
  });
});

describe('trayectoria de la bola', () => {
  it('rebota en las paredes y conserva la rapidez', () => {
    const start = ball({ x: 600, y: 360, vx: 250, vy: 0 });
    // Toca la pared a los (BALL_MAX-600)/250 = 344 ms y ya vuelve.
    expect(ballAt(start, 400).x).toBeCloseTo(BALL_MAX - 14, 0);
    // Dos veces el tiempo hasta la pared: vuelve a estar donde empezo.
    expect(ballAt(start, 688).x).toBeCloseTo(600, 0);
  });

  it('nunca sale de los limites de la mesa', () => {
    for (const ms of [0, 137, 999, 2500, 5000, 12_345]) {
      const point = ballAt(ball({ x: 34, y: 34, vx: 250, vy: 250 }), ms);
      expect(point.x).toBeGreaterThanOrEqual(BALL_MIN - 0.001);
      expect(point.x).toBeLessThanOrEqual(BALL_MAX + 0.001);
      expect(point.y).toBeGreaterThanOrEqual(BALL_MIN - 0.001);
      expect(point.y).toBeLessThanOrEqual(BALL_MAX + 0.001);
    }
  });

  it('refleja igual con velocidad negativa', () => {
    // Pegada a la pared de arriba, bajando.
    expect(reflect(100, -50, 1, 0, 100)).toBeCloseTo(50, 5);
    // Desde el centro: recorre 50 y rebota, o llega justo a la pared.
    expect(reflect(60, 50, 1, 0, 100)).toBeCloseTo(90, 5);
    expect(reflect(50, 50, 1, 0, 100)).toBeCloseTo(100, 5);
    expect(reflect(40, -50, 1, 0, 100)).toBeCloseTo(10, 5);
  });
});

describe('prediccion de amenaza', () => {
  it('avisa en cero si la bola ya esta encima', () => {
    const threat = predictThreat(ball(), { x: 365, y: 360 }, 40);
    expect(threat?.ms).toBe(0);
  });

  it('calcula cuando y donde empieza a amenazar la bola', () => {
    const start = ball({ x: 100, y: 360, vx: 250, vy: 0 });
    // El corredor esta en la trayectoria, contra la pared de la derecha.
    const threat = predictThreat(start, { x: 680, y: 360 }, 24, 5000);
    expect(threat).not.toBeNull();
    // Entra en zona de aviso 24 px antes de tocarlo: (656-100)/250 = 2.224 s.
    expect(threat?.ms).toBeGreaterThan(2200);
    expect(threat?.ms).toBeLessThan(2250);
    expect(threat?.point.x).toBeCloseTo(656, 0);
  });

  it('no inventa amenazas despues del proximo rebote', () => {
    // La bola va hacia la pared de la derecha y volveria hacia este corredor,
    // pero al rebotar tuerce: de ahi en adelante no se sabe nada.
    const start = ball({ x: 300, y: 360, vx: 250, vy: 0 });
    expect(predictThreat(start, { x: 200, y: 360 }, 24, 5000)).toBeNull();
  });

  it('el vuelo se corta donde toca la pared', () => {
    const start = ball({ x: 300, y: 360, vx: 250, vy: 0 });
    const flight = flightOf(start);
    // (686-300)/250 = 1.544 s hasta la pared de la derecha.
    expect(flight.untilMs).toBeCloseTo(1544, 0);
    expect(flight.at(800).x).toBeCloseTo(500, 5);
    // Mas alla del rebote la posicion se congela en el muro, no se prolonga.
    expect(flight.at(4000).x).toBeCloseTo(BALL_MAX, 0);
  });

  it('devuelve null cuando la bola no pasa cerca', () => {
    expect(predictThreat(ball({ x: 100, y: 100, vx: 200, vy: 200 }), { x: 600, y: 600 }, 30, 2000)).toBeNull();
  });

  it('el tiempo que devuelve es el real, no el redondeado del muestreo', () => {
    const start = ball({ x: 100, y: 360, vx: 250, vy: 0 });
    const threat = predictThreat(start, { x: 680, y: 360 }, 24, 5000);
    const expected = ((680 - 24 - 100) / 250) * 1000;
    expect(Math.abs((threat?.ms ?? 0) - expected)).toBeLessThan(5);
  });
});

describe('direcciones', () => {
  it('las diagonales no son mas rapidas que las rectas', () => {
    for (const move of ALL_MOVES) {
      if (move === 'quedarse') continue;
      const vector = MOVE_VEC[move];
      expect(Math.hypot(vector.x, vector.y)).toBeCloseTo(1, 5);
    }
  });

  it('quedarse quieto no displace', () => {
    expect(MOVE_VEC.quedarse).toEqual({ x: 0, y: 0 });
  });

  it('huye en la direccion que se le pide', () => {
    expect(moveToward(10, 0)).toBe('derecha');
    expect(moveToward(0, 10)).toBe('abajo');
    expect(moveToward(-10, 0)).toBe('izquierda');
    expect(moveToward(0, -10)).toBe('arriba');
    expect(moveToward(10, 10)).toBe('abajo-derecha');
    expect(moveToward(-10, -10)).toBe('arriba-izquierda');
    expect(moveToward(0, 0)).toBe('quedarse');
  });

  it('elige el eje corto cuando un eje domina', () => {
    expect(moveToward(10, 1)).toBe('derecha');
    expect(moveToward(1, 10)).toBe('abajo');
  });
});

describe('distancias', () => {
  it('mide el centro a centro', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});
