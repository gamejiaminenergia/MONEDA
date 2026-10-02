'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { applyTheme, currentTheme, setTheme, themeStore, type Theme } from '@/lib/client/theme';

/**
 * Tema de la pagina con respaldo en localStorage. El servidor siempre pinta el
 * claro (snapshot estable) y el navegador corrige al hidratar, igual que los
 * ajustes: asi no hay error de hidratacion.
 */
export function useTheme() {
  const state = useSyncExternalStore(themeStore.subscribe, themeStore.get, themeStore.getServer);

  useEffect(() => {
    applyTheme(state.theme);
  }, [state.theme]);

  const toggle = useCallback(() => {
    setTheme(currentTheme() === 'light' ? 'dark' : 'light');
  }, []);

  const select = useCallback((theme: Theme) => {
    setTheme(theme);
  }, []);

  return { theme: state.theme, toggle, select };
}
