'use client';

import { formatTokens, formatUsd } from '@/lib/ai/pricing';
import type { Status } from '@/lib/client/ui';
import { PLAYERS } from '@/lib/game/players';

interface TopBarProps {
  round: number;
  aliveCount: number;
  status: Status;
  model: string;
  inputTokens: number | null;
  costUsd: number | null;
  costPerHourUsd: number | null;
  avgLatencyMs: number | null;
  consoleOpen: boolean;
  onToggleConsole: () => void;
}

function Metric({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="metric">
      <span className="metric-k">{label}</span>
      <span className="metric-v">{value}</span>
      {note ? <span className="metric-note">{note}</span> : null}
    </div>
  );
}

/** Cabecera del HUD: identidad, estado de la ronda y costo de la sesion. */
export function TopBar({
  round,
  aliveCount,
  status,
  model,
  inputTokens,
  costUsd,
  costPerHourUsd,
  avgLatencyMs,
  consoleOpen,
  onToggleConsole,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="brand-row">
          <h1 className="brand">
            Have no mouth,
            <br />
            and I must scream
          </h1>
          <em className="brand-ia">IA</em>
        </div>
        <p className="brand-sub">diez corredores · la bola mata</p>
      </div>

      <div className="topbar-metrics">
        <Metric label="ronda" value={String(round)} />
        <Metric label="vivos" value={`${aliveCount}/${PLAYERS.length}`} />
        <Metric
          label="latencia"
          value={avgLatencyMs === null ? '—' : `${avgLatencyMs} ms`}
        />
        <Metric label="tokens" value={formatTokens(inputTokens)} />
        <Metric
          label="costo"
          value={formatUsd(costUsd)}
          note={costPerHourUsd === null ? null : `${formatUsd(costPerHourUsd)}/h`}
        />
      </div>

      <div className="topbar-status">
        <span className={`status-pill ${status.kind}`}>
          <span className="dot" />
          <span className="status-text">{status.text}</span>
        </span>
        <span className="model-pill" title="modelo que decide">
          {model}
        </span>
        <button
          type="button"
          className={`btn ghost ${consoleOpen ? 'active' : ''}`}
          onClick={onToggleConsole}
          title="ver las peticiones al modelo y su costo (C)"
        >
          consola
        </button>
      </div>
    </header>
  );
}
