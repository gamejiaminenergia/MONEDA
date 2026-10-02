import {
  BALL_SPEED,
  CENTER,
  DEFAULT_LIVES,
  PADDLE_MAX_POS,
  PADDLE_MIN_POS,
  PADDLE_PARK_EPSILON,
  PADDLE_SPEED,
  SERVE_PAUSE_MS,
  SPAWN_SPREAD,
  W,
} from './constants';
import { MOVE_DIR } from './moves';
import { bounceOff, clamp } from './physics';
import { SIDES, SIDE_AXIS, type Side } from './sides';
import type {
  BallState,
  DecisionSource,
  GameEvent,
  GameSnapshot,
  Move,
  PaddlePair,
  SideDecision,
  SideRecord,
  SideUiState,
  UiState,
} from './types';
import { PongWorld, type PaddleContact } from './world';

export interface EngineOptions {
  /** Vidas por equipo. Al perder la ultima, el equipo muere. */
  lives?: number;
  /** El paddle mas cercano a la llegada se detiene ahi en vez de pasarse. */
  parkNearest?: boolean;
  servePauseMs?: number;
  ballSpeed?: number;
  paddleSpeed?: number;
  /** Inyectable para tests deterministas. */
  random?: () => number;
}

interface ResolvedOptions {
  lives: number;
  parkNearest: boolean;
  servePauseMs: number;
  ballSpeed: number;
  paddleSpeed: number;
  random: () => number;
}

const emptySides = <T>(value: (side: Side) => T): SideRecord<T> =>
  Object.fromEntries(SIDES.map((side) => [side, value(side)] as const)) as SideRecord<T>;

/**
 * Reglas del juego de cuatro equipos. La fisica vive en `PongWorld`; aqui
 * estan las vidas, la muerte de un equipo, el saque y las decisiones.
 */
export class GameEngine {
  private readonly options: ResolvedOptions;
  /** Toda la fisica vive aqui: integracion, choques y prediccion. */
  private world = new PongWorld();
  private listeners = new Set<() => void>();

  private ball: BallState = { x: W / 2, y: CENTER, vx: 0, vy: 0 };
  private paddles: SideRecord<PaddlePair> = emptySides(() => [
    { pos: CENTER - SPAWN_SPREAD, dir: 0 },
    { pos: CENTER + SPAWN_SPREAD, dir: 0 },
  ]);
  private lastDecision: SideRecord<SideDecision | null> = emptySides(() => null);

  private lives: SideRecord<number> = emptySides(() => DEFAULT_LIVES);
  private alive: SideRecord<boolean> = emptySides(() => true);

  private serveToward: Side = 'left';
  private serveDelayMs = 0;
  private lastScoredAt = -Infinity;
  private clockMs = 0;

  private rally = 0;
  private maxRally = 0;
  private points = 0;
  private decisions = 0;
  private latencySumMs = 0;
  private lastLatencyMs: number | null = null;
  private lastSource: DecisionSource | null = null;

  private paused = false;
  private thinking = false;
  private winner: Side | null = null;

  private version = 0;
  private cachedUi: UiState | null = null;
  private cachedUiVersion = -1;

  constructor(options: EngineOptions = {}) {
    this.options = {
      lives: options.lives ?? DEFAULT_LIVES,
      parkNearest: options.parkNearest ?? true,
      servePauseMs: options.servePauseMs ?? SERVE_PAUSE_MS,
      ballSpeed: options.ballSpeed ?? BALL_SPEED,
      paddleSpeed: options.paddleSpeed ?? PADDLE_SPEED,
      random: options.random ?? Math.random,
    };
    this.lives = emptySides(() => this.options.lives);
    this.pushPaddles();
    this.serve(this.pickServeTarget());
  }

  /* ------------------------------ suscripcion ----------------------------- */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private touch(): void {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }

  /* --------------------------------- control ------------------------------ */

  get startingLives(): number {
    return this.options.lives;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get finished(): boolean {
    return this.winner !== null;
  }

  isAlive(side: Side): boolean {
    return this.alive[side];
  }

  aliveSides(): Side[] {
    return SIDES.filter((side) => this.alive[side]);
  }

  setPaused(paused: boolean): void {
    if (this.winner) return;
    if (this.paused === paused) return;
    this.paused = paused;
    this.touch();
  }

  togglePause(): void {
    this.setPaused(!this.paused);
  }

  setThinking(thinking: boolean): void {
    if (this.thinking === thinking) return;
    this.thinking = thinking;
    this.touch();
  }

  reset(overrides: { lives?: number } = {}): void {
    if (overrides.lives !== undefined) this.options.lives = overrides.lives;

    // Un mundo nuevo: los equipos muertos de la partida anterior dejaron
    // paddles destruidos y paredes selladas.
    this.world = new PongWorld();

    this.lives = emptySides(() => this.options.lives);
    this.alive = emptySides(() => true);
    this.rally = 0;
    this.maxRally = 0;
    this.points = 0;
    this.decisions = 0;
    this.latencySumMs = 0;
    this.lastLatencyMs = null;
    this.lastSource = null;
    this.winner = null;
    this.paused = false;
    this.thinking = false;
    this.clockMs = 0;
    this.lastScoredAt = -Infinity;
    this.lastDecision = emptySides(() => null);
    this.paddles = emptySides(() => [
      { pos: CENTER - SPAWN_SPREAD, dir: 0 },
      { pos: CENTER + SPAWN_SPREAD, dir: 0 },
    ]);

    this.pushPaddles();
    this.serve(this.pickServeTarget());
    this.touch();
  }

  /* --------------------------------- saque -------------------------------- */

  private pickServeTarget(): Side {
    const candidates = this.aliveSides();
    if (candidates.length === 0) return 'left';
    const index = Math.min(
      candidates.length - 1,
      Math.floor(this.options.random() * candidates.length),
    );
    return candidates[index] ?? 'left';
  }

  /** Saca hacia el equipo indicado, con un desvio lateral aleatorio. */
  private serve(toward: Side): void {
    const speed = this.options.ballSpeed;
    const lateral = (this.options.random() * 2 - 1) * speed * 0.45;
    const velocity: Record<Side, { vx: number; vy: number }> = {
      left: { vx: -speed, vy: lateral },
      right: { vx: speed, vy: lateral },
      top: { vx: lateral, vy: -speed },
      bottom: { vx: lateral, vy: speed },
    };
    this.ball = { x: W / 2, y: CENTER, ...velocity[toward] };
    this.world.setBall(this.ball);
    this.serveToward = toward;
    this.serveDelayMs = this.options.servePauseMs;
  }

  /** Copia la posicion de los paddles al mundo fisico. */
  private pushPaddles(): void {
    for (const side of SIDES) {
      this.world.setPaddle(side, 0, this.paddles[side][0].pos);
      this.world.setPaddle(side, 1, this.paddles[side][1].pos);
    }
  }

  /** Un equipo perdio una vida; si era la ultima, muere y su pared se sella. */
  private loseLife(side: Side, events: GameEvent[]): void {
    if (this.clockMs - this.lastScoredAt < 400) return;
    this.lastScoredAt = this.clockMs;
    this.points += 1;
    this.rally = 0;
    this.lives[side] = Math.max(0, this.lives[side] - 1);
    events.push({
      type: 'life-lost',
      side,
      lives: this.lives[side],
      lost: this.options.lives - this.lives[side],
    });

    if (this.lives[side] === 0) {
      this.alive[side] = false;
      this.lastDecision[side] = null;
      this.paddles[side][0].dir = 0;
      this.paddles[side][1].dir = 0;
      this.world.killTeam(side);
      events.push({ type: 'death', side });
    }

    const remaining = this.aliveSides();
    if (remaining.length > 0) this.serve(this.pickServeTarget());

    if (remaining.length <= 1) {
      this.winner = remaining[0] ?? null;
      if (this.winner) events.push({ type: 'game-over', winner: this.winner });
    }
  }

  /* -------------------------------- avance -------------------------------- */

  /**
   * Avanza la simulacion `dtMs` milisegundos.
   * Devuelve los eventos para que el renderer y el audio reaccionen.
   */
  step(dtMs: number): GameEvent[] {
    const events: GameEvent[] = [];
    if (this.paused || this.winner) return events;

    const dt = Math.min(dtMs, 50) / 1000;
    this.clockMs += dtMs;

    for (const side of SIDES) {
      if (this.alive[side]) this.moveSide(side, dt);
    }

    if (this.serveDelayMs > 0) {
      this.serveDelayMs = Math.max(0, this.serveDelayMs - dtMs);
      if (this.serveDelayMs === 0) {
        events.push({ type: 'serve', toward: this.serveToward });
        this.touch();
      }
      return events;
    }

    // La fisica corre con paso fijo y devuelve lo que choco en este tramo.
    const { contacts, walls, miss } = this.world.step(dtMs);
    this.ball = this.world.ball();

    for (const wall of walls) {
      events.push({ type: 'wall', x: wall.x, y: wall.y });
    }

    // Los dos paddles de un equipo pueden taparse entre si y Box2D reporta los
    // dos choques: para el juego es un solo golpe, el del paddle mas cercano.
    const hits = new Map<Side, PaddleContact>();
    for (const contact of contacts) {
      const previous = hits.get(contact.side);
      if (!previous) {
        hits.set(contact.side, contact);
        continue;
      }
      const distanceTo = (candidate: PaddleContact): number =>
        Math.abs(this.paddles[candidate.side][candidate.index].pos - candidate.ballY);
      if (distanceTo(contact) < distanceTo(previous)) hits.set(contact.side, contact);
    }

    for (const contact of hits.values()) {
      if (!this.alive[contact.side]) continue;
      const paddle = this.paddles[contact.side][contact.index];
      const target = { ...this.ball };
      if (SIDE_AXIS[contact.side] === 'y') target.y = contact.ballY;
      else target.x = contact.ballX;

      const { vx, vy } = bounceOff(paddle.pos, target, contact.side);
      this.world.setBallVelocity(vx, vy);
      this.rally += 1;
      this.maxRally = Math.max(this.maxRally, this.rally);
      events.push({
        type: 'paddle-hit',
        side: contact.side,
        x: contact.ballX,
        y: contact.ballY,
        rally: this.rally,
      });
    }

    if (hits.size > 0) this.ball = this.world.ball();
    if (miss) this.loseLife(miss, events);

    if (events.length > 0) this.touch();
    return events;
  }

  /**
   * Mueve un equipo. El paddle mas cercano al punto de llegada se detiene ahi
   * para no pasarse; su companero simplemente sigue su jugada.
   */
  private moveSide(side: Side, dt: number): void {
    const pair = this.paddles[side];
    const arrival = this.world.predictArrival(side);
    const nearest: 0 | 1 = Math.abs(pair[1].pos - arrival) < Math.abs(pair[0].pos - arrival) ? 1 : 0;

    for (const index of [0, 1] as const) {
      const paddle = pair[index];
      const parking =
        this.options.parkNearest &&
        index === nearest &&
        Math.abs(paddle.pos - arrival) < PADDLE_PARK_EPSILON;
      const dir = parking ? 0 : paddle.dir;
      if (dir === 0) continue;
      paddle.pos = clamp(paddle.pos + dir * this.options.paddleSpeed * dt, PADDLE_MIN_POS, PADDLE_MAX_POS);
      this.world.setPaddle(side, index, paddle.pos);
    }
  }

  /* ------------------------------- decisiones ----------------------------- */

  applyDecision(side: Side, decision: SideDecision): void {
    if (!this.alive[side]) return;
    const pair = this.paddles[side];
    pair[0].dir = MOVE_DIR[decision.moves[0]];
    pair[1].dir = MOVE_DIR[decision.moves[1]];
    this.lastDecision[side] = decision;
    this.touch();
  }

  /** Registra la latencia de una respuesta para las estadisticas. */
  recordLatency(latencyMs: number, source: DecisionSource): void {
    this.decisions += 1;
    this.latencySumMs += latencyMs;
    this.lastLatencyMs = Math.round(latencyMs);
    this.lastSource = source;
    this.touch();
  }

  /* ---------------------------------- vistas ------------------------------ */

  snapshot(): GameSnapshot {
    const sides = emptySides((side) => ({
      arrival: Math.round(this.world.predictArrival(side)),
      paddles: [
        { pos: Math.round(this.paddles[side][0].pos) },
        { pos: Math.round(this.paddles[side][1].pos) },
      ] as [{ pos: number }, { pos: number }],
      lives: this.lives[side],
      alive: this.alive[side],
    }));

    return {
      ball: {
        x: Math.round(this.ball.x),
        y: Math.round(this.ball.y),
        vx: Math.round(this.ball.vx),
        vy: Math.round(this.ball.vy),
        verticalDirection: this.ball.vy > 0 ? 'baja' : this.ball.vy < 0 ? 'sube' : 'recta',
        horizontalDirection: this.ball.vx > 0 ? 'right' : 'left',
      },
      sides,
      startingLives: this.options.lives,
      rally: this.rally,
      paused: this.paused,
      winner: this.winner,
    };
  }

  /** Vista liviana para el renderer. */
  view(): {
    ball: BallState;
    paddles: SideRecord<PaddlePair>;
    alive: SideRecord<boolean>;
    serveDelayMs: number;
    winner: Side | null;
    paused: boolean;
  } {
    return {
      ball: this.ball,
      paddles: this.paddles,
      alive: this.alive,
      serveDelayMs: this.serveDelayMs,
      winner: this.winner,
      paused: this.paused,
    };
  }

  ui(): UiState {
    if (this.cachedUi && this.cachedUiVersion === this.version) return this.cachedUi;

    const sideUi = (side: Side): SideUiState => {
      const decision = this.lastDecision[side];
      const moves: [Move, Move] = decision?.moves ?? ['quedarse', 'quedarse'];
      return {
        paddles: [
          {
            pos: this.paddles[side][0].pos,
            move: decision ? moves[0] : null,
            probability: decision?.marginals[0][moves[0]] ?? 0,
          },
          {
            pos: this.paddles[side][1].pos,
            move: decision ? moves[1] : null,
            probability: decision?.marginals[1][moves[1]] ?? 0,
          },
        ],
        choice: decision?.choice ?? null,
        confidence: decision?.confidence ?? 0,
        source: decision?.source ?? null,
        lives: this.lives[side],
        lost: this.options.lives - this.lives[side],
        alive: this.alive[side],
      };
    };

    this.cachedUi = {
      version: this.version,
      sides: emptySides(sideUi),
      startingLives: this.options.lives,
      winner: this.winner,
      paused: this.paused,
      thinking: this.thinking,
      rally: this.rally,
      maxRally: this.maxRally,
      points: this.points,
      aliveCount: this.aliveSides().length,
      decisions: this.decisions,
      avgLatencyMs: this.decisions ? Math.round(this.latencySumMs / this.decisions) : null,
      lastLatencyMs: this.lastLatencyMs,
      lastSource: this.lastSource,
    };
    this.cachedUiVersion = this.version;
    return this.cachedUi;
  }

  /* ------------------------------- utilidades ----------------------------- */

  /** Desplaza un paddle a mano. Util para el modo manual y los tests. */
  movePaddle(side: Side, index: 0 | 1, pos: number): void {
    this.paddles[side][index].pos = clamp(pos, PADDLE_MIN_POS, PADDLE_MAX_POS);
    this.world.setPaddle(side, index, this.paddles[side][index].pos);
    this.touch();
  }

  /** Fuerza un saque. Util en tests. */
  forceServe(toward: Side): void {
    this.serve(toward);
    this.touch();
  }

  /** Avanza sin esperar el saque. Util en tests. */
  skipServeDelay(): void {
    this.serveDelayMs = 0;
  }
}
