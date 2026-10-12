import type { MonthRecord } from '@/lib/bolsa/types';

import { panel } from './styles';

/** La pila despachada por recurso, de barata a cara. El hueco es el racionamiento. */
export function MeritTower({
  record,
  demandGwh,
  colorOf,
}: {
  record: MonthRecord | null;
  demandGwh: number;
  colorOf: (resourceId: string) => string;
}) {
  const units = record?.dispatched ?? [];
  const scale = demandGwh > 0 ? 100 / demandGwh : 0;
  const blocks: { key: string; x: number; width: number; color: string }[] = [];
  let cursor = 0;
  for (const unit of units) {
    const width = unit.quantityGwh * scale;
    blocks.push({ key: `${unit.resourceId}-${unit.price}`, x: cursor, width, color: colorOf(unit.resourceId) });
    cursor += width;
  }
  const end = cursor;

  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>Despacho por merito</strong>
        <span style={{ color: '#8b98b8', fontSize: 12 }}>{record ? record.month : 'sin despacho'}</span>
      </div>
      <svg viewBox="0 0 100 22" width="100%" height={90} preserveAspectRatio="none">
        <rect x={0} y={2} width={100} height={12} fill="rgba(255,255,255,0.04)" />
        {blocks.map((block) => (
          <rect key={block.key} x={block.x} y={2} width={block.width} height={12} fill={block.color} opacity={0.78} />
        ))}
        <line x1={100} y1={0} x2={100} y2={16} stroke="#ff5c5c" strokeWidth={0.6} />
        {record && record.deficitGwh > 0 ? <rect x={end} y={2} width={Math.max(0, 100 - end)} height={12} fill="rgba(255,92,92,0.35)" /> : null}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#8b98b8' }}>
        <span>Demanda <strong style={{ color: '#e8eefc' }}>{Math.round(demandGwh)} GWh</strong></span>
        <span>Marginal <strong style={{ color: '#7dd3fc' }}>{record ? `${Math.round(record.marginalPrice)} COP/kWh` : '—'}</strong></span>
        {record && record.importedGwh > 0 ? <span>TIE {Math.round(record.importedGwh)} GWh</span> : null}
        {record ? <span>CO2 {record.emissionsTon.toFixed(0)} t</span> : null}
        {record && record.deficitGwh > 0 ? <span style={{ color: '#ff8a8a' }}>deficit {Math.round(record.deficitGwh)} GWh</span> : null}
      </div>
    </div>
  );
}
