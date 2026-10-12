import type { Embalse } from '@/lib/bolsa/types';

import { panel } from './styles';

/** Embalses y rios; el nivel del sistema es el dato real del mes. */
export function EmbalsesPanel({ embalses, embalsePct, aportePct }: { embalses: Embalse[]; embalsePct: number; aportePct: number }) {
  return (
    <div style={panel}>
      <strong>Hidrologia (dato real del mes)</strong>
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#c7d2e8' }}>
          <span>Embalse del sistema</span>
          <span style={{ color: '#8b98b8' }}>{(embalsePct * 100).toFixed(0)}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.10)', overflow: 'hidden', marginTop: 3 }}>
          <div style={{ width: `${Math.min(100, embalsePct * 100).toFixed(0)}%`, height: '100%', background: '#2ee6c5' }} />
        </div>
        <div style={{ fontSize: 11, color: '#8b98b8', marginTop: 4 }}>Aportes {aportePct.toFixed(1)}x la media</div>
      </div>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {embalses.map((embalse) => (
          <div key={embalse.id} style={{ fontSize: 11, color: '#c7d2e8' }}>
            {embalse.name} <span style={{ color: '#8b98b8' }}>· {embalse.river}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
