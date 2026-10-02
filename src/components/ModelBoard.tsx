'use client';

import { averageLatency, type ModelStats } from '@/lib/client/model-stats';

interface ModelBoardProps {
  stats: ModelStats;
  activeModel: string;
}

export function ModelBoard({ stats, activeModel }: ModelBoardProps) {
  const entries = Object.entries(stats);
  if (entries.length === 0) {
    return (
      <div className="modelbar">
        <div className="stat">
          <div className="k">comparativa</div>
          <div className="v" style={{ fontSize: 13 }}>
            aún sin decisiones
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modelbar">
      {entries.map(([model, stat]) => {
        const latency = averageLatency(stat);
        return (
          <div className="stat" key={model} data-active={model === activeModel}>
            <div className="k">
              {model}
              {model === activeModel ? ' · en juego' : ''}
            </div>
            <div className="v" style={{ fontSize: 14 }}>
              {stat.decisions} dec · {latency === null ? '—' : `${latency} ms`} · rally max {stat.maxRally}
              {stat.fallbacks > 0 ? ` · ${stat.fallbacks} respaldo` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}
