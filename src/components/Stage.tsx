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
  /** La ronda acabo sin nadie en pie: la grilla se los llevo a todos. */
  draw: boolean;
  /** Se aguanto el minuto: tregua colectiva, ganan todos. */
  truce: boolean;
  wins: PlayerRecord<number>;
  round: number;
  countdownSec: number;
  decisions: number;
  avgLatencyMs: number | null;
  clockMs: number;
  /** Segundos que faltan para la tregua colectiva; `null` si no hay ronda. */
  survivalSec: number | null;
  /** Meta de tiempo de la ronda (el minuto), en ms. */
  survivalMs: number;
  statusKind: StatusKind;
  onRestart: () => void;
}

/** Segundos como `M:SS`, para el reloj del minuto. */
const clock = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

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
  draw,
  truce,
  wins,
  round,
  countdownSec,
  decisions,
  avgLatencyMs,
  clockMs,
  survivalSec,
  survivalMs,
  statusKind,
  onRestart,
}: StageProps) {
  const ended = winner !== null || draw || truce;
  const showBadge = (thinking || paused) && !ended;
  const totalSec = Math.max(1, Math.round(survivalMs / 1000));
  const elapsedPct = survivalSec === null ? 0 : Math.min(100, Math.max(0, (1 - survivalSec / totalSec) * 100));
  const urgent = survivalSec !== null && survivalSec <= 10;

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

        {/* El reloj del minuto: cuenta atras hacia la tregua colectiva. */}
        {survivalSec !== null && !ended ? (
          <div className="stage-timer" data-urgent={urgent} role="timer" aria-live="off">
            <span className="stage-timer-k">tregua en</span>
            <span className="stage-timer-v">{clock(survivalSec)}</span>
            <span className="stage-timer-bar" aria-hidden="true">
              <i style={{ width: `${elapsedPct}%` }} />
            </span>
          </div>
        ) : null}

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

        <div id="overlay" className={ended ? 'show' : ''} aria-hidden={!ended}>
          <div className="ovcard" role="dialog" aria-label="fin de ronda">
            <div className="ovkicker">
              {truce ? 'tregua colectiva' : draw ? 'sin ganador' : 'ganador'} · ronda {round}
            </div>
            <div
              className={`ovtitle ${truce ? 'ovtitle-truce' : draw ? 'ovtitle-draw' : ''}`}
              style={winner ? ({ '--team': PLAYER_HEX[winner] } as CSSProperties) : undefined}
            >
              {winner
                ? `SOBREVIVE ${PLAYER_LABEL[winner]}`
                : truce
                  ? 'SOBREVIVEN TODOS'
                  : draw
                    ? 'LA GRILLA SE LOS LLEVO'
                    : ''}
            </div>
            <div className="ovsub">
              {truce
                ? `aguantaron el minuto · ganan los ${PLAYERS.length}`
                : draw
                  ? 'nadie en pie'
                  : 'ultimo en pie'}{' '}
              · {(clockMs / 1000).toFixed(1)} s · {decisions} decisiones · latencia{' '}
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
