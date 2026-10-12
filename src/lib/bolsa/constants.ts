/**
 * Constantes de BOLSA (version mensual). Escala de juguete sobre el dato real:
 * la demanda y el clima vienen de XM mes a mes; aqui viven las bandas de oferta,
 * los factores de las renovables y los umbrales.
 */

/** Por debajo de esto, la caja del agente lo saca del mercado (insolvencia). */
export const INSOLVENCY_CASH = -400;

/** Costo de la energia no servida (racionamiento), COP/kWh. */
export const RATIONING_COST = 1200;

/** Factor de planta mensual de solar y eolica (fraccion de su capacidad). */
export const SOLAR_CF = 0.25;
export const WIND_CF = 0.4;

export const PRICE_BAND_IDS = ['barata', 'media', 'cara', 'escasez'] as const;
export type PriceBandId = (typeof PRICE_BAND_IDS)[number];

export interface PriceBand {
  id: PriceBandId;
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
  fraction: number;
  label: string;
}

export const QUANTITY_BANDS: readonly QuantityBand[] = [
  { id: '25', fraction: 0.25, label: 'un cuarto de tu energia' },
  { id: '50', fraction: 0.5, label: 'la mitad de tu energia' },
  { id: '75', fraction: 0.75, label: 'tres cuartos de tu energia' },
  { id: '100', fraction: 1, label: 'toda tu energia' },
];

const priceById = new Map(PRICE_BANDS.map((band) => [band.id, band.price]));
const quantityById = new Map(QUANTITY_BANDS.map((band) => [band.id, band.fraction]));

export const priceOfBand = (id: PriceBandId): number => priceById.get(id) ?? 100;
export const fractionOfBand = (id: QuantityBandId): number => quantityById.get(id) ?? 1;

export const isPriceBand = (value: unknown): value is PriceBandId =>
  typeof value === 'string' && (PRICE_BAND_IDS as readonly string[]).includes(value);
export const isQuantityBand = (value: unknown): value is QuantityBandId =>
  typeof value === 'string' && (QUANTITY_BAND_IDS as readonly string[]).includes(value);
