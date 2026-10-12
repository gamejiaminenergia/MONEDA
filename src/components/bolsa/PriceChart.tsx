import { panel } from './styles';

/** Precio del juego contra la bolsa real. */
export function PriceChart({ marginal, bolsa, escasez }: { marginal: number[]; bolsa: number[]; escasez: number }) {
  const max = Math.max(escasez, ...marginal, ...bolsa, 1);
  const path = (values: number[]): string =>
    values
      .map((value, index) => {
        const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * 100;
        const y = 40 - (value / max) * 38;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');

  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>Precio (juego vs bolsa real)</strong>
        <span style={{ color: '#8b98b8', fontSize: 12 }}>techo {escasez}</span>
      </div>
      <svg viewBox="0 0 100 40" width="100%" height={130} preserveAspectRatio="none">
        {bolsa.length > 1 ? <polyline points={path(bolsa)} fill="none" stroke="#ffb454" strokeWidth={0.7} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" /> : null}
        {marginal.length > 1 ? <polyline points={path(marginal)} fill="none" stroke="#7dd3fc" strokeWidth={0.9} vectorEffect="non-scaling-stroke" /> : null}
      </svg>
      <div style={{ fontSize: 11, color: '#8b98b8', display: 'flex', gap: 14 }}>
        <span><span style={{ color: '#7dd3fc' }}>—</span> marginal del juego</span>
        <span><span style={{ color: '#ffb454' }}>--</span> bolsa real</span>
      </div>
    </div>
  );
}
