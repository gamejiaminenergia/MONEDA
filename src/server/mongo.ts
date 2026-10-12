import 'server-only';

import { MongoClient, type Db } from 'mongodb';

import type { MatchDocument, ModelCall } from '@/lib/ai/contracts';
import { logger } from './log';

/**
 * Historico de partidas en MongoDB.
 *
 * Todo cae en UNA sola coleccion (`matches`): un documento por ronda cerrada.
 * Vive en el servidor, igual que la API key: el navegador manda la partida a
 * `POST /api/matches` y nunca habla con Mongo.
 *
 * La persistencia es opcional a proposito: sin `MONGO_URL`, o si Mongo no
 * responde, el juego sigue igual. Guardar una partida jamas puede tumbarla.
 *
 * El cliente se crea una sola vez y se reutiliza. Se guarda en `globalThis`
 * porque en desarrollo Next recarga los modulos y, sin esto, cada recarga
 * abriria un pool de conexiones nuevo.
 */

const log = logger.child('mongo');

/** La unica coleccion del historico. */
export const MATCHES_COLLECTION = 'matches';
const DEFAULT_DB = 'nimble';

interface MongoHandle {
  client: MongoClient;
  db: Db;
}

interface GlobalWithMongo {
  __nimbleMongo?: Promise<MongoHandle | null> | null;
}

const globalRef = globalThis as typeof globalThis & GlobalWithMongo;

/** `true` si hay `MONGO_URL`; con esto apagado no se intenta conectar. */
export function matchesConfigured(): boolean {
  return mongoUrl().length > 0;
}

function mongoUrl(): string {
  return (process.env.MONGO_URL ?? '').trim();
}

export function mongoDatabaseName(): string {
  return (process.env.MONGO_DB ?? '').trim() || DEFAULT_DB;
}

/** URL sin credenciales, para logs y el banner de arranque. */
export function mongoTarget(): string {
  const url = mongoUrl();
  if (!url) return 'off';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return 'configurada';
  }
}

async function connect(): Promise<MongoHandle | null> {
  const url = mongoUrl();
  if (!url) return null;
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 3000 });
  await client.connect();
  const db = client.db(mongoDatabaseName());
  const matches = db.collection(MATCHES_COLLECTION);
  // `at` ordena el historico; `matchId` unico garantiza que dos partidas nunca
  // se confundan aunque se reintente el guardado.
  await matches.createIndex({ at: -1 });
  await matches.createIndex({ matchId: 1 }, { unique: true });
  log.info('conectado', { target: mongoTarget(), db: mongoDatabaseName(), collection: MATCHES_COLLECTION });
  return { client, db };
}

/**
 * Conexion perezosa y compartida. Si falla, se reintenta en la proxima partida
 * en vez de quedar rota para siempre.
 */
function getHandle(): Promise<MongoHandle | null> {
  globalRef.__nimbleMongo ??= connect().catch((error) => {
    log.warn('no se pudo conectar', { target: mongoTarget(), error });
    globalRef.__nimbleMongo = null;
    return null;
  });
  return globalRef.__nimbleMongo;
}

/** Documento ya guardado: la partida mas la fecha, el `_id` y las llamadas a Jev. */
export interface SavedMatch extends MatchDocument {
  id: string;
  /** ISO 8601 del momento en que se guardo. */
  at: string;
  /** Peticion y respuesta crudas de cada turno, en orden. */
  modelCalls: ModelCall[];
}

/** Resumen del historico, sin las series pesadas (muestras, llamadas...). */
export interface MatchSummary {
  id: string;
  at: string;
  matchId: string;
  round: number;
  outcome: MatchDocument['outcome'];
  model: string;
  config: MatchDocument['config'];
  result: MatchDocument['result'];
}

/** Campos que no se traen al listar: `modelCalls` solo pesa de mas. */
const SUMMARY_PROJECTION = { samples: 0, decisions: 0, events: 0, modelCalls: 0 } as const;

/**
 * Guarda una partida completa con sus llamadas crudas a Jev. Devuelve el `_id`
 * o `null` si no se pudo.
 */
export async function saveMatch(record: MatchDocument, modelCalls: ModelCall[]): Promise<string | null> {
  try {
    const handle = await getHandle();
    if (!handle) return null;
    const document = { ...record, modelCalls, at: new Date().toISOString() };
    const result = await handle.db.collection(MATCHES_COLLECTION).insertOne(document);
    log.info('partida guardada', {
      id: result.insertedId.toString(),
      matchId: record.matchId,
      round: record.round,
      outcome: record.outcome,
      clockMs: Math.round(record.result.clockMs),
      samples: record.samples.length,
      decisions: record.decisions.length,
      events: record.events.length,
      modelCalls: modelCalls.length,
    });
    return result.insertedId.toString();
  } catch (error) {
    log.warn('no se pudo guardar la partida', { error });
    return null;
  }
}

/** Ultimas partidas (resumen), la mas reciente primero. Vacio si Mongo no esta. */
export async function listMatches(limit = 50): Promise<MatchSummary[]> {
  try {
    const handle = await getHandle();
    if (!handle) return [];
    const documents = await handle.db
      .collection(MATCHES_COLLECTION)
      .find({}, { projection: SUMMARY_PROJECTION })
      .sort({ at: -1 })
      .limit(limit)
      .toArray();
    return documents.map((document) => {
      const { _id, ...rest } = document;
      return { id: _id.toString(), ...rest } as unknown as MatchSummary;
    });
  } catch (error) {
    log.warn('no se pudo leer el historico', { error });
    return [];
  }
}

/** Una partida completa (con sus llamadas a Jev). `null` si no existe. */
export async function getMatch(matchId: string): Promise<SavedMatch | null> {
  try {
    const handle = await getHandle();
    if (!handle) return null;
    const document = await handle.db.collection(MATCHES_COLLECTION).findOne({ matchId });
    if (!document) return null;
    const { _id, ...rest } = document;
    return { id: _id.toString(), ...rest } as unknown as SavedMatch;
  } catch (error) {
    log.warn('no se pudo leer la partida', { matchId, error });
    return null;
  }
}
