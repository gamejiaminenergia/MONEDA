import {
  BALL_SPEED,
  DEFAULT_INTERVAL_MS,
  MAX_BALL_SPEED,
  MAX_INTERVAL_MS,
  MIN_BALL_SPEED,
  MIN_INTERVAL_MS,
} from '@/lib/game/constants';

import { createPersistentStore } from './store';

export interface GameSettings {
  model: string;
  intervalMs: number;
  /** Velocidad de la bola, en px/s, ajustable en vivo. */
  ballSpeed: number;
  muted: boolean;
  /** Consola del modelo abierta (peticiones, respuestas y costo). */
  showConsole: boolean;
  /** Guardar cada peticion en la traza del servidor. */
  trace: boolean;
}

export const defaultSettings: GameSettings = {
  // TypeSafe es el unico proveedor; `jev-latest` es su alias estable.
  model: 'jev-latest',
  intervalMs: DEFAULT_INTERVAL_MS,
  ballSpeed: BALL_SPEED,
  muted: false,
  // La consola arranca abierta: es donde se ven peticiones, JSON y costo.
  showConsole: true,
  // Guardar cada peticion para poder verla despues.
  trace: true,
};

// v9: la velocidad de la bola por defecto pasa a ser la maxima, asi que se
// descarta lo guardado con el default viejo (si no, seguiria pesando).
const STORAGE_KEY = 'nimble.settings.v9';

const clampNumber = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** Valida lo guardado en localStorage. Cualquier valor raro cae al default. */
export function parseSettings(raw: string | null): GameSettings | null {
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Partial<GameSettings>;
    const interval = Number(stored.intervalMs);
    const ballSpeed = Number(stored.ballSpeed);
    return {
      model: typeof stored.model === 'string' && stored.model ? stored.model : defaultSettings.model,
      intervalMs: Number.isFinite(interval)
        ? clampNumber(interval, MIN_INTERVAL_MS, MAX_INTERVAL_MS)
        : defaultSettings.intervalMs,
      ballSpeed: Number.isFinite(ballSpeed)
        ? clampNumber(ballSpeed, MIN_BALL_SPEED, MAX_BALL_SPEED)
        : defaultSettings.ballSpeed,
      muted: stored.muted === true,
      showConsole: stored.showConsole === true,
      trace: stored.trace !== false,
    };
  } catch {
    return null;
  }
}

export const settingsStore = createPersistentStore<GameSettings>({
  key: STORAGE_KEY,
  defaults: defaultSettings,
  parse: parseSettings,
});
