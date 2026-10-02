/**
 * Precio de los modelos de TypeSafe, en dolares por millon de tokens.
 *
 * Jev cobra **solo la entrada**: la salida es gratis. Eso significa que el
 * costo de una partida lo manda el prompt que se reenvia en cada decision, no
 * lo que responde el modelo. Los numeros salen de la tabla oficial de
 * `docs.typesafe.ai/models` (Jev 1.13) y estan documentados con sus cuentas en
 * `docs/PLAN-FRONTEND.md`.
 *
 * Modulo puro: sin `fetch`, sin `next/*` y sin DOM, para que corra en Node y en
 * el navegador (la consola del modelo muestra el costo de la sesion).
 */

export interface TokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface ModelPrice {
  inputPerMTok: number;
  outputPerMTok: number;
}

/** Version concreta y alias: hoy resuelven al mismo precio. */
const PRICES: Record<string, ModelPrice> = {
  'jev-1.13.0': { inputPerMTok: 0.042, outputPerMTok: 0 },
  'jev-latest': { inputPerMTok: 0.042, outputPerMTok: 0 },
  'jev-preview': { inputPerMTok: 0.042, outputPerMTok: 0 },
};

export function priceOf(model: string): ModelPrice | null {
  return PRICES[model] ?? null;
}

/**
 * Costo en dolares de un uso. Devuelve `null` si no conocemos el modelo: es
 * preferible mostrar "sin precio" a inventar una cifra.
 */
export function costOf(usage: TokenUsage, model: string): number | null {
  const price = priceOf(model);
  if (!price) return null;
  const input = usage.inputTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  return (input / 1_000_000) * price.inputPerMTok + (output / 1_000_000) * price.outputPerMTok;
}

/** Dinero en formato corto: los costos por decision son de fracciones de centavo. */
export function formatUsd(value: number | null): string {
  if (value === null) return '—';
  if (value === 0) return '$0';
  if (value < 0.01) return `$${value.toFixed(5)}`;
  if (value < 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

/** Tokens en formato corto para el HUD: 3480 -> 3.5k. */
export function formatTokens(value: number | null): string {
  if (value === null) return '—';
  if (value < 1_000) return String(value);
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${(value / 1_000_000).toFixed(2)}M`;
}
