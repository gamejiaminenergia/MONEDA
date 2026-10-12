'use client';

import { useSyncExternalStore } from 'react';

import { BALL_SPEED } from '@/lib/game/constants';
import type { GameEngine } from '@/lib/game/engine';
import { PLAYERS, PLAYER_SPAWN, type Player } from '@/lib/game/players';
import type { PlayerRecord, PlayerUiState, UiState } from '@/lib/game/types';

const idlePlayer = (player: Player): PlayerUiState => ({
  x: PLAYER_SPAWN[player].x,
  y: PLAYER_SPAWN[player].y,
  move: null,
  probability: 0,
  confidence: 0,
  threatMs: null,
  alive: true,
});

/**
 * Snapshot para el HTML del servidor y para la hidratacion.
 *
 * No se puede usar el estado del motor: su constructor sortea el saque con
 * `Math.random`, asi que el servidor y el navegador calcularian amenazas
 * distintas y React tiraria la hidratacion (error #418). Este snapshot es
 * constante y los dos lados coinciden; en cuanto React hidrata, pasa al estado
 * vivo del motor.
 */
const IDLE_UI: UiState = {
  version: 0,
  players: Object.fromEntries(
    PLAYERS.map((player) => [player, idlePlayer(player)]),
  ) as PlayerRecord<PlayerUiState>,
  winner: null,
  paused: false,
  thinking: false,
  aliveCount: PLAYERS.length,
  decisions: 0,
  avgLatencyMs: null,
  lastLatencyMs: null,
  bounces: 0,
  kills: 0,
  clockMs: 0,
  ballSpeed: BALL_SPEED,
};

/**
 * Conecta React al motor. Re-renderiza solo cuando el motor marca un cambio,
 * nunca en cada frame: el canvas se dibuja aparte, fuera de React.
 */
export function useEngineUi(engine: GameEngine): UiState {
  return useSyncExternalStore(engine.subscribe, () => engine.ui(), () => IDLE_UI);
}
