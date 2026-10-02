'use client';

import { PLAYERS } from '@/lib/game/players';

interface LiveStatsProps {
  decisions: number;
  avgLatencyMs: number | null;
  bounces: number;
  kills: number;
  aliveCount: number;
  ballSpeed: number;
  clockMs: number;
}

/** Metricas de la partida en curso: lo que cambia segundo a segundo. */
export function LiveStats({
  decisions,
  avgLatencyMs,
  bounces,
  kills,
  aliveCount,
  ballSpeed,
  clockMs,
}: LiveStatsProps) {
  const stats = [
    { key: 'decisiones', value: String(decisions) },
    { key: 'latencia media', value: avgLatencyMs === null ? '—' : `${avgLatencyMs} ms` },
    { key: 'rebotes', value: String(bounces) },
    { key: 'muertos', value: `${kills}/${PLAYERS.length - 1}` },
    { key: 'vivos', value: `${aliveCount}/${PLAYERS.length}` },
    { key: 'velocidad bola', value: `${ballSpeed} px/s` },
    { key: 'tiempo', value: `${(clockMs / 1000).toFixed(1)} s` },
  ];

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">en vivo</span>
        <span className="panel-sub">ronda actual</span>
      </div>
      <div className="statgrid">
        {stats.map((stat) => (
          <div className="stat" key={stat.key}>
            <span className="stat-k">{stat.key}</span>
            <span className="stat-v">{stat.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
