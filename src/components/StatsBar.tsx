'use client';

interface StatsBarProps {
  decisions: number;
  avgLatencyMs: number | null;
  rally: number;
  maxRally: number;
  points: number;
  aliveCount: number;
}

export function StatsBar({
  decisions,
  avgLatencyMs,
  rally,
  maxRally,
  points,
  aliveCount,
}: StatsBarProps) {
  const stats = [
    { key: 'VIVOS', value: `${aliveCount}/4` },
    { key: 'DECISIONES', value: String(decisions) },
    { key: 'LATENCIA MEDIA', value: avgLatencyMs === null ? '—' : `${avgLatencyMs} ms` },
    { key: 'RALLY', value: String(rally) },
    { key: 'RALLY MAX', value: String(maxRally) },
    { key: 'DERROTAS', value: String(points) },
  ];

  return (
    <div className="statsbar">
      {stats.map((stat) => (
        <div className="stat" key={stat.key}>
          <div className="k">{stat.key}</div>
          <div className="v">{stat.value}</div>
        </div>
      ))}
    </div>
  );
}
