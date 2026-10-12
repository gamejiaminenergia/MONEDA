import type { Score } from '@/lib/bolsa/types';

import { mono, panel } from './styles';

/** Marcador de la partida: meses servidos, precio medio y emisiones. */
export function ScoreBoard({ score }: { score: Score }) {
  const rows: [string, string][] = [
    ['Meses servidos', String(score.monthsServed)],
    ['Meses con deficit', String(score.deficitMonths)],
    ['Marginal medio', String(Math.round(score.avgMarginal))],
    ['Bolsa real media', String(Math.round(score.avgBolsaRef))],
    ['CO2 total', `${Math.round(score.emissionsTon)} t`],
    ['Insolvencias', String(score.insolvencies)],
  ];
  return (
    <div style={panel}>
      <strong>Marcador</strong>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8, fontSize: 12, color: '#c7d2e8' }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: 'contents' }}>
            <span>{label}</span>
            <span style={{ fontFamily: mono }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
