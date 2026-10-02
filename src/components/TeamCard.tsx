'use client';

import { SIDE_NAME, type Side } from '@/lib/game/sides';
import type { SideUiState } from '@/lib/game/types';

interface TeamCardProps {
  side: Side;
  state: SideUiState;
}

/** Detalle de un equipo: sus dos paddles, lo que decidio y cuantas vidas le quedan. */
export function TeamCard({ side, state }: TeamCardProps) {
  return (
    <div className="card" data-side={side} data-dead={!state.alive}>
      <div className="who">
        <span>{SIDE_NAME[side]}</span>
        <span>{state.alive ? `vidas ${state.lives}` : 'MUERTO'}</span>
      </div>

      {([0, 1] as const).map((index) => {
        const paddle = state.paddles[index];
        const label = index === 0 ? 'A' : 'B';
        return (
          <div className="prow" key={label}>
            <span className="pname" title={`paddle ${label}`}>
              {label}
            </span>
            <span className="pmove" data-move={paddle.move ?? undefined}>
              {state.alive ? (paddle.move ?? '…') : '—'}
            </span>
            <span className="pbar">
              <i style={{ width: `${(paddle.probability * 100).toFixed(0)}%` }} />
            </span>
            <span className="ppct">{paddle.move && state.alive ? `${(paddle.probability * 100).toFixed(0)}%` : '—'}</span>
          </div>
        );
      })}

      <div className="meta">
        {state.alive ? (
          <>
            <span>{state.source ?? '—'} · conf {state.confidence.toFixed(2)}</span>
            <span>{state.choice ? state.choice.replace('|', ' / ') : ''}</span>
          </>
        ) : (
          <>
            <span>cayo tras {state.lost} derrotas</span>
            <span>pared sellada</span>
          </>
        )}
      </div>
    </div>
  );
}
