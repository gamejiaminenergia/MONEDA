import { Box, Circle, Settings, Vec2, World, type Body, type Contact } from 'planck';

import { BALL_R, H, PAD, W } from './constants';
import type { BallState, Point } from './types';

/**
 * Fisica de la mesa sobre planck.js (el port de Box2D).
 *
 * Aqui vive una sola cosa: la bola y las cuatro paredes. La bola es elastica y
 * rebota para siempre, asi que nunca se pierde: el unico final posible es que
 * toque a un corredor.
 *
 * Los corredores **no** son cuerpos de Box2D. Viven en el motor como circulos y
 * el rozamiento se resuelve con un barrido del segmento que la bola recorio en
 * el paso. Es a proposito:
 *  - no puede haber tunneling por rapido que vaya la bola;
 *  - la bola no se desvia al matar a alguien, asi que su trayectoria sigue
 *    siendo una funcion cerrada de (posicion, velocidad) y la prediccion de
 *    peligro es exacta y no una simulacion aparte.
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

// Box2D trata como inelastico cualquier choque por debajo de este umbral.
// La bola es lenta (2.5 m/s) y a veces roza la pared con la componente normal
// casi cero: con el valor por defecto (1) el rebote simplemente no ocurre.
Settings.velocityThreshold = 0.01;

/** Cara interna de la pared: hasta ahi puede llegar el centro de la bola. */
export interface StepResult {
  /** Rebotes contra las paredes del tramo, para efectos y sonido. */
  walls: Point[];
  /** Tramo recorrido por el centro de la bola en este paso. */
  sweep: { from: Point; to: Point } | null;
}

function createBall(world: World): Body {
  const ball = world.createBody({
    type: 'dynamic',
    position: Vec2(toMeters(W / 2), toMeters(H / 2)),
    // bullet activa la deteccion continua: es lo que impide que una bola
    // rapida salte de un frame al otro por encima de una pared.
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
    userData: { kind: 'ball' },
  });
  return ball;
}

type WallRole = 'left' | 'right' | 'top' | 'bottom';

interface Wall {
  readonly role: WallRole;
  readonly body: Body;
}

/**
 * Grosor de las paredes. Son gruesas a proposito: aunque la mesa no se mueve,
 * la pared tiene que cubrir de sobra el borde del lienzo por si la bola llega
 * con la camara temblando o con un paso grande.
 */
const WALL_DEPTH = 500;

function wallCenter(role: WallRole, padPx: number): Vec2 {
  const half = toMeters(WALL_DEPTH) / 2;
  switch (role) {
    case 'left':
      return Vec2(toMeters(padPx) - half, toMeters(H / 2));
    case 'right':
      return Vec2(toMeters(W - padPx) + half, toMeters(H / 2));
    case 'top':
      return Vec2(toMeters(W / 2), toMeters(padPx) - half);
    case 'bottom':
      return Vec2(toMeters(W / 2), toMeters(H - padPx) + half);
  }
}

/** Las cuatro paredes como cuerpos estaticos, con la cara interna en `padPx`. */
function createWalls(world: World, padPx: number): Wall[] {
  const half = toMeters(WALL_DEPTH) / 2;
  // Se solapan de sobra en las esquinas: al cerrarse no puede quedar rendija.
  const long = toMeters(Math.max(W, H)) / 2 + half;
  const roles: WallRole[] = ['left', 'right', 'top', 'bottom'];
  return roles.map((role) => {
    const vertical = role === 'left' || role === 'right';
    const body = world.createBody({ type: 'static', position: wallCenter(role, padPx) });
    body.createFixture({
      shape: vertical ? new Box(half, long) : new Box(long, half),
      restitution: 1,
      friction: 0,
      userData: { kind: 'wall' },
    });
    return { role, body };
  });
}

/** La mesa: una bola elastica contra cuatro paredes. */
export class ArenaWorld {
  private readonly world: World;
  private readonly ballBody: Body;
  private accumulator = 0;
  private wallHits: Point[] = [];

  constructor() {
    this.world = new World({ gravity: Vec2.zero(), allowSleep: false });
    this.ballBody = createBall(this.world);
    // Las paredes solo viven dentro de Box2D: la mesa es fija, nadie las
    // vuelve a mover, asi que no hace falta guardar sus cuerpos.
    createWalls(this.world, PAD);
    this.world.on('begin-contact', this.onBeginContact);
  }

  private readonly onBeginContact = (contact: Contact): void => {
    const roleA = contact.getFixtureA().getUserData() as { kind: string } | undefined;
    const roleB = contact.getFixtureB().getUserData() as { kind: string } | undefined;
    const ballIsA = roleA?.kind === 'ball';
    const ballIsB = roleB?.kind === 'ball';
    if (!ballIsA && !ballIsB) return;
    if ((ballIsA ? roleB : roleA)?.kind !== 'wall') return;
    const position = this.ballBody.getPosition();
    this.wallHits.push({ x: toPixels(position.x), y: toPixels(position.y) });
  };

  /**
   * Avanza la simulacion con paso fijo. `dtMs` puede variar (frames irregulares)
   * pero la fisica siempre corre a 1/60, que es lo que la hace reproducible.
   */
  step(dtMs: number): StepResult {
    this.wallHits = [];
    const from = this.ball();
    this.accumulator += dtMs / 1000;

    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      this.world.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps += 1;
    }
    if (steps >= MAX_STEPS_PER_FRAME) this.accumulator = 0;

    return {
      walls: this.wallHits,
      sweep: steps > 0 ? { from: { x: from.x, y: from.y }, to: this.ball() } : null,
    };
  }

  ball(): BallState {
    const position = this.ballBody.getPosition();
    const velocity = this.ballBody.getLinearVelocity();
    return {
      x: toPixels(position.x),
      y: toPixels(position.y),
      vx: toPixels(velocity.x),
      vy: toPixels(velocity.y),
    };
  }

  /** Teletransporta la bola (saque) y reinicia el reloj de la fisica. */
  setBall(state: BallState): void {
    this.ballBody.setTransform(Vec2(toMeters(state.x), toMeters(state.y)), 0);
    this.ballBody.setLinearVelocity(Vec2(toMeters(state.vx), toMeters(state.vy)));
    this.accumulator = 0;
  }

  setBallVelocity(vx: number, vy: number): void {
    this.ballBody.setLinearVelocity(Vec2(toMeters(vx), toMeters(vy)));
  }
}
