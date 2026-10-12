import { describe, expect, it } from 'vitest';

import { GRID_CELL, GRID_COLS, GRID_ROWS, PAD, W } from '@/lib/game/constants';
import { cellCounts, cellIndex, cellOf } from '@/lib/game/grid';

describe('grilla antiagolpamiento', () => {
  it('parte la mesa jugable en celdas del tamano de un cuerpo', () => {
    expect(GRID_COLS * GRID_CELL).toBeCloseTo(W - 2 * PAD, 6);
    expect(GRID_CELL).toBeCloseTo(42, 6);
  });

  it('el borde superior-izquierdo cae en la celda (0, 0)', () => {
    expect(cellOf({ x: PAD, y: PAD })).toEqual({ col: 0, row: 0 });
  });

  it('fuera del marco se cae a la celda del borde, nunca a ninguna', () => {
    expect(cellOf({ x: -100, y: -100 })).toEqual({ col: 0, row: 0 });
    expect(cellOf({ x: 5000, y: 5000 })).toEqual({ col: GRID_COLS - 1, row: GRID_ROWS - 1 });
  });

  it('dos puntos en la misma celda comparten indice y se cuentan juntos', () => {
    const a = { x: PAD + 1, y: PAD + 1 };
    const b = { x: PAD + GRID_CELL - 1, y: PAD + GRID_CELL - 1 };
    expect(cellOf(a)).toEqual(cellOf(b));
    const counts = cellCounts([a, b, { x: 0, y: 0 }]);
    expect(counts[cellIndex(0, 0)]).toBe(3);
    expect(counts.reduce((sum, value) => sum + value, 0)).toBe(3);
  });
});
