import { describe, expect, it } from 'vitest';

import { buildQuestions, buildStatePrompt, moveCriteria } from '@/lib/game/prompt';
import { ALL_MOVES } from '@/lib/game/moves';
import {
  BALL_MAX,
  BALL_MIN,
  DANGER_R,
  KILL_R,
  PLAY_MAX,
  PLAY_MIN,
  RUNNER_SPEED,
} from '@/lib/game/constants';
import { PLAYERS, type Player } from '@/lib/game/players';
import type { GameSnapshot, PlayerRecord, PlayerSnapshot } from '@/lib/game/types';

const player = (over: Partial<PlayerSnapshot> = {}): PlayerSnapshot => ({
  x: 150,
  y: 200,
  distance: 300,
  threatMs: null,
  threatX: null,
  threatY: null,
  alive: true,
  ...over,
});

/** Reparto por defecto: los diez repartidos con vida. */
const table = (
  over: Partial<Record<Player, Partial<PlayerSnapshot>>> = {},
): PlayerRecord<PlayerSnapshot> =>
  Object.fromEntries(PLAYERS.map((key) => [key, player(over[key])])) as PlayerRecord<PlayerSnapshot>;

const snapshot = (over: Partial<GameSnapshot> = {}): GameSnapshot => ({
  ball: {
    x: 360,
    y: 200,
    vx: 250,
    vy: -80,
    speed: 262,
    direction: 'arriba-derecha',
  },
  players: table({
    rojo: { x: 120, y: 150, distance: 245 },
    azul: { x: 640, y: 210, distance: 280, threatMs: 420, threatX: 660, threatY: 210 },
    rosa: { x: 200, y: 90, distance: 190, threatMs: 0, threatX: 360, threatY: 200 },
    amarillo: { x: 520, y: 570, distance: 400 },
  }),
  killRadius: KILL_R,
  dangerRadius: DANGER_R,
  field: { min: PLAY_MIN, max: PLAY_MAX },
  ballField: { min: BALL_MIN, max: BALL_MAX },
  runnerSpeed: RUNNER_SPEED,
  clockMs: 4200,
  paused: false,
  winner: null,
  ...over,
});

describe('prompt', () => {
  it('deja claro que un roce mata y que no hay vidas', () => {
    const text = buildStatePrompt(snapshot());
    expect(text).toContain('Si la bola toca a un jugador, ese jugador MUERE en el acto');
    expect(text).toContain('sin vidas ni segunda oportunidad');
    expect(text).toContain('Gana el ultimo jugador que siga vivo');
    expect(text).toContain('no se pierde nunca');
  });

  it('nombra a los diez jugadores por su color', () => {
    const text = buildStatePrompt(snapshot());
    for (const name of PLAYERS) expect(text).toContain(name);
  });

  it('le dice a cada jugador cuando le llega la bola y por donde', () => {
    const text = buildStatePrompt(snapshot());
    expect(text).toContain('Azul en (640, 210), la bola le pilla en 420 ms por (660, 210)');
    expect(text).toContain('Rosa en (200, 90), LA BOLA LE ESTA ENCIMA');
    expect(text).toContain('Amarillo en (520, 570), de este vuelo la bola no le pilla');
  });

  it('advierte que el vuelo cambia en el proximo rebote', () => {
    const text = buildStatePrompt(snapshot());
    expect(text).toContain('CADA REBOTE LA DESVIA un poco');
    expect(text).toContain('solo se puede planificar el vuelo que esta en marcha');
  });

  it('da las medidas de la mesa y los radios', () => {
    const text = buildStatePrompt(snapshot());
    expect(text).toContain(`La mesa va de ${PLAY_MIN} a ${PLAY_MAX}`);
    expect(text).toContain(`mata a ${KILL_R} px`);
    expect(text).toContain(`avisa a ${DANGER_R} px`);
  });

  it('describe la bola', () => {
    const text = buildStatePrompt(snapshot());
    expect(text).toContain('Bola en (360, 200) a 262 px/s, yendo hacia arriba-derecha');
  });

  it('marca a los muertos y no los describe en juego', () => {
    const view = snapshot();
    const text = buildStatePrompt({
      ...view,
      players: { ...view.players, rosa: player({ x: 200, y: 90, alive: false }) },
    });
    expect(text).toContain('Ya muertos: rosa.');
    expect(text).not.toContain('Rosa en (200, 90)');
  });

  it('anuncia que no ha muerto nadie', () => {
    expect(buildStatePrompt(snapshot())).toContain('Todavia no ha muerto nadie.');
  });

  it('ofrece las nueve direcciones, sin ejes ni equipos', () => {
    const criteria = moveCriteria();
    expect(Object.keys(criteria)).toHaveLength(9);
    expect(criteria['arriba-izquierda']).toBe('hacia arriba-izquierda');
    expect(criteria.quedarse).toBe('quedarse quieto');
    for (const move of ALL_MOVES) expect(criteria[move]).toBeDefined();
  });

  it('pregunta solo por los jugadores vivos', () => {
    const questions = buildQuestions(['rojo', 'rosa']);
    expect(Object.keys(questions)).toEqual(['rojo', 'rosa']);
    expect(Object.keys(questions.rojo?.criteria ?? {})).toHaveLength(9);
    expect(questions.rojo?.instructions).toContain('una por decision');
  });
});
