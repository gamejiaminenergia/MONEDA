import { SOLAR_CF, WIND_CF } from './constants';
import type { Embalse, Resource } from './types';

/**
 * Hidrologia mensual. El clima es **exogeno**: el embalse y los aportes vienen
 * del dato real de cada mes (`PorcVoluUtilDiar`, `PorcApor`). Aqui solo se traduce
 * ese nivel en la energia disponible de cada planta.
 */

export const embalseById = (embalses: readonly Embalse[], id: string): Embalse | undefined =>
  embalses.find((embalse) => embalse.id === id);

/** Una hidro solo puede usar la fraccion de su capacidad que dice el embalse. */
export const hydroFactor = (embalsePct: number): number => Math.min(1, Math.max(0.05, embalsePct));

/** Factor de disponibilidad mensual por tipo de planta. */
export function availabilityFactor(resource: Resource, embalsePct: number): number {
  if (resource.type === 'hidro') return hydroFactor(embalsePct);
  if (resource.type === 'solar') return SOLAR_CF;
  if (resource.type === 'eolica') return WIND_CF;
  return 1;
}
