type Updater<T> = T | ((current: T) => T);

export interface PersistentStore<T> {
  /** Snapshot para el navegador. Carga de localStorage la primera vez. */
  get(): T;
  /** Snapshot para el servidor/SSR: siempre los valores por defecto. */
  getServer(): T;
  set(next: Updater<T>): void;
  subscribe(listener: () => void): () => void;
}

export interface PersistentStoreOptions<T> {
  key: string;
  defaults: T;
  /** Devuelve null si lo guardado no sirve; en ese caso se usan los defaults. */
  parse: (raw: string | null) => T | null;
  serialize?: (value: T) => string;
}

/**
 * Tienda minima compatible con `useSyncExternalStore` que persiste en
 * localStorage. Evita efectos de hidratacion: el servidor siempre renderiza
 * los valores por defecto y el navegador corrige en el primer commit.
 */
export function createPersistentStore<T>(options: PersistentStoreOptions<T>): PersistentStore<T> {
  const serialize = options.serialize ?? ((value: T) => JSON.stringify(value));
  const listeners = new Set<() => void>();
  let current: T = options.defaults;
  let loaded = false;

  const load = (): void => {
    if (loaded || typeof window === 'undefined') return;
    loaded = true;
    try {
      const parsed = options.parse(window.localStorage.getItem(options.key));
      if (parsed !== null) current = parsed;
    } catch {
      current = options.defaults;
    }
  };

  return {
    get(): T {
      load();
      return current;
    },
    getServer(): T {
      return options.defaults;
    },
    set(next: Updater<T>): void {
      load();
      const value = typeof next === 'function' ? (next as (current: T) => T)(current) : next;
      if (value === current) return;
      current = value;
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(options.key, serialize(value));
        } catch {
          // localStorage bloqueado o lleno: la partida sigue sin persistir.
        }
      }
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
