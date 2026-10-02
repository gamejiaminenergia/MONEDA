import 'server-only';

/**
 * Logs del servidor con una sola linea por evento, legibles en la terminal y
 * faciles de filtrar (`grep api/decision`, `grep level=warn`).
 *
 * Reglas:
 *  - nivel por `LOG_LEVEL` (debug | info | warn | error | silent); por defecto
 *    `info`, que ya cuenta cada decision con su latencia y su resultado;
 *  - color solo si la salida es una terminal y no hay `NO_COLOR`;
 *  - los campos van como `clave=valor`, sin saltos de linea ni objetos
 *    anidados: JSON serializado en una linea;
 *  - el prompt y el snapshot completos solo se vuelcan con `LOG_PROMPTS=1`, y
 *    siempre a nivel debug, para no inundar la terminal ni filtrar de mas.
 *
 * Aunque el archivo sea pequeno, todo lo que se imprime en la terminal pasa
 * por aqui: si un dia hay que mandar esto a un colector, solo cambia `write`.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

const parseLevel = (): LogLevel => {
  const raw = (process.env.LOG_LEVEL ?? '').trim().toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error' || raw === 'silent') {
    return raw;
  }
  return 'info';
};

const LEVEL: LogLevel = parseLevel();
const PROMPTS = process.env.LOG_PROMPTS === '1' || process.env.LOG_PROMPTS === 'true';

const colorEnabled = (): boolean => !process.env.NO_COLOR && process.stdout.isTTY === true;

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
} as const;

export type LogFields = Record<string, unknown>;

/** `true` si se pidio volcar prompts y snapshots completos. */
export const logsPrompts = (): boolean => PROMPTS;

/** Nivel activo, para que el arranque pueda anunciarlo. */
export const currentLogLevel = (): LogLevel => LEVEL;

/** Entrecomilla solo cuando el texto rompe el formato `clave=valor`. */
const quote = (text: string): string => (/[\s=",]/.test(text) ? JSON.stringify(text) : text);

/**
 * Un valor de campo, siempre en una linea y sin escapes raros: los arreglos
 * salen como `a,b` y los objetos como `clave:valor,clave:valor`, que es lo que
 * se lee bien en una terminal (un JSON escapado con \" no hay quien lo mire).
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NaN';
  if (typeof value === 'boolean') return String(value);
  if (value instanceof Error) return quote(`${value.name}: ${value.message}`);
  if (Array.isArray(value)) return value.map((item) => formatValue(item)).join(',');
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'object') {
    const parts = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => `${key}:${formatValue(item)}`);
    return parts.length > 0 ? parts.join(',') : '{}';
  }
  return quote(String(value));
}

const formatFields = (fields?: LogFields): string => {
  if (!fields) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    parts.push(`${key}=${formatValue(value)}`);
  }
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
};

const localTime = (): string => {
  const now = new Date();
  return `${now.toTimeString().slice(0, 8)}.${String(now.getMilliseconds()).padStart(3, '0')}`;
};

/** Todas las lineas llevan estos campos: utiles para filtrar y para alertas. */
export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  /** Mismo logger con otro alcance, p.ej. `typesafe` o `api/decision`. */
  child(scope: string): Logger;
}

function write(level: Exclude<LogLevel, 'silent'>, scope: string, message: string, fields?: LogFields): void {
  if (ORDER[level] < ORDER[LEVEL]) return;

  const color = colorEnabled();
  const paint = (text: string, code: string): string => (color ? `${code}${text}${ANSI.reset}` : text);
  const label = level.toUpperCase().padEnd(5);
  const line =
    `${paint(localTime(), ANSI.dim)} ${paint(label, ANSI[level])} ` +
    `${paint(`[${scope}]`, ANSI.dim)} ${message}${formatFields(fields)}`;

  const stream = level === 'warn' || level === 'error' ? process.stderr : process.stdout;
  stream.write(`${line}\n`);

  // A nivel debug, la pila completa debajo para no romper el formato de linea.
  if (level === 'error' && LEVEL === 'debug') {
    for (const value of Object.values(fields ?? {})) {
      if (value instanceof Error && value.stack) {
        stream.write(`${paint(value.stack, ANSI.dim)}\n`);
        break;
      }
    }
  }
}

function scoped(scope: string): Logger {
  return {
    debug: (message, fields) => write('debug', scope, message, fields),
    info: (message, fields) => write('info', scope, message, fields),
    warn: (message, fields) => write('warn', scope, message, fields),
    error: (message, fields) => write('error', scope, message, fields),
    child: (childScope) => scoped(`${scope}:${childScope}`),
  };
}

export const logger: Logger = scoped('nimble');

/** Milisegundos enteros desde un instante, para medir sin decimales. */
export const elapsedMs = (startedAt: number): number => Math.max(0, Math.round(Date.now() - startedAt));
