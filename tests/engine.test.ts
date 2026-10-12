import { beforeEach, describe, expect, it } from 'vitest';

import {
  BALL_MAX,
  BALL_MIN,
  BALL_SPEED,
  BOUNCE_SKEW_MAX,
  BOUNCE_SKEW_MIN,
  DANGER_R,
  KILL_R,
  MAX_BALL_SPEED,
  MIN_BALL_SPEED,
  PLAY_MAX,
  PLAY_MIN,
} from '@/lib/game/constants';
import { GameEngine } from '@/lib/game/engine';
import { PLAYERS, PLAYER_SPAWN, type Player } from '@/lib/game/players';
import type { GameEvent, Move, PlayerDecision } from '@/lib/game/types';

const VICTIM: Player = 'rojo';
/** Esquina libre donde se aparcan los jugadores que no participan del caso. */
const PARK = { x: 40, y: 680 };
const CENTER = { x: 360, y: 360 };

const decision = (move: Move): PlayerDecision => ({
  choice: move,
  move,
  probabilities: { [move]: 1 },
  confidence: 1,
});

function runUntil(
  engine: GameEngine,
  predicate: (events: GameEvent[]) => boolean,
  maxSteps = 4000,
): GameEvent[] {
  const collected: GameEvent[] = [];
  for (let step = 0; step < maxSteps; step++) {
    const events = engine.step(16);
    collected.push(...events);
    if (predicate(collected)) break;
  }
  return collected;
}

/** Deja solo a `keep` en juego; al resto lo manda a una esquina. */
function parkOthers(engine: GameEngine, keep: Player): void {
  for (const player of PLAYERS) {
    if (player === keep || !engine.isAlive(player)) continue;
    engine.moveRunnerTo(player, PARK);
  }
}

describe('GameEngine (diez jugadores)', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine({
      random: () => 0.25,
      servePauseMs: 0,
      survivalMs: Number.POSITIVE_INFINITY,
    });
  });

  it('arranca con los diez jugadores vivos y fuera de la zona de la bola', () => {
    const ui = engine.ui();
    expect(ui.aliveCount).toBe(PLAYERS.length);
    expect(ui.ballSpeed).toBe(BALL_SPEED);
    for (const player of PLAYERS) {
      expect(ui.players[player].alive).toBe(true);
      expect(ui.players[player].move).toBeNull();
      const spawn = PLAYER_SPAWN[player];
      expect(Math.hypot(spawn.x - CENTER.x, spawn.y - CENTER.y)).toBeGreaterThan(KILL_R);
    }
  });

  it('no avanza cuando esta en pausa', () => {
    engine.setPaused(true);
    const before = engine.view().ball.x;
    expect(engine.step(16)).toEqual([]);
    expect(engine.view().ball.x).toBe(before);
  });

  it('un jugador quieto no se sale de la mesa', () => {
    for (const player of PLAYERS) {
      engine.applyDecision(player, decision('arriba-izquierda'));
      engine.step(16);
    }
    for (const player of PLAYERS) {
      const runner = engine.view().runners[player];
      expect(runner.x).toBeGreaterThanOrEqual(PLAY_MIN - 0.001);
      expect(runner.y).toBeGreaterThanOrEqual(PLAY_MIN - 0.001);
    }
  });

  it('la bola toca a un jugador y lo mata en el acto', () => {
    parkOthers(engine, VICTIM);
    engine.moveRunnerTo(VICTIM, CENTER);
    engine.forceServe(0, 250);

    const events = runUntil(engine, (all) => all.some((event) => event.type === 'kill'));
    const kill = events.find((event) => event.type === 'kill');

    expect(kill?.type).toBe('kill');
    if (kill?.type !== 'kill') throw new Error('sin evento de muerte');
    expect(kill.player).toBe(VICTIM);
    expect(engine.isAlive(VICTIM)).toBe(false);
    expect(engine.ui().players[VICTIM].alive).toBe(false);
  });

  it('una muerte no acelera la bola: la velocidad se mantiene toda la ronda', () => {
    parkOthers(engine, VICTIM);
    engine.moveRunnerTo(VICTIM, CENTER);
    engine.forceServe(0, 250);
    runUntil(engine, (all) => all.some((event) => event.type === 'kill'));

    expect(engine.ui().kills).toBe(1);
    expect(engine.ui().ballSpeed).toBe(250);
    const ball = engine.view().ball;
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(250, 5);
  });

  it('un jugador muerto deja de moverse y de recibir decisiones', () => {
    parkOthers(engine, VICTIM);
    engine.moveRunnerTo(VICTIM, CENTER);
    engine.forceServe(0, 250);
    runUntil(engine, (all) => all.some((event) => event.type === 'kill'));

    engine.applyDecision(VICTIM, decision('derecha'));
    expect(engine.ui().players[VICTIM].move).toBeNull();
    const before = { ...engine.view().runners[VICTIM] };
    engine.step(16);
    expect(engine.view().runners[VICTIM].x).toBe(before.x);
  });

  it('quedar un solo vivo no cierra la ronda: sigue hasta el minuto o el wipe', () => {
    // Los diez estan del mismo lado; quedar uno no cierra nada. Solo el wipe
    // (la bola matando a todos) cierra antes, y ahi gana la bola negra.
    let killed = 0;
    while (killed < PLAYERS.length - 1) {
      const victim = PLAYERS.find((player) => engine.isAlive(player));
      if (!victim) break;
      parkOthers(engine, victim);
      engine.moveRunnerTo(victim, CENTER);
      const events = runUntil(engine, (all) => all.some((event) => event.type === 'kill'), 1200);
      if (!events.some((event) => event.type === 'kill')) {
        engine.forceServe(0, 250);
        continue;
      }
      killed += 1;
    }

    // Nueve muertos, uno vivo: la ronda sigue en pie.
    expect(engine.alivePlayers()).toHaveLength(1);
    expect(engine.finished).toBe(false);

    // El ultimo tambien cae: ahora si cierra, y gana la bola negra.
    const last = engine.alivePlayers()[0];
    if (!last) throw new Error('sin ultimo jugador');
    engine.moveRunnerTo(last, CENTER);
    engine.forceServe(0, 250);
    const events = runUntil(engine, (all) => all.some((event) => event.type === 'over'), 1200);
    expect(events.some((event) => event.type === 'over' && event.winner === 'ball')).toBe(true);
    expect(engine.alivePlayers()).toHaveLength(0);
    expect(engine.ui().winner).toBe('ball');
    expect(engine.finished).toBe(true);
    expect(engine.step(16)).toEqual([]);
  });

  it('aplica la decision del modelo como una sola direccion', () => {
    const player: Player = 'rojo';
    engine.applyDecision(player, decision('abajo-derecha'));
    const before = { ...engine.view().runners[player] };
    engine.step(16);
    const after = engine.view().runners[player];
    expect(after.x).toBeGreaterThan(before.x);
    expect(after.y).toBeGreaterThan(before.y);
    // La diagonal no es mas rapida que una recta.
    const moved = Math.hypot(after.x - before.x, after.y - before.y);
    expect(moved).toBeLessThanOrEqual(330 * 0.016 + 0.001);
  });

  it('la mesa no cambia: mismo marco y misma velocidad toda la ronda', () => {
    // Sin muerte subita la ronda no tiene reloj de pared: las reglas son las
    // mismas del primer saque al ultimo.
    const calm = new GameEngine({
      random: () => 0.25,
      servePauseMs: 0,
      survivalMs: Number.POSITIVE_INFINITY,
    });
    calm.forceServe(0, BALL_SPEED);
    for (let step = 0; step < 400; step++) calm.step(16);

    expect(calm.ui().ballSpeed).toBe(BALL_SPEED);
    expect(calm.snapshot().ballField).toEqual({ min: BALL_MIN, max: BALL_MAX });
    expect(calm.snapshot().field).toEqual({ min: PLAY_MIN, max: PLAY_MAX });
  });

  it('la velocidad de la bola se puede subir y bajar en vivo', () => {
    const speeding = new GameEngine({
      random: () => 0.25,
      servePauseMs: 0,
      survivalMs: Number.POSITIVE_INFINITY,
    });
    speeding.forceServe(0, BALL_SPEED);

    speeding.setBallSpeed(320);
    expect(speeding.ui().ballSpeed).toBe(320);
    // Solo cambia el modulo: la direccion que traia la bola se respeta.
    const current = speeding.view().ball;
    expect(Math.hypot(current.vx, current.vy)).toBeCloseTo(320, 4);
    expect(current.vx).toBeGreaterThan(0);
    expect(current.vy).toBeCloseTo(0, 4);

    // Queda como velocidad de los proximos saques.
    speeding.reset();
    expect(speeding.ui().ballSpeed).toBe(320);

    // Y se recorta al rango del control.
    speeding.setBallSpeed(10_000);
    expect(speeding.ui().ballSpeed).toBe(MAX_BALL_SPEED);
    speeding.setBallSpeed(-5);
    expect(speeding.ui().ballSpeed).toBe(MIN_BALL_SPEED);
  });

  it('expone la amenaza de los diez jugadores', () => {
    const target: Player = 'azul';
    engine.moveRunnerTo(target, { x: 680, y: 360 });
    engine.forceServe(0, 250);
    const snapshot = engine.snapshot();

    expect(snapshot.players[target].threatMs).toBeGreaterThan(0);
    expect(snapshot.killRadius).toBe(KILL_R);
    expect(snapshot.dangerRadius).toBe(DANGER_R);
    expect(snapshot.field).toEqual({ min: PLAY_MIN, max: PLAY_MAX });
    expect(Object.keys(snapshot.players)).toHaveLength(PLAYERS.length);
  });

  it('la bola tuerce en cada rebote: si no, la partida no acaba nunca', () => {
    // Sin desvio, la bola recorreria siempre las mismas cuatro rectas de la
    // mesa y habria zonas donde no puede aparecer nunca: los jugadores se
    // refugiarian ahi y la partida no terminaria nunca.
    let seed = 7;
    const random = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    // Un rebote limpio por angulo: se sale en diagonal hacia arriba-derecha y
    // se corta en el primer muro, que lejos de las esquinas es choque de frente.
    // Un unico tiro largo acababa viajando casi en horizontal y dejaba muy
    // pocas muestras utiles.
    const angles = [30, 40, 45, 50, 60, 70].map((degrees) => (degrees * Math.PI) / 180);
    const skews: number[] = [];
    for (const angle of angles) {
      const skewy = new GameEngine({
        servePauseMs: 0,
        random,
        survivalMs: Number.POSITIVE_INFINITY,
      });
      for (const player of PLAYERS) skewy.moveRunnerTo(player, PARK);
      skewy.forceServe(angle, 210);

      for (let step = 0; step < 300; step++) {
        const before = { ...skewy.view().ball };
        const events = skewy.step(16).filter((event) => event.type === 'wall');
        // Un unico rebote por paso: en una esquina tocan dos paredes y el
        // desvio se aplica dos veces, que ya no es comparable con un giro.
        if (events.length !== 1) continue;
        // De frente a la pared: en un roce rasante los cuatro reflejos posibles
        // se confunden y no se puede saber cuanto giro de verdad.
        const beforeSpeed = Math.hypot(before.vx, before.vy);
        if (Math.abs(before.vx) < beforeSpeed * 0.25 || Math.abs(before.vy) < beforeSpeed * 0.25) {
          continue;
        }
        // El rebote elastico ya refleja el rumbo: en angulo, una pared vertical
        // manda theta a pi-theta y una horizontal theta a -theta. El desvio es
        // lo que sobra respecto de cualquiera de esos cuatro reflejos.
        const angleBefore = Math.atan2(before.vy, before.vx);
        const after = Math.atan2(skewy.view().ball.vy, skewy.view().ball.vx);
        const delta = (target: number): number =>
          Math.atan2(Math.sin(target - after), Math.cos(target - after));
        skews.push(
          Math.min(
            ...[angleBefore, -angleBefore, Math.PI - angleBefore, Math.PI + angleBefore].map(
              (mirror) => Math.abs(delta(mirror)),
            ),
          ),
        );
        break;
      }
    }

    expect(skews.length).toBeGreaterThan(3);
    for (const skew of skews) {
      expect(skew).toBeGreaterThan(BOUNCE_SKEW_MIN - 1e-6);
      expect(skew).toBeLessThanOrEqual(BOUNCE_SKEW_MAX + 1e-6);
    }
  });

  it('los rebotes no aceleran la bola: la velocidad se mantiene', () => {
    for (const player of PLAYERS) {
      engine.moveRunnerTo(player, PARK);
    }
    engine.forceServe(0, 210);
    const start = engine.view().ball;
    const startSpeed = Math.hypot(start.vx, start.vy);
    let bounces = 0;
    for (let step = 0; step < 1200 && bounces < 2; step++) {
      if (engine.step(16).some((event) => event.type === 'wall')) bounces += 1;
    }
    const ball = engine.view().ball;
    expect(bounces).toBe(2);
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(startSpeed, 5);
    expect(engine.ui().ballSpeed).toBe(210);
  });

  it('la trayectoria no depende del tamano del frame (paso fijo)', () => {
    const simulate = (frameMs: number): { x: number; y: number } => {
      const run = new GameEngine({
        random: () => 0.25,
        servePauseMs: 0,
        survivalMs: Number.POSITIVE_INFINITY,
      });
      // 400 ms: la bola vuela y rebota, pero todavia no toca a nadie.
      for (let elapsed = 0; elapsed < 400; elapsed += frameMs) run.step(frameMs);
      const ball = run.view().ball;
      return { x: ball.x, y: ball.y };
    };

    const smooth = simulate(8);
    const choppy = simulate(25);

    expect(Math.abs(smooth.y - choppy.y)).toBeLessThan(2);
    expect(Math.abs(smooth.x - choppy.x)).toBeLessThan(2);
  });
});

/**
 * El minuto: si la ronda llega al tiempo de supervivencia con alguien vivo,
 * reviven los muertos y ganan las bolitas. Aqui se usa un tiempo corto para no
 * simular el minuto entero; el reloj es el mismo que corre en produccion.
 */
describe('ganan las bolitas al minuto', () => {
  it('pasado el minuto con alguien vivo, reviven los muertos y ganan las bolitas', () => {
    const engine = new GameEngine({
      random: () => 0.25,
      servePauseMs: 0,
      survivalMs: 100,
    });
    parkOthers(engine, VICTIM);
    engine.moveRunnerTo(VICTIM, CENTER);
    engine.forceServe(0, 250);

    const events: GameEvent[] = [];
    for (let elapsed = 0; elapsed < 400; elapsed += 16) events.push(...engine.step(16));

    // Primero cae el que estaba en el centro; despues se cumple el minuto.
    const killedAt = events.findIndex((event) => event.type === 'kill' && event.player === VICTIM);
    const overAt = events.findIndex((event) => event.type === 'over' && event.winner === 'players');
    expect(killedAt).toBeGreaterThanOrEqual(0);
    expect(overAt).toBeGreaterThan(killedAt);

    // Ganan las bolitas y reviven los caidos: la mesa esta entera otra vez.
    expect(engine.isAlive(VICTIM)).toBe(true);
    expect(engine.alivePlayers()).toHaveLength(PLAYERS.length);
    expect(engine.ui().winner).toBe('players');
    expect(engine.finished).toBe(true);
    expect(engine.step(16)).toEqual([]);
  });
});
