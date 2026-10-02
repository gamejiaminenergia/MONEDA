'use client';

import { SIDES, SIDE_NAME, type Side } from '@/lib/game/sides';
import type { SideRecord, SideUiState } from '@/lib/game/types';

export type Status = { text: string; kind: 'on' | 'off' | 'loading' | 'pause' | 'err' };

interface StandingsProps {
  sides: SideRecord<SideUiState>;
  startingLives: number;
  status: Status;
}

/** Marcador de los cuatro equipos: vidas y quien ya murio. */
export function Standings({ sides, startingLives, status }: StandingsProps) {
  return (
    <div className="standings">
      {SIDES.map((side: Side) => {
        const state = sides[side];
        return (
          <div className="team-chip" key={side} data-side={side} data-dead={!state.alive}>
            <span className="chip-name">{SIDE_NAME[side]}</span>
            <span className="chip-lives" aria-label={`${state.lives} de ${startingLives} vidas`}>
              {Array.from({ length: startingLives }, (_, index) => (
                <i key={index} data-on={index < state.lives} />
              ))}
            </span>
            <span className="chip-count">{state.alive ? state.lives : 'MUERTO'}</span>
          </div>
        );
      })}
      <div className="status">
        <span className={`dot ${status.kind}`} />
        <span>{status.text}</span>
      </div>
    </div>
  );
}
