'use client';

import { useCallback, useSyncExternalStore } from 'react';

import { settingsStore, type GameSettings } from '@/lib/client/settings';

/**
 * Ajustes con respaldo en localStorage. Arranca con los valores por defecto
 * para no romper la hidratacion y los hidrata en el primer efecto.
 */
export function useGameSettings() {
  const settings = useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.getServer);

  const update = useCallback((patch: Partial<GameSettings>) => {
    settingsStore.set((current) => ({ ...current, ...patch }));
  }, []);

  return { settings, update };
}
