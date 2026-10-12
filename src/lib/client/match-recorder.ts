import type { DecisionResponse, MatchDocument, MatchEventRecord } from '@/lib/ai/contracts';
import { PLAYERS } from '@/lib/game/players';
import type { GameEvent, GameSnapshot, PlayerRecord, UiState } from '@/lib/game/types';

/**
 * Graba una partida entera mientras se juega, para poder guardarla despues.
 *
 * El motor vive en el navegador, asi que el unico que puede reconstruir la
 * partida completa es el cliente: aqui se acumulan tres series que se fechan
 * con el reloj de ronda —
 *
 *  - `samples`: fotos de la mesa (bola + diez corredores) cada ~200 ms;
 *  - `decisions`: que respondio el modelo en cada turno, con sus probabilidades;
 *  - `events`: cada rebote, saque, muerte y el cierre.
 *
 * No inventa nada ni decide que guardar: solo junta. `finish()` arma el
 * documento y el llamador decide si esa partida merece guardarse.
 */

/** Cada cuanto se pide una foto de la mesa. */
export const SAMPLE_MS = 200;

/** Topes alineados con el contrato: mas alla, Mongo recibiria un doc invalido. */
const MAX_SAMPLES = 20_000;
const MAX_DECISIONS = 20_000;
const MAX_EVENTS = 50_000;

/** Lo minimo que el grabador necesita de `engine.view()`. */
export interface RecorderView {
  clockMs: number;
  ball: { x: number; y: number; vx: number; vy: number };
  runners: PlayerRecord<{ x: number; y: number }>;
  alive: PlayerRecord<boolean>;
}

export interface FinishInput {
  round: number;
  outcome: MatchDocument['outcome'];
  model: string;
  intervalMs: number;
  /** Estado final (configuracion y ultima foto con amenazas). */
  snapshot: GameSnapshot;
  /** Contadores de ronda. */
  stats: Pick<UiState, 'decisions' | 'avgLatencyMs' | 'bounces' | 'kills' | 'aliveCount'>;
}

const round = (value: number): number => Math.round(value);
const round3 = (value: number): number => Math.round(value * 1000) / 1000;

export class MatchRecorder {
  private samples: MatchDocument['samples'] = [];
  private decisions: MatchDocument['decisions'] = [];
  private events: MatchDocument['events'] = [];
  private lastClockMs = -1;

  /** Olvida lo acumulado: se llama al cerrar una ronda y al empezar otra. */
  reset(): void {
    this.samples = [];
    this.decisions = [];
    this.events = [];
    this.lastClockMs = -1;
  }

  /**
   * Guarda una foto de la mesa. Si el reloj retrocede es que arranco otra ronda
   * (o se reinicio a mano): se limpia solo, sin que el llamador avise.
   */
  sample(view: RecorderView): void {
    if (view.clockMs < this.lastClockMs) this.reset();
    this.lastClockMs = view.clockMs;
    if (this.samples.length >= MAX_SAMPLES) return;

    const players = {} as PlayerRecord<{ x: number; y: number; alive: boolean }>;
    for (const player of PLAYERS) {
      const runner = view.runners[player];
      players[player] = {
        x: round(runner.x),
        y: round(runner.y),
        alive: view.alive[player],
      };
    }

    this.samples.push({
      clockMs: round(view.clockMs),
      ball: {
        x: round(view.ball.x),
        y: round(view.ball.y),
        vx: round(view.ball.vx),
        vy: round(view.ball.vy),
      },
      players,
    });
  }

  /** Guarda lo que respondio el modelo en un turno. */
  decision(result: DecisionResponse, clockMs: number): void {
    if (this.decisions.length >= MAX_DECISIONS) return;

    const moves: Record<string, string> = {};
    const probabilities: Record<string, Record<string, number>> = {};
    for (const player of PLAYERS) {
      const decision = result.players[player];
      if (!decision) continue;
      moves[player] = decision.move;
      probabilities[player] = Object.fromEntries(
        Object.entries(decision.probabilities).map(([move, value]) => [move, round3(value)]),
      );
    }

    this.decisions.push({
      clockMs: round(clockMs),
      model: result.model,
      latencyMs: round(result.latencyMs),
      moves,
      probabilities,
    });
  }

  /** Guarda un evento del motor. */
  note(event: GameEvent, clockMs: number): void {
    if (this.events.length >= MAX_EVENTS) return;

    const at = round(clockMs);
    let record: MatchEventRecord;
    switch (event.type) {
      case 'wall':
        record = { clockMs: at, type: 'wall', x: round(event.x), y: round(event.y) };
        break;
      case 'kill':
        record = {
          clockMs: at,
          type: 'kill',
          player: event.player,
          x: round(event.x),
          y: round(event.y),
        };
        break;
      case 'death':
        record = { clockMs: at, type: 'death', player: event.player };
        break;
      case 'serve':
        record = { clockMs: at, type: 'serve', toward: event.toward };
        break;
      case 'over':
        record = { clockMs: at, type: 'over', winner: event.winner };
        break;
      default:
        return;
    }
    this.events.push(record);
  }

  /** Arma el documento final. El `matchId` lo pone el navegador. */
  finish(input: FinishInput, matchId: string): MatchDocument {
    const { snapshot, stats } = input;
    const alive = PLAYERS.filter((player) => snapshot.players[player].alive);

    return {
      matchId,
      round: input.round,
      outcome: input.outcome,
      model: input.model,
      config: {
        intervalMs: input.intervalMs,
        ballSpeed: snapshot.ball.speed,
        runnerSpeed: snapshot.runnerSpeed,
        killRadius: snapshot.killRadius,
        dangerRadius: snapshot.dangerRadius,
        survivalMs: snapshot.survivalMs,
      },
      result: {
        clockMs: snapshot.clockMs,
        survivalMs: snapshot.survivalMs,
        reachedMinute: snapshot.clockMs >= snapshot.survivalMs,
        decisions: stats.decisions,
        avgLatencyMs: stats.avgLatencyMs,
        bounces: stats.bounces,
        kills: stats.kills,
        aliveCount: stats.aliveCount,
        alive,
      },
      samples: this.samples,
      decisions: this.decisions,
      events: this.events,
    };
  }
}
