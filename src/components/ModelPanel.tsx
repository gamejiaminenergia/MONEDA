'use client';

import { averageLatency, type ModelStats } from '@/lib/client/model-stats';

interface ModelPanelProps {
  stats: ModelStats;
  activeModel: string;
}

/** Comparativa acumulada por modelo (se guarda en localStorage). */
export function ModelPanel({ stats, activeModel }: ModelPanelProps) {
  const entries = Object.entries(stats);

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">modelos</span>
        <span className="panel-sub">comparativa</span>
      </div>

      {entries.length === 0 ? (
        <p className="panel-empty">aun sin decisiones: la comparativa arranca con la primera jugada</p>
      ) : (
        <div className="model-list">
          {entries.map(([model, stat]) => {
            const latency = averageLatency(stat);
            return (
              <div className="modelrow" key={model} data-active={model === activeModel}>
                <span className="modelrow-name">{model}</span>
                <span className="modelrow-meta">
                  {stat.decisions} dec · {latency === null ? '—' : `${latency} ms`} · sobrevivio{' '}
                  {(stat.survivalMs / 1000).toFixed(0)} s
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
