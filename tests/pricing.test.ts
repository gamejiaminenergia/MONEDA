import { describe, expect, it } from 'vitest';

import { costOf, formatTokens, formatUsd, priceOf } from '@/lib/ai/pricing';

describe('precios de TypeSafe', () => {
  it('cobra solo la entrada: 3.500 tokens son ~$0,000147', () => {
    const cost = costOf({ inputTokens: 3_500, outputTokens: 1_100 }, 'jev-latest');
    expect(cost).toBeCloseTo(0.000147, 9);
  });

  it('la salida es gratis', () => {
    const sinSalida = costOf({ inputTokens: 1_000_000, outputTokens: 0 }, 'jev-1.13.0');
    const conSalida = costOf({ inputTokens: 1_000_000, outputTokens: 500_000 }, 'jev-1.13.0');
    expect(sinSalida).toBeCloseTo(0.042, 9);
    expect(conSalida).toBeCloseTo(sinSalida ?? 0, 9);
  });

  it('un modelo desconocido no tiene precio inventado', () => {
    expect(priceOf('nimble')).toBeNull();
    expect(costOf({ inputTokens: 1000, outputTokens: 10 }, 'nimble')).toBeNull();
  });

  it('un uso incompleto no rompe la cuenta', () => {
    expect(costOf({ inputTokens: null, outputTokens: null }, 'jev-latest')).toBe(0);
  });
});

describe('formato', () => {
  it('muestra fracciones de centavo sin perder el dato', () => {
    expect(formatUsd(0.000147)).toBe('$0.00015');
    expect(formatUsd(0)).toBe('$0');
    expect(formatUsd(null)).toBe('—');
  });

  it('abrevia los tokens para el HUD', () => {
    expect(formatTokens(940)).toBe('940');
    expect(formatTokens(3_480)).toBe('3.5k');
    expect(formatTokens(2_400_000)).toBe('2.40M');
    expect(formatTokens(null)).toBe('—');
  });
});
