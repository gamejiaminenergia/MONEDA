import {
  BALL_R,
  BALL_SPEED,
  BOUNCE_SKEW_MAX,
  BOUNCE_SKEW_MIN,
  DANGER_R,
  KILL_R,
  MAX_BALL_SPEED,
  MIN_BALL_SPEED,
  PAD,
  RUNNER_R,
  RUNNER_SPEED,
  SERVE_PAUSE_MS,
  W,
} from './constants';
import { MOVE_VEC, compassOf, type Move } from './moves';
import { clampPlay, distance, predictThreat, segmentHitsCircle } from './physics';
import { PLAYERS, PLAYER_SPAWN, type Player } from './players';
import type {
  BallState,
  GameEvent,
  GameSnapshot,
  Point,
  RunnerState,
  PlayerDecision,
  PlayerRecord,
  PlayerSnapshot,
  PlayerUiState,
  UiState,
} from './types';
import { ArenaWorld } from './world';

export interface EngineOptions {
  servePauseMs?: number;
  ballSpeed?: number;
  /** Desvio maximo del rumbo en cada rebote, en radianes. */
  bounceSkew?: number;
  runnerSpeed?: number;
  /** Inyectable para tests deterministas. */
  random?: () => number;
}

interface ResolvedOptions {
  servePauseMs: number;
  ballSpeed: number;
  bounceSkew: number;
  runnerSpeed: number;
  random: () => number;
}

interface ThreatView {
  ms: number | null;
  point: Point | null;
}

const emptyPlayers = <T>(value: (player: Player) => T): PlayerRecord<T> =>
  Object.fromEntries(PLAYERS.map((player) => [player, value(player)] as const)) as PlayerRecord<T>;

/**
 * Reglas del juego: diez jugadores con nombre de color, una bola que rebota
 * para siempre y un unico final — el ultimo jugador vivo. No hay vidas ni
 * segundo intento: un roce basta.
 *
 * La fisica de la bola vive en `ArenaWorld`; aqui estan los jugadores, el roce
 * mortal y el saque. La velocidad de la bola no cambia durante la ronda: si la
 * ronda se eterniza, lo que cambia es la mesa, que se cierra.
 */
export class GameEngine {
  private readonly options: ResolvedOptions;
  private world = new ArenaWorld();
  private listeners = new Set<() => void>();

  private ball: BallState = { x: 360, y: 360, vx: 0, vy: 0 };
  private ballSpeed: number;
  private runners: PlayerRecord<RunnerState> = emptyPlayers(
    (player) => ({ ...PLAYER_SPAWN[player], move: 'quedarse' }),
  );
  private alive: PlayerRecord<boolean> = emptyPlayers(() => true);
  private lastDecision: PlayerRecord<PlayerDecision | null> = emptyPlayers(() => null);

  private serveToward: Player = PLAYERS[0];
  private serveDelayMs = 0;
  private clockMs = 0;

  private bounces = 0;
  private kills = 0;
  private decisions = 0;
  private latencySumMs = 0;
  private lastLatencyMs: number | null = null;

  private paused = false;
  private thinking = false;
  private winner: Player | null = null;

  private version = 0;
  private cachedUi: UiState | null = null;
  private cachedUiVersion = -1;

  constructor(options: EngineOptions = {}) {
    this.options = {
      servePauseMs: options.servePauseMs ?? SERVE_PAUSE_MS,
      ballSpeed: options.ballSpeed ?? BALL_SPEED,
      bounceSkew: options.bounceSkew ?? BOUNCE_SKEW_MAX,
      runnerSpeed: options.runnerSpeed ?? RUNNER_SPEED,
      random: options.random ?? Math.random,
    };
    this.ballSpeed = this.options.ballSpeed;
    this.serve();
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

  get isPaused(): boolean {
    return this.paused;
  }

  get finished(): boolean {
    return this.winner !== null;
  }

  /** Limites del CENTRO de un jugador. El marco nunca se mueve. */
  private get runnerBounds(): { min: number; max: number } {
    return { min: PAD + RUNNER_R, max: W - PAD - RUNNER_R };
  }

  /** Limites del CENTRO de la bola. */
  private get ballBounds(): { min: number; max: number } {
    return { min: PAD + BALL_R, max: W - PAD - BALL_R };
  }

  isAlive(player: Player): boolean {
    return this.alive[player];
  }

  alivePlayers(): Player[] {
    return PLAYERS.filter((player) => this.alive[player]);
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

  /**
   * Cambia la velocidad de la bola en vivo, en px/s.
   *
   * Reescala el vector que la bola lleva ahora mismo —para que el cambio se
   * note en el acto, sin cambiar de direccion— y la deja como velocidad de los
   * proximos saques. Sigue siendo determinista: es una orden del jugador, no
   * azar, y los rebotes solo cambian el angulo.
   */
  setBallSpeed(px: number): void {
    const speed = Math.max(MIN_BALL_SPEED, Math.min(MAX_BALL_SPEED, px));
    if (speed === this.ballSpeed) return;

    this.options.ballSpeed = speed;
    this.ballSpeed = speed;

    const current = Math.hypot(this.ball.vx, this.ball.vy);
    if (current > 0) {
      const scale = speed / current;
      this.ball = { ...this.ball, vx: this.ball.vx * scale, vy: this.ball.vy * scale };
      this.world.setBallVelocity(this.ball.vx, this.ball.vy);
    }
    this.touch();
  }

  reset(): void {
    this.world = new ArenaWorld();
    this.ballSpeed = this.options.ballSpeed;
    this.alive = emptyPlayers(() => true);
    this.bounces = 0;
    this.kills = 0;
    this.decisions = 0;
    this.latencySumMs = 0;
    this.lastLatencyMs = null;
    this.winner = null;
    this.paused = false;
    this.thinking = false;
    this.clockMs = 0;
    this.lastDecision = emptyPlayers(() => null);
    this.runners = emptyPlayers((player) => ({ ...PLAYER_SPAWN[player], move: 'quedarse' as Move }));
    this.serve();
    this.touch();
  }

  /* --------------------------------- saque -------------------------------- */

  /** Saca desde el centro en una direccion aleatoria. */
  private serve(): void {
    const angle = this.options.random() * Math.PI * 2;
    this.ball = {
      x: 360,
      y: 360,
      vx: Math.cos(angle) * this.ballSpeed,
      vy: Math.sin(angle) * this.ballSpeed,
    };
    this.world.setBall(this.ball);
    this.serveToward = this.serveTowardFor(this.ball);
    this.serveDelayMs = this.options.servePauseMs;
  }

  /**
   * Jugador mas alineado con la direccion de salida. Solo da contexto al
   * evento de saque; la fisica no depende de esto.
   */
  private serveTowardFor(ball: BallState): Player {
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed === 0) return PLAYERS[0];
    const ux = ball.vx / speed;
    const uy = ball.vy / speed;
    let best: Player = PLAYERS[0];
    let bestProjection = Number.NEGATIVE_INFINITY;
    for (const player of PLAYERS) {
      const spawn = PLAYER_SPAWN[player];
      const projection = (spawn.x - 360) * ux + (spawn.y - 360) * uy;
      if (projection > bestProjection) {
        bestProjection = projection;
        best = player;
      }
    }
    return best;
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

    for (const player of PLAYERS) {
      if (this.alive[player]) this.moveRunner(player, dt);
    }

    if (this.serveDelayMs > 0) {
      this.serveDelayMs = Math.max(0, this.serveDelayMs - dtMs);
      if (this.serveDelayMs === 0) {
        events.push({ type: 'serve', toward: this.serveToward });
        this.touch();
      }
      return events;
    }

    const { walls, sweep } = this.world.step(dtMs);
    this.ball = this.world.ball();

    for (const wall of walls) {
      this.bounces += 1;
      this.skewBall();
      events.push({ type: 'wall', x: wall.x, y: wall.y });
    }

    if (sweep) {
      for (const player of this.alivePlayers()) {
        const runner = this.runners[player];
        if (!segmentHitsCircle(sweep.from, sweep.to, runner, KILL_R)) continue;
        this.kill(player, events);
        if (this.winner) break;
      }
    }

    if (events.length > 0) this.touch();
    return events;
  }

  /**
   * La bola tuerce un poco al rebotar. Sin este desvio la bola recorreria
   * siempre las mismas cuatro rectas de la mesa y habria zonas donde no puede
   * aparecer nunca: los corredores se refugiarian ahi y la partida no acabaria.
   */
  private skewBall(): void {
    const speed = Math.hypot(this.ball.vx, this.ball.vy);
    if (speed === 0) return;
    const skew = BOUNCE_SKEW_MIN + this.options.random() * (this.options.bounceSkew - BOUNCE_SKEW_MIN);
    const angle = Math.atan2(this.ball.vy, this.ball.vx) + (this.options.random() < 0.5 ? -skew : skew);
    this.ball = { ...this.ball, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
    this.world.setBallVelocity(this.ball.vx, this.ball.vy);
  }

  private moveRunner(player: Player, dt: number): void {
    const runner = this.runners[player];
    const vector = MOVE_VEC[runner.move];
    if (vector.x === 0 && vector.y === 0) return;
    const step = this.options.runnerSpeed * dt;
    const { min, max } = this.runnerBounds;
    runner.x = clampPlay(runner.x + vector.x * step, min, max);
    runner.y = clampPlay(runner.y + vector.y * step, min, max);
  }

  /** La bola toco a un corredor: muere sin segunda oportunidad. */
  private kill(player: Player, events: GameEvent[]): void {
    const runner = this.runners[player];
    this.alive[player] = false;
    this.lastDecision[player] = null;
    this.kills += 1;
    events.push({ type: 'kill', player, x: runner.x, y: runner.y });
    events.push({ type: 'death', player });

    // Una muerte no toca la velocidad ni la mesa: la bola es igual de rapida
    // para todos los que quedan y el marco no se mueve nunca. Cada saque se
    // juega con las mismas reglas y el que sobrevive lo hace por decision.
    const remaining = this.alivePlayers();
    if (remaining.length > 1) {
      this.serve();
    } else {
      this.winner = remaining[0] ?? null;
      if (this.winner) events.push({ type: 'game-over', winner: this.winner });
    }
  }

  /* ------------------------------- decisiones ----------------------------- */

  applyDecision(player: Player, decision: PlayerDecision): void {
    if (!this.alive[player]) return;
    this.runners[player].move = decision.move;
    this.lastDecision[player] = decision;
    this.touch();
  }

  /** Registra la latencia de una respuesta para las estadisticas. */
  recordLatency(latencyMs: number): void {
    this.decisions += 1;
    this.latencySumMs += latencyMs;
    this.lastLatencyMs = Math.round(latencyMs);
    this.touch();
  }

  /* ---------------------------------- vistas ------------------------------ */

  /** Amenaza de cada corredor: cuando y donde le llega la bola. */
  private threats(): PlayerRecord<ThreatView> {
    const { min, max } = this.ballBounds;
    return emptyPlayers((player) => {
      const runner = this.runners[player];
      const threat = predictThreat(this.ball, runner, DANGER_R, 3000, min, max);
      return threat ? { ms: Math.round(threat.ms), point: threat.point } : { ms: null, point: null };
    });
  }

  snapshot(): GameSnapshot {
    const threats = this.threats();
    const players = emptyPlayers<PlayerSnapshot>((player) => {
      const runner = this.runners[player];
      const threat = threats[player];
      return {
        x: Math.round(runner.x),
        y: Math.round(runner.y),
        distance: Math.round(distance(this.ball, runner)),
        threatMs: threat.ms,
        threatX: threat.point ? Math.round(threat.point.x) : null,
        threatY: threat.point ? Math.round(threat.point.y) : null,
        alive: this.alive[player],
      };
    });

    const field = this.runnerBounds;
    const ballField = this.ballBounds;
    return {
      ball: {
        x: Math.round(this.ball.x),
        y: Math.round(this.ball.y),
        vx: Math.round(this.ball.vx),
        vy: Math.round(this.ball.vy),
        speed: Math.round(this.ballSpeed),
        direction: compassOf(this.ball.vx, this.ball.vy),
      },
      players,
      killRadius: KILL_R,
      dangerRadius: DANGER_R,
      field,
      ballField,
      runnerSpeed: this.options.runnerSpeed,
      clockMs: Math.round(this.clockMs),
      paused: this.paused,
      winner: this.winner,
    };
  }

  /** Vista liviana para el renderer. */
  view(): {
    ball: BallState;
    runners: PlayerRecord<RunnerState>;
    alive: PlayerRecord<boolean>;
    serveDelayMs: number;
    pad: number;
    winner: Player | null;
    paused: boolean;
  } {
    return {
      ball: this.ball,
      runners: this.runners,
      alive: this.alive,
      serveDelayMs: this.serveDelayMs,
      pad: PAD,
      winner: this.winner,
      paused: this.paused,
    };
  }

  ui(): UiState {
    if (this.cachedUi && this.cachedUiVersion === this.version) return this.cachedUi;

    const threats = this.threats();
    const players = emptyPlayers<PlayerUiState>((player) => {
      const decision = this.lastDecision[player];
      const runner = this.runners[player];
      return {
        x: runner.x,
        y: runner.y,
        move: decision?.move ?? null,
        probability: decision ? (decision.probabilities[decision.move] ?? decision.confidence) : 0,
        confidence: decision?.confidence ?? 0,
        threatMs: this.alive[player] ? threats[player].ms : null,
        alive: this.alive[player],
      };
    });

    this.cachedUi = {
      version: this.version,
      players,
      winner: this.winner,
      paused: this.paused,
      thinking: this.thinking,
      aliveCount: this.alivePlayers().length,
      decisions: this.decisions,
      avgLatencyMs: this.decisions ? Math.round(this.latencySumMs / this.decisions) : null,
      lastLatencyMs: this.lastLatencyMs,
      bounces: this.bounces,
      kills: this.kills,
      clockMs: Math.round(this.clockMs),
      ballSpeed: Math.round(this.ballSpeed),
    };
    this.cachedUiVersion = this.version;
    return this.cachedUi;
  }

  /* ------------------------------- utilidades ----------------------------- */

  /** Desplaza un corredor a mano. Util para tests. */
  moveRunnerTo(player: Player, point: Point): void {
    const runner = this.runners[player];
    runner.x = clampPlay(point.x);
    runner.y = clampPlay(point.y);
    this.touch();
  }

  /** Fuerza un saque. Util en tests. */
  forceServe(angle: number, speed = this.ballSpeed): void {
    this.ballSpeed = speed;
    this.ball = {
      x: 360,
      y: 360,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    };
    this.world.setBall(this.ball);
    this.serveToward = this.serveTowardFor(this.ball);
    this.serveDelayMs = 0;
    this.touch();
  }

  /** Avanza sin esperar el saque. Util en tests. */
  skipServeDelay(): void {
    this.serveDelayMs = 0;
  }
}
