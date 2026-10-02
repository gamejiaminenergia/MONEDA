import { describe, expect, it } from 'vitest';

import { buildQuestions, buildStatePrompt, comboCriteria } from '@/lib/game/prompt';
import type { GameSnapshot, SideSnapshot } from '@/lib/game/types';

const side = (arrival: number, a: number, b: number, lives: number, alive = true): SideSnapshot => ({
  arrival,
  paddles: [{ pos: a }, { pos: b }],
  lives,
  alive,
});

const snapshot: GameSnapshot = {
  ball: { x: 360, y: 200, vx: 250, vy: -80, verticalDirection: 'sube', horizontalDirection: 'right' },
  sides: {
    left: side(120, 210, 350, 7),
    right: side(430, 210, 350, 10),
    top: side(500, 200, 400, 2),
    bottom: side(300, 250, 320, 9),
  },
  startingLives: 10,
  rally: 3,
  paused: false,
  winner: null,
};

describe('prompt', () => {
  it('deja claro que a las N derrotas el equipo muere', () => {
    const text = buildStatePrompt(snapshot);
    expect(text).toContain('pierde 10 veces MUERE');
    expect(text).toContain('su pared queda sellada');
    expect(text).toContain('Gana el ultimo equipo que siga vivo');
  });

  it('le dice a cada equipo cuantas vidas le quedan', () => {
    const text = buildStatePrompt(snapshot);
    expect(text).toContain('izquierda 7/10');
    expect(text).toContain('derecha 10/10');
    expect(text).toContain('arriba 2/10 AL BORDE DE MORIR');
    expect(text).toContain('abajo 9/10');
  });

  it('describe la bola y los cuatro equipos', () => {
    const text = buildStatePrompt(snapshot);
    expect(text).toContain('Bola sube hacia derecha');
    expect(text).toContain('Izquierda llegada A arriba, B arriba (A sobre B)');
    expect(text).toContain('Arriba llegada A abajo, B abajo (A sobre B)');
    expect(text).toContain('Abajo llegada A abajo, B altura (A sobre B)');
  });

  it('marca a los equipos muertos y no los describe en juego', () => {
    const withDead = {
      ...snapshot,
      sides: { ...snapshot.sides, top: side(0, 200, 400, 0, false) },
    };
    const text = buildStatePrompt(withDead);
    expect(text).toContain('arriba MUERTO');
    expect(text).toContain('Equipos muertos: arriba.');
    expect(text).not.toContain('Arriba llegada');
  });

  it('ofrece las nueve combinaciones de cada eje', () => {
    const vertical = comboCriteria('y');
    const horizontal = comboCriteria('x');
    expect(Object.keys(vertical)).toHaveLength(9);
    expect(vertical['subir|bajar']).toBe('paddle A subir, paddle B bajar');
    expect(horizontal['izquierda|derecha']).toBe('paddle A izquierda, paddle B derecha');
    expect(horizontal['subir|subir']).toBeUndefined();
  });

  it('pregunta solo por los equipos vivos', () => {
    const questions = buildQuestions(['left', 'top']);
    expect(Object.keys(questions)).toEqual(['izquierda', 'arriba']);
    expect(Object.keys(questions.izquierda?.criteria ?? {})).toHaveLength(9);
    expect(questions.izquierda?.instructions).toContain('subir, bajar, quedarse');
    expect(questions.arriba?.instructions).toContain('izquierda, derecha, quedarse');
  });
});
