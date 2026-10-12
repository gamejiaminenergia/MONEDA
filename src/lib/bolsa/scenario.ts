import type { Agent, Embalse, Period, Resource, Scenario } from './types';

/**
 * El escenario mensual de BOLSA: 72 meses (2020-01 -> 2025-12) con las series
 * reales de XM (demanda, bolsa, escasez, embalse y aportes), tomadas con
 * `docs/mem/scenario.sql`. Las capacidades de los agentes son proporcionales para
 * que el sistema sea jugable pero tenso en sequia.
 *
 * Las cinco series por mes: [mes, demanda GWh, bolsa COP/kWh, escasez COP/kWh,
 * embalse 0..1, aportes vs media].
 */
const RAW: readonly (readonly [string, number, number, number, number, number])[] = [
  ['2020-01', 6119.3, 327.5, 551.2, 0.602, 0.7],
  ['2020-02', 5988.0, 434.4, 602.9, 0.479, 0.7],
  ['2020-03', 5993.0, 342.6, 555.4, 0.386, 0.7],
  ['2020-04', 5200.8, 255.0, 452.1, 0.335, 0.6],
  ['2020-05', 5642.2, 366.1, 312.3, 0.329, 0.6],
  ['2020-06', 5568.4, 309.9, 303.8, 0.410, 0.8],
  ['2020-07', 5926.6, 159.3, 370.4, 0.562, 1.0],
  ['2020-08', 5990.0, 160.5, 406.4, 0.631, 0.8],
  ['2020-09', 5880.8, 152.9, 448.6, 0.671, 0.9],
  ['2020-10', 6124.7, 202.6, 449.2, 0.684, 0.7],
  ['2020-11', 5873.8, 184.1, 454.1, 0.731, 1.1],
  ['2020-12', 6114.6, 165.5, 436.0, 0.743, 0.9],
  ['2021-01', 5936.9, 182.8, 460.9, 0.683, 1.0],
  ['2021-02', 5668.0, 272.2, 507.9, 0.572, 1.0],
  ['2021-03', 6233.3, 168.5, 557.4, 0.550, 1.7],
  ['2021-04', 6004.4, 164.4, 603.7, 0.603, 1.1],
  ['2021-05', 6015.2, 101.0, 591.9, 0.742, 1.3],
  ['2021-06', 6017.8, 90.7, 615.2, 0.834, 1.4],
  ['2021-07', 6377.1, 91.9, 627.7, 0.848, 1.1],
  ['2021-08', 6346.9, 94.1, 671.9, 0.859, 1.2],
  ['2021-09', 6307.7, 109.1, 665.0, 0.854, 1.1],
  ['2021-10', 6490.1, 105.2, 691.4, 0.841, 1.0],
  ['2021-11', 6289.7, 105.2, 746.3, 0.844, 1.0],
  ['2021-12', 6429.4, 338.4, 785.0, 0.813, 0.8],
  ['2022-01', 6277.9, 292.5, 731.0, 0.739, 0.9],
  ['2022-02', 5878.4, 402.7, 784.1, 0.623, 1.1],
  ['2022-03', 6535.3, 229.4, 854.2, 0.587, 1.5],
  ['2022-04', 6272.4, 145.7, 915.6, 0.598, 1.3],
  ['2022-05', 6577.6, 106.2, 971.2, 0.677, 1.0],
  ['2022-06', 6207.7, 104.6, 952.5, 0.763, 1.2],
  ['2022-07', 6564.8, 109.8, 1030.1, 0.839, 1.2],
  ['2022-08', 6624.5, 151.9, 1037.2, 0.867, 1.2],
  ['2022-09', 6409.8, 256.5, 997.3, 0.850, 1.1],
  ['2022-10', 6558.2, 304.1, 909.9, 0.832, 1.3],
  ['2022-11', 6301.8, 187.7, 940.2, 0.865, 1.4],
  ['2022-12', 6448.7, 340.6, 945.1, 0.830, 1.0],
  ['2023-01', 6393.4, 376.0, 854.8, 0.767, 1.4],
  ['2023-02', 5999.7, 532.6, 821.7, 0.653, 1.0],
  ['2023-03', 6651.0, 297.8, 899.7, 0.600, 1.7],
  ['2023-04', 6365.9, 229.5, 810.4, 0.596, 1.1],
  ['2023-05', 6845.5, 576.8, 831.8, 0.604, 0.8],
  ['2023-06', 6581.5, 469.2, 781.7, 0.699, 0.9],
  ['2023-07', 6801.3, 528.2, 727.7, 0.777, 0.9],
  ['2023-08', 7012.4, 539.0, 725.2, 0.818, 0.8],
  ['2023-09', 6886.3, 1017.5, 835.1, 0.774, 0.6],
  ['2023-10', 6889.5, 1023.6, 863.5, 0.724, 0.6],
  ['2023-11', 6698.7, 520.1, 846.7, 0.753, 0.7],
  ['2023-12', 6856.9, 659.8, 779.0, 0.719, 0.6],
  ['2024-01', 6896.4, 560.7, 739.9, 0.637, 0.5],
  ['2024-02', 6554.8, 572.1, 745.7, 0.502, 0.6],
  ['2024-03', 7047.4, 625.2, 727.8, 0.368, 0.5],
  ['2024-04', 6811.6, 754.8, 742.7, 0.307, 0.6],
  ['2024-05', 6927.4, 296.5, 793.3, 0.381, 1.0],
  ['2024-06', 6542.7, 286.0, 766.5, 0.515, 1.2],
  ['2024-07', 6944.3, 289.4, 810.7, 0.593, 0.9],
  ['2024-08', 6973.0, 571.8, 818.4, 0.573, 0.7],
  ['2024-09', 6868.1, 875.6, 785.1, 0.516, 0.6],
  ['2024-10', 7024.0, 1553.1, 751.3, 0.531, 0.6],
  ['2024-11', 6606.4, 1068.0, 811.9, 0.626, 0.9],
  ['2024-12', 6915.4, 749.9, 798.7, 0.664, 0.7],
  ['2025-01', 6861.1, 524.8, 797.4, 0.657, 0.9],
  ['2025-02', 6392.6, 435.7, 793.9, 0.568, 1.3],
  ['2025-03', 7051.5, 235.5, 770.5, 0.516, 1.3],
  ['2025-04', 6762.0, 143.4, 739.8, 0.536, 1.5],
  ['2025-05', 7100.0, 129.1, 724.3, 0.675, 1.4],
  ['2025-06', 6822.8, 113.2, 673.7, 0.786, 1.4],
  ['2025-07', 7294.3, 137.9, 699.2, 0.823, 1.2],
  ['2025-08', 7211.8, 247.7, 746.2, 0.825, 1.0],
  ['2025-09', 7095.2, 304.0, 711.3, 0.829, 1.0],
  ['2025-10', 7197.1, 175.6, 675.8, 0.825, 0.9],
  ['2025-11', 7068.6, 225.7, 658.6, 0.844, 0.9],
  ['2025-12', 7192.2, 281.5, 625.2, 0.835, 0.9],
];

export const PERIODS: Period[] = RAW.map(([month, demandGwh, bolsaRef, escasez, embalsePct, aportePct]) => ({
  month,
  demandGwh,
  bolsaRef,
  escasez,
  embalsePct,
  aportePct,
}));

const COLOR: Record<string, string> = {
  azul: '#5b8dff',
  verde: '#38ff9c',
  turquesa: '#2ee6c5',
  rojo: '#ff5c5c',
  naranja: '#ff9f43',
  amarillo: '#ffd93d',
  morado: '#b06bff',
  rosa: '#ff5cf0',
  cian: '#39d8ff',
  lima: '#a6ff4d',
  violeta: '#9b6bff',
  marron: '#c08a5a',
};

const RESOURCES: Resource[] = [
  { id: 'guavio', name: 'Hidro Guavio', type: 'hidro', owner: 'azul', capacityGwh: 1400, cost: 55, enfi: 600, fuel: null, embalse: 'guavio', emissions: 0 },
  { id: 'san-carlos', name: 'Hidro San Carlos', type: 'hidro', owner: 'verde', capacityGwh: 1200, cost: 65, enfi: 520, fuel: null, embalse: 'san-carlos', emissions: 0 },
  { id: 'betania', name: 'Hidro Betania', type: 'hidro', owner: 'turquesa', capacityGwh: 900, cost: 78, enfi: 360, fuel: null, embalse: 'betania', emissions: 0 },
  { id: 'guajira', name: 'Termo Guajira', type: 'termica', owner: 'rojo', capacityGwh: 1800, cost: 300, enfi: 1500, fuel: 'gas', embalse: null, emissions: 450 },
  { id: 'tasajero', name: 'Termo Tasajero', type: 'termica', owner: 'naranja', capacityGwh: 1500, cost: 360, enfi: 1300, fuel: 'gas', embalse: null, emissions: 500 },
  { id: 'gecelca', name: 'Termo Gecelca', type: 'termica', owner: 'amarillo', capacityGwh: 1300, cost: 430, enfi: 1100, fuel: 'carbon', embalse: null, emissions: 900 },
  { id: 'solar-norte', name: 'Solar Norte', type: 'solar', owner: 'morado', capacityGwh: 500, cost: 150, enfi: 80, fuel: null, embalse: null, emissions: 0 },
  { id: 'eolica-guajira', name: 'Eolica Guajira', type: 'eolica', owner: 'rosa', capacityGwh: 300, cost: 130, enfi: 60, fuel: null, embalse: null, emissions: 0 },
];

const EMBALSES: Embalse[] = [
  { id: 'guavio', name: 'Embalse Guavio', region: 'Centro', river: 'Rio Guavio' },
  { id: 'san-carlos', name: 'Embalse San Carlos', region: 'Centro', river: 'Rio Guatape' },
  { id: 'betania', name: 'Embalse Betania', region: 'Sur', river: 'Rio Magdalena' },
];

function generator(id: Agent['id'], name: string, resourceIds: string[]): Agent {
  return { id, name, color: COLOR[id] ?? '#888', role: 'generador', cash: 0, alive: true, resources: resourceIds, lastOffers: {}, demandGwh: 0, coverage: 0, contractPrice: 0, tariff: 0 };
}

function comercializador(id: Agent['id'], name: string, weight: number, coverage: number, contractPrice: number, tariff: number): Agent {
  return { id, name, color: COLOR[id] ?? '#888', role: 'comercializador', cash: 0, alive: true, resources: [], lastOffers: {}, demandGwh: weight, coverage, contractPrice, tariff };
}

const AGENTS: Agent[] = [
  generator('azul', 'Hidro Guavio', ['guavio']),
  generator('verde', 'Hidro San Carlos', ['san-carlos']),
  generator('turquesa', 'Hidro Betania', ['betania']),
  generator('rojo', 'Termo Guajira', ['guajira']),
  generator('naranja', 'Termo Tasajero', ['tasajero']),
  generator('amarillo', 'Termo Gecelca', ['gecelca']),
  generator('morado', 'Solar Norte', ['solar-norte']),
  generator('rosa', 'Eolica Guajira', ['eolica-guajira']),
  comercializador('cian', 'Comercializador Cian', 500, 0.8, 250, 340),
  comercializador('lima', 'Comercializador Lima', 380, 0.75, 255, 340),
  comercializador('violeta', 'Comercializador Violeta', 270, 0.7, 260, 340),
  comercializador('marron', 'Comercializador Marron', 200, 0.65, 265, 340),
];

export const HISTORICO_SCENARIO: Scenario = {
  id: 'historico',
  name: 'Historico (2020-2025, dato real)',
  description: 'Sesenta meses de demanda, bolsa, escasez, embalse y aportes reales de XM.',
  tieCapacityGwh: 1200,
  tiePrice: 750,
  carbonPrice: 25,
  reconciliationPerGwh: 6,
  oefPenalty: 120,
  periods: PERIODS,
  resources: RESOURCES,
  embalses: EMBALSES,
  agents: AGENTS,
};

export const SIN_TIE_SCENARIO: Scenario = {
  ...HISTORICO_SCENARIO,
  id: 'sin-tie',
  name: 'Sin TIE (2020-2025, sin importaciones)',
  description: 'El mismo historico sin la valvula de importacion: se nota la sequia de 2024.',
  tieCapacityGwh: 0,
};

export const SCENARIOS: readonly Scenario[] = [HISTORICO_SCENARIO, SIN_TIE_SCENARIO];

export function getScenario(id: string): Scenario {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? HISTORICO_SCENARIO;
}
