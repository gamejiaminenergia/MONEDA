import { GRID_CELL, GRID_COLS, GRID_ROWS, PAD } from './constants';
import type { Point } from './types';

/**
 * La grilla antiagolpamiento, en funciones puras.
 *
 * El motor solo necesita dos cosas de aqui: en que celda cae cada corredor y
 * cuantos comparten cada celda. Vive aparte de `engine.ts` para poder probarla
 * sin montar toda la partida (y sin navegador, como el resto del motor).
 */

/** Una celda de la grilla, en columnas y filas. */
export interface Cell {
  col: number;
  row: number;
}

/** Indice lineal de una celda, fila por fila: `row * cols + col`. */
export const cellIndex = (col: number, row: number): number => row * GRID_COLS + col;

/**
 * Columna o fila de un valor. Fuera del marco se cae a la celda del borde:
 * un corredor siempre esta en alguna celda, nunca en ninguna.
 */
const axis = (value: number, count: number): number => {
  const index = Math.floor((value - PAD) / GRID_CELL);
  if (index < 0) return 0;
  return index >= count ? count - 1 : index;
};

/** Celda que ocupa un punto. */
export function cellOf(point: Point): Cell {
  return { col: axis(point.x, GRID_COLS), row: axis(point.y, GRID_ROWS) };
}

/** Indice lineal del punto, listo para indexar un conteo por celda. */
export function cellIndexOf(point: Point): number {
  const cell = cellOf(point);
  return cellIndex(cell.col, cell.row);
}

/** Cuantos puntos caen en cada celda, indexado `row * cols + col`. */
export function cellCounts(points: readonly Point[]): number[] {
  const counts = new Array<number>(GRID_COLS * GRID_ROWS).fill(0);
  for (const point of points) {
    const index = cellIndexOf(point);
    counts[index] = (counts[index] ?? 0) + 1;
  }
  return counts;
}
