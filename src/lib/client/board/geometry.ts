import type { Point } from '@/lib/game/types';

/**
 * Geometria de apoyo para la escena de Phaser. Son funciones puras: se pueden
 * probar sin navegador, que es justo lo que el motor de juego necesita para
 * seguir siendo verificable fuera de un canvas.
 */

export interface DashOptions {
  /** Largo del trazo, en pixeles de arco. */
  dash?: number;
  /** Hueco entre trazos, en pixeles de arco. */
  gap?: number;
  /** Cuantos segmentos rectos aproximan cada trazo. */
  subdivisions?: number;
}

/**
 * Un circulo discontinuo como lista de trazos, cada uno con sus puntos.
 *
 * Graphics de Phaser no tiene `setLineDash`, asi que el punteado se calcula
 * aqui: se reparte la circunferencia en tantos periodos como quepan y cada
 * trazo se aproxima con `subdivisions` segmentos para que no se vea poligonal.
 */
export function dashedCircle(
  cx: number,
  cy: number,
  radius: number,
  { dash = 8, gap = 12, subdivisions = 4 }: DashOptions = {},
): Point[][] {
  const period = dash + gap;
  if (radius <= 0 || period <= 0 || subdivisions < 1) return [];

  const circumference = 2 * Math.PI * radius;
  const count = Math.max(1, Math.round(circumference / period));
  const step = (Math.PI * 2) / count;
  const dashAngle = step * (dash / period);
  const dashes: Point[][] = [];

  for (let index = 0; index < count; index += 1) {
    const start = index * step;
    const points: Point[] = [];
    for (let part = 0; part <= subdivisions; part += 1) {
      const angle = start + (dashAngle * part) / subdivisions;
      points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
    }
    dashes.push(points);
  }

  return dashes;
}

/**
 * El segmento que sale de un corredor en la direccion que esta ejecutando.
 * `from` y `to` son distancias desde el centro del disco.
 */
export function pointerSegment(
  origin: Point,
  direction: Point,
  from: number,
  to: number,
): [Point, Point] {
  return [
    { x: origin.x + direction.x * from, y: origin.y + direction.y * from },
    { x: origin.x + direction.x * to, y: origin.y + direction.y * to },
  ];
}
