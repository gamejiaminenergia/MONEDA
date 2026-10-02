import { createPersistentStore } from './store';

/**
 * Tema visual de la pagina.
 *
 * El claro es el de fabrica: es el que se muestra en las demos. El oscuro sigue
 * disponible con el boton del panel.
 *
 * Se guarda aparte de los demas ajustes (clave propia y valor plano) porque un
 * script diminuto en el <head> tiene que poder leerlo antes de pintar y evitar
 * el destello blanco al recargar en oscuro.
 */

export type Theme = 'light' | 'dark';

export const THEME_KEY = 'nimble.theme';
export const DEFAULT_THEME: Theme = 'light';

interface ThemeState {
  theme: Theme;
}

export const themeStore = createPersistentStore<ThemeState>({
  key: THEME_KEY,
  defaults: { theme: DEFAULT_THEME },
  parse: (raw) => (raw === 'light' || raw === 'dark' ? { theme: raw } : null),
  serialize: (value) => value.theme,
});

/** Escribe el tema en el <html>. Es DOM, no render: por eso va en un efecto. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

export function setTheme(theme: Theme): void {
  themeStore.set({ theme });
  applyTheme(theme);
}

export function currentTheme(): Theme {
  return themeStore.get().theme;
}
