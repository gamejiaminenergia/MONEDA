import {
  DEFAULT_INTERVAL_MS,
  DEFAULT_LIVES,
  MAX_INTERVAL_MS,
  MIN_INTERVAL_MS,
} from '@/lib/game/constants';

import { createPersistentStore } from './store';

export type Strategy = 'auto' | 'model' | 'heuristic';

export interface GameSettings {
  model: string;
  strategy: Strategy;
  intervalMs: number;
  /** Vidas por equipo: al perder la ultima, el equipo muere. */
  lives: number;
  muted: boolean;
  showDebug: boolean;
}

export const HEURISTIC_MODEL = 'heuristic';

export const defaultSettings: GameSettings = {
  model: 'nimble',
  strategy: 'auto',
  intervalMs: DEFAULT_INTERVAL_MS,
  lives: DEFAULT_LIVES,
  muted: false,
  showDebug: false,
};

const STORAGE_KEY = 'nimble.settings.v2';

const clampNumber = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** Valida lo guardado en localStorage. Cualquier valor raro cae al default. */
export function parseSettings(raw: string | null): GameSettings | null {
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Partial<GameSettings>;
    const interval = Number(stored.intervalMs);
    const lives = Number(stored.lives);
    return {
      model: typeof stored.model === 'string' && stored.model ? stored.model : defaultSettings.model,
      strategy:
        stored.strategy === 'auto' || stored.strategy === 'model' || stored.strategy === 'heuristic'
          ? stored.strategy
          : defaultSettings.strategy,
      intervalMs: Number.isFinite(interval)
        ? clampNumber(interval, MIN_INTERVAL_MS, MAX_INTERVAL_MS)
        : defaultSettings.intervalMs,
      lives: Number.isFinite(lives) && lives > 0 ? Math.round(lives) : defaultSettings.lives,
      muted: stored.muted === true,
      showDebug: stored.showDebug === true,
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
