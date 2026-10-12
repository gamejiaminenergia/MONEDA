import 'server-only';

import { listSessions, saveSession } from '../mongo';
import type { SessionRecord, SessionRepository } from './ports';

/**
 * Adaptador del puerto `SessionRepository` sobre Mongo. La logica de aplicacion
 * no sabe de colecciones: solo pide guardar o listar.
 */
export const mongoSessionRepository: SessionRepository = {
  save: (record: SessionRecord) => saveSession(record),
  list: (limit: number) => listSessions(limit),
};
