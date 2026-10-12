'use client';

import { SURVIVAL_MS } from '@/lib/game/constants';
import { PLAYERS } from '@/lib/game/players';

interface LiveStatsProps {
  decisions: number;
  avgLatencyMs: number | null;
  bounces: number;
  kills: number;
  crowdKills: number;
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
  crowdKills,
  aliveCount,
  ballSpeed,
  clockMs,
}: LiveStatsProps) {
  const remainingSec = Math.max(0, Math.ceil((SURVIVAL_MS - clockMs) / 1000));

  const stats = [
    { key: 'decisiones', value: String(decisions) },
    { key: 'latencia media', value: avgLatencyMs === null ? '—' : `${avgLatencyMs} ms` },
    { key: 'rebotes', value: String(bounces) },
    { key: 'muertos', value: `${kills}/${PLAYERS.length - 1}` },
    { key: 'por grilla', value: String(crowdKills) },
    { key: 'vivos', value: `${aliveCount}/${PLAYERS.length}` },
    { key: 'velocidad bola', value: `${ballSpeed} px/s` },
    { key: 'tiempo', value: `${(clockMs / 1000).toFixed(1)} s` },
    // Cuenta atras de la meta colectiva: cumplida con alguien vivo, ganan todos.
    { key: 'para tregua', value: `${remainingSec} s` },
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
