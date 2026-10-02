/**
 * Tipos de presentacion compartidos por el HUD. Viven fuera de los componentes
 * para que el contenedor (`GameShell`) y las piezas no dependan unas de otras
 * solo por un tipo.
 */

export type StatusKind = 'on' | 'off' | 'loading' | 'pause' | 'err';

export interface Status {
  text: string;
  kind: StatusKind;
}
