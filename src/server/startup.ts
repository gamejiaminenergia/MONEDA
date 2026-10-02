import 'server-only';

import { currentLogLevel, logger, logsPrompts } from './log';
import { typesafeConfig } from './typesafe';

const log = logger.child('boot');

/**
 * Banner de arranque: deja en la terminal, de un vistazo, con que configuracion
 * quedo el servidor. Se llama una sola vez desde `instrumentation.ts`, cuando
 * Next ya tiene el runtime de Node listo.
 */
export function logStartup(): void {
  const config = typesafeConfig();

  log.info('Nimble Pong', {
    version: process.env.npm_package_version ?? 'dev',
    env: process.env.NODE_ENV ?? 'development',
    node: process.version,
  });
  log.info('configuracion', {
    typesafe: `${config.url} model=${config.model} timeoutMs=${config.timeoutMs} key=${config.apiKey ? 'ok' : 'falta'}`,
    logLevel: currentLogLevel(),
    prompts: logsPrompts(),
  });

  if (!config.apiKey) {
    log.warn('falta TYPESAFE_API_KEY: /api/decision respondera 502 y no habra jugadas');
  }
  if (logsPrompts()) {
    log.warn('LOG_PROMPTS activo: la terminal va a volcar el estado completo de cada decision');
  }
}
