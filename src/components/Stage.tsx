'use client';

import type { RefObject } from 'react';

import { SIDE_LABEL, type Side } from '@/lib/game/sides';

interface StageProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  thinking: boolean;
  paused: boolean;
  winner: Side | null;
  decisions: number;
  avgLatencyMs: number | null;
  onRestart: () => void;
}

export function Stage({
  canvasRef,
  thinking,
  paused,
  winner,
  decisions,
  avgLatencyMs,
  onRestart,
}: StageProps) {
  return (
    <div id="stage">
      <canvas ref={canvasRef} id="game" aria-label="Mesa de Pong de cuatro equipos" />
      <div id="thinking" className={thinking ? 'show' : ''}>
        {paused ? 'EN PAUSA' : 'NIMBLE PENSANDO…'}
      </div>
      <div id="overlay" className={winner ? 'show' : ''}>
        <div className="ovcard">
          <div className="ovtitle" data-side={winner ?? 'left'}>
            {winner ? `SOBREVIVE ${SIDE_LABEL[winner]}` : ''}
          </div>
          <div className="ovsub">
            sobrevivió a los otros 3 equipos · {decisions} decisiones · latencia{' '}
            {avgLatencyMs ?? 0} ms
          </div>
          <button type="button" onClick={onRestart}>
            jugar otra vez
          </button>
        </div>
      </div>
    </div>
  );
}
