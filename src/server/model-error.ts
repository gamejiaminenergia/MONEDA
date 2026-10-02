import type { ModelErrorCode } from '@/lib/ai/contracts';

/**
 * Errores de TypeSafe ya clasificados (timeout, 401/403, contrato roto). La
 * ruta solo necesita el codigo y el mensaje para responder al cliente; la clave
 * nunca viaja fuera del servidor.
 */
export class ModelError extends Error {
  readonly code: ModelErrorCode;

  constructor(code: ModelErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ModelError';
    this.code = code;
  }
}
