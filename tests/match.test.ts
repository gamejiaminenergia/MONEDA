import { afterEach, describe, expect, it } from 'vitest';

import {
  isCompleteMatch,
  matchDocumentSchema,
  type DecisionResponse,
  type ModelCall,
} from '@/lib/ai/contracts';
import { MatchRecorder } from '@/lib/client/match-recorder';
import { PLAYERS, type Player } from '@/lib/game/players';
import type { GameEvent, GameSnapshot, PlayerRecord } from '@/lib/game/types';
import { clearModelCalls, modelCallMatches, recordModelCall, takeModelCalls } from '@/server/model-calls';
import { matchesConfigured, mongoDatabaseName, mongoTarget } from '@/server/mongo';

const record = <T>(value: (player: Player) => T): PlayerRecord<T> =>
  Object.fromEntries(PLAYERS.map((player) => [player, value(player)])) as PlayerRecord<T>;

const samplePlayers = record(() => ({
  x: 100,
  y: 100,
  alive: true,
  cell: { col: 0, row: 0 },
  cellCount: 1,
}));

const document = () => ({
  matchId: 'abc-123',
  round: 4,
  outcome: 'truce' as const,
  winner: null,
  model: 'jev-latest',
  config: {
    intervalMs: 700,
    ballSpeed: 210,
    runnerSpeed: 300,
    killRadius: 24,
    dangerRadius: 54,
    survivalMs: 60_000,
    grid: { cols: 16, rows: 16, cell: 42, limit: 3, strikes: 5, checkMs: 200 },
  },
  result: {
    clockMs: 60_000,
    survivalMs: 60_000,
    reachedMinute: true,
    decisions: 85,
    avgLatencyMs: 250,
    bounces: 40,
    kills: 3,
    crowdKills: 2,
    aliveCount: 10,
    alive: [...PLAYERS],
  },
  samples: [
    { clockMs: 0, ball: { x: 360, y: 360, vx: 0, vy: 0 }, players: samplePlayers },
  ],
  decisions: [
    {
      clockMs: 700,
      model: 'jev-latest',
      latencyMs: 240,
      moves: { rojo: 'derecha' },
      probabilities: { rojo: { derecha: 0.6 } },
    },
  ],
  events: [
    { clockMs: 0, type: 'wall', x: 24, y: 30 },
    { clockMs: 100, type: 'kill', player: 'rojo', x: 10, y: 10, cause: 'crowd' },
    { clockMs: 60_000, type: 'truce' },
  ],
});

describe('contrato de partida', () => {
  it('acepta una partida completa con su trayectoria', () => {
    expect(matchDocumentSchema.safeParse(document()).success).toBe(true);
  });

  it('exige los diez jugadores en cada muestra', () => {
    const broken = document();
    const { rojo, ...rest } = broken.samples[0]!.players;
    void rojo;
    broken.samples[0]!.players = rest as typeof broken.samples[0]['players'];
    expect(matchDocumentSchema.safeParse(broken).success).toBe(false);
  });

  it('rechaza un desenlace que no existe', () => {
    expect(matchDocumentSchema.safeParse({ ...document(), outcome: 'empate' }).success).toBe(false);
  });

  it('rechaza un ganador que no es un color', () => {
    expect(matchDocumentSchema.safeParse({ ...document(), winner: 'fucsia' }).success).toBe(false);
  });
});

describe('solo partidas completas', () => {
  it('cuenta como completa la tregua (llego al minuto)', () => {
    expect(isCompleteMatch({ outcome: 'truce' })).toBe(true);
  });

  it('no cuenta como completa ni el ganador ni el empate', () => {
    expect(isCompleteMatch({ outcome: 'winner' })).toBe(false);
    expect(isCompleteMatch({ outcome: 'draw' })).toBe(false);
  });
});

describe('grabador de partidas', () => {
  const snapshot = (): GameSnapshot => ({
    ball: { x: 360, y: 360, vx: 10, vy: 0, speed: 10, direction: 'derecha' },
    players: record(() => ({
      x: 40,
      y: 40,
      distance: 100,
      threatMs: null,
      threatX: null,
      threatY: null,
      cell: { col: 0, row: 0 },
      cellCount: 1,
      alive: true,
    })),
    killRadius: 24,
    dangerRadius: 54,
    field: { min: 38, max: 682 },
    ballField: { min: 34, max: 686 },
    grid: { cell: 42, cols: 16, rows: 16, limit: 3, strikes: 5, checkMs: 200 },
    runnerSpeed: 300,
    survivalMs: 60_000,
    clockMs: 60_000,
    paused: false,
    winner: null,
  });

  const view = (clockMs: number) => {
    const counts = new Array<number>(16 * 16).fill(0);
    counts[0] = PLAYERS.length;
    return {
      clockMs,
      ball: { x: 360, y: 360, vx: 10, vy: 0 },
      runners: record(() => ({ x: 40, y: 40 })),
      alive: record(() => true),
      grid: { counts, cols: 16 },
    };
  };

  const decision = (): DecisionResponse => ({
    model: 'jev-latest',
    latencyMs: 200,
    players: {
      rojo: { choice: 'derecha', move: 'derecha', probabilities: { derecha: 0.7, arriba: 0.3 }, confidence: 0.7 },
    },
    usage: { inputTokens: null, outputTokens: null },
  });

  const finish = (recorder: MatchRecorder) =>
    recorder.finish(
      {
        round: 1,
        outcome: 'truce',
        winner: null,
        model: 'jev-latest',
        intervalMs: 700,
        snapshot: snapshot(),
        stats: { decisions: 5, avgLatencyMs: 200, bounces: 3, kills: 1, crowdKills: 0, aliveCount: 10 },
      },
      'match-1',
    );

  it('junta muestras, decisiones y eventos en un documento valido', () => {
    const recorder = new MatchRecorder();
    recorder.sample(view(0));
    recorder.sample(view(200));
    recorder.decision(decision(), 200);
    const event: GameEvent = { type: 'kill', player: 'rojo', x: 12, y: 14, cause: 'crowd' };
    recorder.note(event, 300);

    const doc = finish(recorder);
    expect(doc.samples).toHaveLength(2);
    expect(doc.decisions).toHaveLength(1);
    expect(doc.events).toHaveLength(1);
    expect(doc.samples[0]?.players.rojo.cellCount).toBe(PLAYERS.length);
    expect(doc.decisions[0]?.moves.rojo).toBe('derecha');
    expect(doc.config.survivalMs).toBe(60_000);
    expect(doc.result.survivalMs).toBe(60_000);
    expect(doc.result.reachedMinute).toBe(true);
    expect(doc.result.alive).toHaveLength(PLAYERS.length);
    expect(matchDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it('empieza de cero cuando el reloj retrocede (ronda nueva)', () => {
    const recorder = new MatchRecorder();
    recorder.sample(view(5000));
    recorder.note({ type: 'wall', x: 1, y: 2 }, 5000);
    // El motor reinicia a reloj cero: el grabador se limpia solo.
    recorder.sample(view(0));
    const doc = finish(recorder);
    expect(doc.samples).toHaveLength(1);
    expect(doc.events).toHaveLength(0);
  });
});

describe('archivo de llamadas a Jev', () => {
  afterEach(() => clearModelCalls());

  const call = (clockMs: number): ModelCall => ({
    clockMs,
    model: 'jev-latest',
    request: { model: 'jev-latest', state: 'Mesa cuadrada...', questions: { rojo: { type: 'choice' } } },
    response: { answers: { rojo: { choice: 'derecha' } } },
    usage: { inputTokens: 4800, outputTokens: 900 },
    latencyMs: 240,
    status: 'ok',
    errorCode: null,
  });

  it('guarda y saca las llamadas de una partida', () => {
    recordModelCall('m1', call(700));
    recordModelCall('m1', call(1400));
    expect(modelCallMatches()).toBe(1);
    const taken = takeModelCalls('m1');
    expect(taken).toHaveLength(2);
    expect(taken[0]?.request.state).toBe('Mesa cuadrada...');
    // Se tomo: la partida ya no esta en la ventana.
    expect(takeModelCalls('m1')).toHaveLength(0);
    expect(modelCallMatches()).toBe(0);
  });

  it('desaloja la partida mas vieja cuando se llena la ventana', () => {
    for (let i = 0; i < 10; i++) recordModelCall(`m${i}`, call(i));
    expect(modelCallMatches()).toBe(8);
    expect(takeModelCalls('m0')).toHaveLength(0);
    expect(takeModelCalls('m9')).toHaveLength(1);
  });
});

describe('configuracion de Mongo', () => {
  const previousUrl = process.env.MONGO_URL;
  const previousDb = process.env.MONGO_DB;

  afterEach(() => {
    if (previousUrl === undefined) delete process.env.MONGO_URL;
    else process.env.MONGO_URL = previousUrl;
    if (previousDb === undefined) delete process.env.MONGO_DB;
    else process.env.MONGO_DB = previousDb;
  });

  it('queda apagada sin MONGO_URL, y el juego no la necesita', () => {
    delete process.env.MONGO_URL;
    expect(matchesConfigured()).toBe(false);
    expect(mongoTarget()).toBe('off');
  });

  it('no filtra las credenciales en el destino que va al log', () => {
    process.env.MONGO_URL = 'mongodb://jev:secreto@localhost:27017/nimble?authSource=admin';
    expect(matchesConfigured()).toBe(true);
    expect(mongoTarget()).toBe('mongodb://localhost:27017/nimble');
    expect(mongoTarget()).not.toContain('secreto');
  });

  it('usa la base `nimble` por defecto y respeta MONGO_DB', () => {
    delete process.env.MONGO_DB;
    expect(mongoDatabaseName()).toBe('nimble');
    process.env.MONGO_DB = 'otra';
    expect(mongoDatabaseName()).toBe('otra');
  });
});
