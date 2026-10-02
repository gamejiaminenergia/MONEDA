import { describe, expect, it } from 'vitest';

import { dashedCircle, pointerSegment } from '@/lib/client/board/geometry';
import { toneSamples } from '@/lib/client/board/tone';

const peak = (samples: Float32Array): number =>
  samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);

const maxJump = (samples: Float32Array): number => {
  let jump = 0;
  for (let index = 1; index < samples.length; index += 1) {
    jump = Math.max(jump, Math.abs((samples[index] ?? 0) - (samples[index - 1] ?? 0)));
  }
  return jump;
};

describe('sintesis de tonos', () => {
  const samples = toneSamples({ frequency: 440, durationSec: 0.05, volume: 0.5, sampleRate: 8000 });

  it('genera la cantidad de muestras que pide la duracion', () => {
    expect(samples).toHaveLength(400);
  });

  it('nunca se sale del volumen pedido', () => {
    expect(peak(samples)).toBeLessThanOrEqual(0.5);
  });

  it('arranca y termina en silencio: la envolvente evita el chasquido', () => {
    expect(samples[0]).toBe(0);
    expect(Math.abs(samples[samples.length - 1] ?? 1)).toBeLessThan(0.01);
  });

  it('suena de verdad en el medio', () => {
    expect(peak(samples)).toBeGreaterThan(0.3);
  });

  it('respeta la forma de onda pedida', () => {
    const square = toneSamples({ frequency: 100, durationSec: 0.05, wave: 'square', volume: 1 });
    const sine = toneSamples({ frequency: 100, durationSec: 0.05, wave: 'sine', volume: 1 });
    // La cuadrada salta de un extremo al otro; la senoidal avanza a pasitos.
    expect(maxJump(square)).toBeGreaterThan(5 * maxJump(sine));
  });
});

describe('anillo discontinuo', () => {
  it('reparte los trazos por la circunferencia', () => {
    const radius = 240;
    const dashes = dashedCircle(360, 360, radius, { dash: 8, gap: 12 });
    expect(dashes).toHaveLength(Math.round((2 * Math.PI * radius) / 20));
  });

  it('todos los puntos caen sobre el circulo', () => {
    const dashes = dashedCircle(100, 50, 30, { dash: 6, gap: 6, subdivisions: 3 });
    for (const dash of dashes) {
      expect(dash).toHaveLength(4);
      for (const point of dash) {
        expect(Math.hypot(point.x - 100, point.y - 50)).toBeCloseTo(30, 6);
      }
    }
  });

  it('un radio invalido no dibuja nada', () => {
    expect(dashedCircle(0, 0, 0)).toEqual([]);
    expect(dashedCircle(0, 0, 10, { dash: 0, gap: 0 })).toEqual([]);
  });
});

describe('cono de direccion', () => {
  it('sale en la direccion que ejecuta el corredor', () => {
    const [from, to] = pointerSegment({ x: 10, y: 20 }, { x: 1, y: 0 }, 5, 15);
    expect(from).toEqual({ x: 15, y: 20 });
    expect(to).toEqual({ x: 25, y: 20 });
  });

  it('respeta las diagonales', () => {
    const [, to] = pointerSegment({ x: 0, y: 0 }, { x: 1, y: 1 }, 0, 10);
    expect(to).toEqual({ x: 10, y: 10 });
  });
});
