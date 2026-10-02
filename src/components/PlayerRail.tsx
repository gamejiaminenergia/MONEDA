'use client';

import type { CSSProperties } from 'react';

import { MOVE_LABEL } from '@/lib/game/moves';
import { PLAYERS, PLAYER_HEX, PLAYER_NAME, type Player } from '@/lib/game/players';
import type { PlayerRecord, PlayerUiState } from '@/lib/game/types';

interface PlayerRailProps {
  players: PlayerRecord<PlayerUiState>;
  wins: PlayerRecord<number>;
}

const threatShort = (state: PlayerUiState): string => {
  if (!state.alive) return 'fuera de la mesa';
  if (state.threatMs === 0) return 'la bola encima';
  if (state.threatMs === null) return 'sin amenaza';
  return `le pilla en ${state.threatMs} ms`;
};

/**
 * Los diez jugadores en una lista compacta: color, nombre, jugada elegida,
 * confianza, amenaza y rondas ganadas. Es la vista que se mira de reojo
 * mientras la mesa corre.
 */
export function PlayerRail({ players, wins }: PlayerRailProps) {
  return (
    <section className="panel players">
      <div className="panel-head">
        <span className="panel-title">jugadores</span>
        <span className="panel-sub">jugada y amenaza</span>
      </div>

      <div className="player-list">
        {PLAYERS.map((player: Player) => {
          const state = players[player];
          const danger = state.alive && state.threatMs !== null && state.threatMs < 400;
          return (
            <article
              key={player}
              className="prow"
              data-dead={!state.alive}
              data-danger={danger}
              style={{ '--team': PLAYER_HEX[player] } as CSSProperties}
            >
              <span className="pdot" aria-hidden="true" />
              <span className="pname">{PLAYER_NAME[player]}</span>
              <span className="pwin" title="rondas ganadas">
                ★{wins[player]}
              </span>
              <span className="pmove" data-move={state.move ?? undefined}>
                {state.alive ? (state.move ? MOVE_LABEL[state.move] : '…') : '—'}
              </span>
              <span className="pbar" aria-hidden="true">
                <i style={{ width: `${Math.round(state.probability * 100)}%` }} />
              </span>
              <span className="pthreat">{threatShort(state)}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
