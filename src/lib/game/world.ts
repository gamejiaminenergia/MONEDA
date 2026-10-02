import { Box, Circle, Settings, Vec2, World, type Body, type Contact } from 'planck';

import {
  BALL_R,
  CENTER,
  H,
  PAD,
  PAD_H,
  PAD_W,
  PLANE,
  W,
} from './constants';
import { clampPaddlePos } from './physics';
import { SIDES, SIDE_AXIS, type Side } from './sides';
import type { PaddleIndex } from './types';

/**
 * Fisica de la mesa sobre planck.js (el port de Box2D).
 *
 * Cuatro equipos, uno por pared. Cada equipo tiene dos paddles estaticos que
 * reposicionamos cada frame; cuando un equipo muere, sus paddles se destruyen
 * y su pared se sella con un muro real.
 *
 * El motor de juego sigue pensando en pixeles; Box2D trabaja comodo en metros,
 * asi que todo cruza la frontera por `toMeters` / `toPixels`.
 */
const PX_PER_M = 100;

const toMeters = (px: number): number => px / PX_PER_M;
const toPixels = (meters: number): number => meters * PX_PER_M;

const FIXED_DT = 1 / 60;
/** Tope de subpasos por frame: evita la espiral de la muerte si un frame se atasca. */
const MAX_STEPS_PER_FRAME = 5;
/** Corta la simulacion de prediccion: 20 s de vuelo no los da ni la bola mas loca. */
const MAX_PREDICTION_STEPS = 1200;
/** Grosor de los muros que se levantan cuando un equipo muere. */
const WALL_THICKNESS = 60;

// Box2D trata como inelastico cualquier choque por debajo de este umbral.
// Nuestra bola es lenta (2.5 m/s) y a veces roza la pared con vy casi cero:
// con el valor por defecto (1) el rebote simplemente no ocurre.
Settings.velocityThreshold = 0.01;

type FixtureRole =
  | { kind: 'ball' }
  | { kind: 'wall' }
  | { kind: 'paddle'; side: Side; index: PaddleIndex };

export interface BallStatePx {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface PaddleContact {
  side: Side;
  index: PaddleIndex;
  ballX: number;
  ballY: number;
}

export interface StepResult {
  contacts: PaddleContact[];
  /** Golpes contra los muros (paredes selladas), para efectos y sonido. */
  walls: { x: number; y: number }[];
  /** Equipo que no alcanzo a cubrir la bola. Como maximo uno por paso. */
  miss: Side | null;
}

interface Scene {
  world: World;
  ball: Body;
}

/** Centro del cuerpo del paddle segun su equipo y su posicion sobre la pared. */
function paddleCenter(side: Side, pos: number): Vec2 {
  switch (side) {
    case 'left':
      return Vec2(toMeters(PAD + PAD_W / 2), toMeters(pos));
    case 'right':
      return Vec2(toMeters(W - PAD - PAD_W / 2), toMeters(pos));
    case 'top':
      return Vec2(toMeters(pos), toMeters(PAD + PAD_W / 2));
    case 'bottom':
      return Vec2(toMeters(pos), toMeters(H - PAD - PAD_W / 2));
  }
}

/** Los paddles de los lados son verticales; los de arriba/abajo, horizontales. */
const paddleBox = (side: Side): Box =>
  SIDE_AXIS[side] === 'y'
    ? new Box(toMeters(PAD_W / 2), toMeters(PAD_H / 2))
    : new Box(toMeters(PAD_H / 2), toMeters(PAD_W / 2));

/** Muro que sella la pared de un equipo muerto. */
function sealBox(side: Side): { center: Vec2; box: Box } {
  const half = toMeters(WALL_THICKNESS / 2);
  switch (side) {
    case 'left':
      return { center: Vec2(toMeters(PLANE - WALL_THICKNESS / 2), toMeters(CENTER)), box: new Box(half, toMeters(H)) };
    case 'right':
      return { center: Vec2(toMeters(W - PLANE + WALL_THICKNESS / 2), toMeters(CENTER)), box: new Box(half, toMeters(H)) };
    case 'top':
      return { center: Vec2(toMeters(CENTER), toMeters(PLANE - WALL_THICKNESS / 2)), box: new Box(toMeters(W), half) };
    case 'bottom':
      return { center: Vec2(toMeters(CENTER), toMeters(H - PLANE + WALL_THICKNESS / 2)), box: new Box(toMeters(W), half) };
  }
}

/** Punto de la bola (su centro) cuando su borde toca el plano de ese equipo. */
export const contactLimit = (side: Side): number =>
  side === 'left' || side === 'top' ? PLANE + BALL_R : (side === 'right' ? W : H) - PLANE - BALL_R;

/** La bola se mueve hacia esa pared? */
const approaches = (side: Side, ball: BallStatePx): boolean => {
  switch (side) {
    case 'left':
      return ball.vx < 0;
    case 'right':
      return ball.vx > 0;
    case 'top':
      return ball.vy < 0;
    case 'bottom':
      return ball.vy > 0;
  }
};

/** La bola ya toco (o paso) el plano de ese equipo? */
const reachedPlane = (side: Side, ball: { x: number; y: number }): boolean => {
  switch (side) {
    case 'left':
      return ball.x - BALL_R <= PLANE;
    case 'right':
      return ball.x + BALL_R >= W - PLANE;
    case 'top':
      return ball.y - BALL_R <= PLANE;
    case 'bottom':
      return ball.y + BALL_R >= H - PLANE;
  }
};

/** Mundo minimo (solo la bola): es el lienzo de la prediccion. */
function createScene(): Scene {
  const world = new World({ gravity: Vec2.zero(), allowSleep: false });
  const ball = world.createBody({
    type: 'dynamic',
    position: Vec2(toMeters(W / 2), toMeters(CENTER)),
    // bullet activa la deteccion continua: es lo que impide que una bola
    // rapida salte de un frame al otro por encima de un paddle.
    bullet: true,
    fixedRotation: true,
    linearDamping: 0,
    angularDamping: 0,
    gravityScale: 0,
  });
  ball.createFixture({
    shape: new Circle(toMeters(BALL_R)),
    restitution: 1,
    friction: 0,
    density: 1,
    userData: { kind: 'ball' } satisfies FixtureRole,
  });
  return { world, ball };
}

/**
 * La mesa de cuatro equipos: bola con deteccion continua, ocho paddles
 * estaticos y los muros que van apareciendo cuando alguien muere.
 */
export class PongWorld {
  private readonly world: World;
  private readonly ballBody: Body;
  private readonly predictor: Scene;
  private readonly paddles: Record<Side, [Body | null, Body | null]>;
  private readonly sealed: Record<Side, boolean> = {
    left: false,
    right: false,
    top: false,
    bottom: false,
  };

  private accumulator = 0;
  private contacts: PaddleContact[] = [];
  private wallHits: { x: number; y: number }[] = [];
  /** Sube cada vez que cambia la velocidad de la bola: invalida la prediccion. */
  private ballEpoch = 0;
  private predicted: Partial<Record<Side, { epoch: number; value: number }>> = {};

  constructor() {
    const scene = createScene();
    this.world = scene.world;
    this.ballBody = scene.ball;
    this.predictor = createScene();
    this.paddles = {
      left: [this.createPaddle('left', 0), this.createPaddle('left', 1)],
      right: [this.createPaddle('right', 0), this.createPaddle('right', 1)],
      top: [this.createPaddle('top', 0), this.createPaddle('top', 1)],
      bottom: [this.createPaddle('bottom', 0), this.createPaddle('bottom', 1)],
    };
    this.world.on('begin-contact', this.onBeginContact);
  }

  private createPaddle(side: Side, index: PaddleIndex): Body {
    const body = this.world.createBody({ type: 'static', position: paddleCenter(side, CENTER) });
    body.createFixture({
      shape: paddleBox(side),
      restitution: 1,
      friction: 0,
      userData: { kind: 'paddle', side, index } satisfies FixtureRole,
    });
    return body;
  }

  private readonly onBeginContact = (contact: Contact): void => {
    const roleA = contact.getFixtureA().getUserData() as FixtureRole | undefined;
    const roleB = contact.getFixtureB().getUserData() as FixtureRole | undefined;
    const ballIsA = roleA?.kind === 'ball';
    const ballIsB = roleB?.kind === 'ball';
    if (!ballIsA && !ballIsB) return;

    const other = ballIsA ? roleB : roleA;
    const position = this.ballBody.getPosition();
    const ballX = toPixels(position.x);
    const ballY = toPixels(position.y);

    // Los muros los resuelve el solver, pero el juego quiere enterarse.
    if (other?.kind === 'wall') {
      this.wallHits.push({ x: ballX, y: ballY });
      return;
    }
    if (other?.kind !== 'paddle') return;

    this.contacts.push({ side: other.side, index: other.index, ballX, ballY });
  };

  /**
   * Avanza la simulacion con paso fijo. `dtMs` puede variar (frames irregulares)
   * pero la fisica siempre corre a 1/60, que es lo que la hace reproducible.
   */
  step(dtMs: number): StepResult {
    this.contacts = [];
    this.wallHits = [];
    this.accumulator += dtMs / 1000;

    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      this.world.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps += 1;
    }
    if (steps >= MAX_STEPS_PER_FRAME) this.accumulator = 0;

    const contacts = this.contacts;
    const ball = this.ball();
    let miss: Side | null = null;
    for (const side of SIDES) {
      if (this.sealed[side]) continue;
      if (!approaches(side, ball) || !reachedPlane(side, ball)) continue;
      if (contacts.some((hit) => hit.side === side)) continue;
      miss = side;
      break;
    }

    return { contacts, walls: this.wallHits, miss };
  }

  ball(): BallStatePx {
    const position = this.ballBody.getPosition();
    const velocity = this.ballBody.getLinearVelocity();
    return {
      x: toPixels(position.x),
      y: toPixels(position.y),
      vx: toPixels(velocity.x),
      vy: toPixels(velocity.y),
    };
  }

  /** Teletransporta la bola (saque o reinicio) y reinicia el reloj de la fisica. */
  setBall(state: BallStatePx): void {
    this.ballBody.setTransform(Vec2(toMeters(state.x), toMeters(state.y)), 0);
    this.ballBody.setLinearVelocity(Vec2(toMeters(state.vx), toMeters(state.vy)));
    this.accumulator = 0;
    this.ballEpoch += 1;
  }

  /** Respuesta del juego tras un choque: cambia la velocidad de la bola. */
  setBallVelocity(vx: number, vy: number): void {
    this.ballBody.setLinearVelocity(Vec2(toMeters(vx), toMeters(vy)));
    this.ballEpoch += 1;
  }

  setPaddle(side: Side, index: PaddleIndex, pos: number): void {
    const body = this.paddles[side][index];
    if (!body) return;
    const clamped = clampPaddlePos(pos);
    const current = body.getPosition();
    const currentPos = SIDE_AXIS[side] === 'y' ? toPixels(current.y) : toPixels(current.x);
    if (Math.abs(currentPos - clamped) < 0.001) return;
    body.setTransform(paddleCenter(side, clamped), 0);
  }

  /**
   * Un equipo muere: sus paddles desaparecen y su pared queda sellada por un
   * muro. La bola sigue jugando; esa pared ya no se puede perder.
   */
  killTeam(side: Side): void {
    for (const index of [0, 1] as const) {
      const body = this.paddles[side][index];
      if (body) this.world.destroyBody(body);
      this.paddles[side][index] = null;
    }
    if (this.sealed[side]) return;
    this.sealed[side] = true;

    const { center, box } = sealBox(side);
    const fixture = {
      restitution: 1,
      friction: 0,
      userData: { kind: 'wall' } satisfies FixtureRole,
    };
    this.world.createBody({ type: 'static', position: center }).createFixture({ shape: box, ...fixture });
    // La prediccion tambien tiene que saber que ahi ahora rebota.
    this.predictor.world
      .createBody({ type: 'static', position: center })
      .createFixture({ shape: box, ...fixture });
  }

  /**
   * Coordenada (Y en los equipos de los lados, X en los de arriba/abajo) a la
   * que la bola tocaria la defensa de ese equipo si nadie la desviara.
   *
   * Se calcula simulando el vuelo en el mundo de prediccion: es la misma
   * fisica que corre el juego, asi que la prediccion no puede desincronizarse.
   * El resultado se guarda hasta que la bola cambie de velocidad.
   */
  predictArrival(side: Side): number {
    const cached = this.predicted[side];
    if (cached && cached.epoch === this.ballEpoch) return cached.value;

    const axisIsY = SIDE_AXIS[side] === 'y';
    const position = this.ballBody.getPosition();
    const velocity = this.ballBody.getLinearVelocity();
    const ball = this.ball();
    const current = axisIsY ? ball.y : ball.x;

    // Si la bola se aleja de esa pared, nunca va a llegar: se informa donde
    // esta ahora, que es lo que el juego venia haciendo.
    if (!approaches(side, ball)) {
      this.predicted[side] = { epoch: this.ballEpoch, value: current };
      return current;
    }

    const limit = contactLimit(side);

    const { world, ball: probe } = this.predictor;
    probe.setTransform(position, 0);
    probe.setLinearVelocity(velocity);

    // `crossing` avanza hacia la pared; `arrival` es lo que queremos medir.
    let previousCrossing = axisIsY ? ball.x : ball.y;
    let previousArrival = current;
    let arrival = current;

    for (let step = 0; step < MAX_PREDICTION_STEPS; step++) {
      world.step(FIXED_DT);
      const point = probe.getPosition();
      const at = { x: toPixels(point.x), y: toPixels(point.y) };
      const crossing = axisIsY ? at.x : at.y;
      const value = axisIsY ? at.y : at.x;

      // El vuelo termina en el primer plano que la bola alcanza. Si ese plano
      // no es el nuestro, la bola nunca va a llegar aqui: se responde donde
      // esta ahora y los paddles se quedan esperando ahi.
      const endsAt = SIDES.find((candidate) => !this.sealed[candidate] && reachedPlane(candidate, at));
      if (endsAt) {
        if (endsAt === side) {
          const span = crossing - previousCrossing;
          const ratio = span === 0 ? 1 : (limit - previousCrossing) / span;
          arrival = previousArrival + (value - previousArrival) * ratio;
        }
        break;
      }

      previousCrossing = crossing;
      previousArrival = value;
      arrival = value;
    }

    this.predicted[side] = { epoch: this.ballEpoch, value: arrival };
    return arrival;
  }
}
