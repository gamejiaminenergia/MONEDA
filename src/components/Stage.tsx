'use client';

import type { CSSProperties, RefObject } from 'react';

import type { StatusKind } from '@/lib/client/ui';
import { PLAYERS, PLAYER_HEX, PLAYER_LABEL, PLAYER_NAME, type Player } from '@/lib/game/players';
import type { PlayerRecord } from '@/lib/game/types';

interface StageProps {
  /** Caja donde la escena de Phaser inserta su canvas. */
  boardRef: RefObject<HTMLDivElement | null>;
  thinking: boolean;
  paused: boolean;
  winner: Player | null;
  wins: PlayerRecord<number>;
  round: number;
  countdownSec: number;
  decisions: number;
  avgLatencyMs: number | null;
  clockMs: number;
  statusKind: StatusKind;
  onRestart: () => void;
}

/**
 * La mesa y sus carteles. Phaser dibuja dentro de `#board`; lo que se lee
 * encima (pensando, ganador, ronda nueva) sigue en React para poder animarlo y
 * para que exista en el HTML del servidor.
 */
export function Stage({
  boardRef,
  thinking,
  paused,
  winner,
  wins,
  round,
  countdownSec,
  decisions,
  avgLatencyMs,
  clockMs,
  statusKind,
  onRestart,
}: StageProps) {
  const showBadge = (thinking || paused) && !winner;

  return (
    <div className="stage-frame">
      <div id="stage">
        <div
          ref={boardRef}
          id="board"
          role="img"
          aria-label="Mesa con diez jugadores y una bola que rebota"
        />

        <div className="stage-badge" data-show={showBadge} aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          {paused ? 'EN PAUSA' : 'EL MODELO PIENSA'}
        </div>

        {statusKind === 'err' ? (
          <div className="stage-alert" role="status">
            sin conexion con el modelo
          </div>
        ) : null}

        {/* La `key` reinicia la animacion en cada ronda: sin estado ni timers. */}
        <div className="stage-intro" key={round} aria-hidden="true">
          <span className="stage-intro-k">ronda</span>
          <span className="stage-intro-v">{round}</span>
        </div>

        <div id="overlay" className={winner ? 'show' : ''} aria-hidden={winner === null}>
          <div className="ovcard" role="dialog" aria-label="fin de ronda">
            <div className="ovkicker">ganador · ronda {round}</div>
            <div
              className="ovtitle"
              style={winner ? ({ '--team': PLAYER_HEX[winner] } as CSSProperties) : undefined}
            >
              {winner ? `SOBREVIVE ${PLAYER_LABEL[winner]}` : ''}
            </div>
            <div className="ovsub">
              ultimo en pie · {(clockMs / 1000).toFixed(1)} s · {decisions} decisiones · latencia{' '}
              {avgLatencyMs ?? 0} ms
            </div>

            <div className="ovwins">
              {PLAYERS.map((player: Player) => (
                <span
                  className="ovwins-item"
                  key={player}
                  data-lead={winner === player}
                  style={{ '--team': PLAYER_HEX[player] } as CSSProperties}
                >
                  <b>{PLAYER_NAME[player]}</b>
                  <i>{wins[player]}</i>
                </span>
              ))}
            </div>

            <div className="ovnext">
              la ronda {round + 1} empieza sola en {countdownSec} s
            </div>
            <button type="button" className="btn" onClick={onRestart}>
              empezar ya
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
