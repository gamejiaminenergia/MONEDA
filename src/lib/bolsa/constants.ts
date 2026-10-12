/**
 * Constantes de BOLSA: horizonte, bandas de oferta, curva de demanda y
 * umbrales. Son la calibracion de arranque; se pueden anclar a datos reales del
 * MEM (`docs/mem/consultas.sql`) sin tocar el motor.
 *
 * Escala de juguete: la demanda es del orden de cientos de MWh por hora, no de
 * los ~9 GWh/h del SIN. El proposito es reflejar el mecanismo, no la magnitud.
 */

export const HORIZON_HOURS = 24;

/** Precio de escasez (COP/kWh): techo cuando la oferta no alcanza la demanda. */
export const SCARCITY_PRICE = 900;

/** Por debajo de esto, la caja del agente lo saca del mercado (insolvencia). */
export const INSOLVENCY_CASH = -150;

/** Lluvia: fraccion del inflow base que llega, con algo de azar. */
export const INFLOW_NOISE = 0.3;

export const PRICE_BAND_IDS = ['barata', 'media', 'cara', 'escasez'] as const;
export type PriceBandId = (typeof PRICE_BAND_IDS)[number];

export interface PriceBand {
  id: PriceBandId;
  /** Precio representativo de la banda, en COP/kWh. */
  price: number;
  label: string;
}

export const PRICE_BANDS: readonly PriceBand[] = [
  { id: 'barata', price: 100, label: 'barata' },
  { id: 'media', price: 230, label: 'media' },
  { id: 'cara', price: 420, label: 'cara' },
  { id: 'escasez', price: 780, label: 'escasez' },
];

export const QUANTITY_BAND_IDS = ['25', '50', '75', '100'] as const;
export type QuantityBandId = (typeof QUANTITY_BAND_IDS)[number];

export interface QuantityBand {
  id: QuantityBandId;
  /** Fraccion de la capacidad. */
  fraction: number;
  label: string;
}

export const QUANTITY_BANDS: readonly QuantityBand[] = [
  { id: '25', fraction: 0.25, label: 'un cuarto de tu capacidad' },
  { id: '50', fraction: 0.5, label: 'la mitad de tu capacidad' },
  { id: '75', fraction: 0.75, label: 'tres cuartos de tu capacidad' },
  { id: '100', fraction: 1, label: 'toda tu capacidad' },
];

const priceById = new Map(PRICE_BANDS.map((band) => [band.id, band.price]));
const quantityById = new Map(QUANTITY_BANDS.map((band) => [band.id, band.fraction]));

export const priceOfBand = (id: PriceBandId): number => priceById.get(id) ?? 100;
export const fractionOfBand = (id: QuantityBandId): number => quantityById.get(id) ?? 1;

export const isPriceBand = (value: unknown): value is PriceBandId =>
  typeof value === 'string' && (PRICE_BAND_IDS as readonly string[]).includes(value);
export const isQuantityBand = (value: unknown): value is QuantityBandId =>
  typeof value === 'string' && (QUANTITY_BAND_IDS as readonly string[]).includes(value);

/**
 * Curva de demanda (MWh) por hora. Sube hacia el pico de la tarde-noche
 * (18-21, como el pico del MEM) y baja de madrugada.
 */
const DEMAND_CURVE: readonly number[] = [
  620, 620, 620, 620, 620, 620, 640, 680, 700, 720, 730, 740,
  750, 760, 770, 780, 790, 850, 900, 920, 900, 850, 720, 650,
];

export function demandForHour(hour: number): number {
  const index = Math.min(Math.max(Math.floor(hour), 0), DEMAND_CURVE.length - 1);
  return DEMAND_CURVE[index] ?? DEMAND_CURVE[0] ?? 620;
}

/**
 * Sequia 0..1 a lo largo del dia: arranca suave y termina como un El Nino
 * (menos lluvia, embalses mas secos). Es la amenaza que se mueve.
 */
export function sequiaForHour(hour: number, horizonHours: number): number {
  const span = Math.max(1, horizonHours - 1);
  return 0.1 + 0.7 * (Math.min(Math.max(hour, 0), span) / span);
}
