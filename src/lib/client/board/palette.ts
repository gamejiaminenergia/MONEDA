/**
 * Paletas de la mesa.
 *
 * Viven en el cliente porque son pura presentacion: el motor no sabe de
 * colores. Los diez colores de los jugadores son los mismos en los dos temas
 * (`PLAYER_COLOR`); lo que cambia es el lienzo, el marco, la bola y los
 * efectos, mas un aro oscuro alrededor del corredor para que su color se lea
 * sobre fondo claro.
 */

export type BoardTheme = 'light' | 'dark';

export interface BoardPalette {
  /** Color base del lienzo (lo usa tambien el constructor de Phaser). */
  bg: string;
  bgTop: number;
  bgBottom: number;
  /** Anillo punteado de salida. */
  ring: number;
  /** Marco de la mesa. */
  line: number;
  /** Lineas tenues de la grilla antiagolpamiento. */
  grid: number;
  /** Relleno de una celda sobre el limite: la que va a reventar. */
  crowd: number;
  ball: number;
  ballGlow: number;
  ballGlowAlpha: number;
  danger: number;
  /** Chispas del rebote contra la pared. */
  spark: number;
  /** Rastro de la bola. */
  trail: number;
  text: string;
  textDim: string;
  shade: number;
  shadeAlpha: number;
  /** Aro del corredor; `null` en oscuro, donde el color ya brilla solo. */
  runnerStroke: number | null;
  /** Punto interior del corredor (hace de dona). */
  runnerCore: number;
  runnerCoreAlpha: number;
  /** Mezcla aditiva: sobre claro quemaria el color, asi que se apaga. */
  additive: boolean;
  /** Margen de oscurecido del color del equipo en el cono de direccion. */
  teamDarken: number;
}

export const BOARD_PALETTES: Record<BoardTheme, BoardPalette> = {
  dark: {
    bg: '#060911',
    bgTop: 0x0d1a2e,
    bgBottom: 0x060911,
    ring: 0x141f36,
    line: 0x22304d,
    grid: 0x2f466e,
    crowd: 0xff5c5c,
    ball: 0xffffff,
    ballGlow: 0x9fe8ff,
    ballGlowAlpha: 0.13,
    danger: 0xff5c5c,
    spark: 0x8aa0c6,
    trail: 0x9fe8ff,
    text: '#39d8ff',
    textDim: '#8aa0c6',
    shade: 0x04060c,
    shadeAlpha: 0.45,
    runnerStroke: null,
    runnerCore: 0x060911,
    runnerCoreAlpha: 0.75,
    additive: true,
    teamDarken: 0,
  },
  light: {
    bg: '#eef2f9',
    bgTop: 0xfbfcfe,
    bgBottom: 0xe6ecf6,
    ring: 0xc3cfe4,
    line: 0xb6c5dd,
    grid: 0x9aaecf,
    crowd: 0xcf2b21,
    ball: 0x101a2e,
    ballGlow: 0x0e7f9e,
    ballGlowAlpha: 0.16,
    danger: 0xcf2b21,
    spark: 0x64748b,
    trail: 0x0e7f9e,
    text: '#0e7f9e',
    textDim: '#5a6b88',
    shade: 0xffffff,
    shadeAlpha: 0.6,
    runnerStroke: 0x0f1a2e,
    runnerCore: 0xffffff,
    runnerCoreAlpha: 0.9,
    additive: false,
    teamDarken: 32,
  },
};
