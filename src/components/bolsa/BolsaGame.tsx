'use client';

import type { CSSProperties } from 'react';

import type { Generator } from '@/lib/bolsa/types';

import { useBolsa, type HourRecord } from './useBolsa';

const panel: CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 12,
  padding: 14,
};

const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/** Posiciones acumuladas de la pila despachada (funcion pura, fuera del render). */
function stackOffsets(
  units: { id: string; price: number; quantityMw: number }[],
  scale: number,
): { blocks: { key: string; x: number; width: number }[]; end: number } {
  const blocks: { key: string; x: number; width: number }[] = [];
  let cursor = 0;
  for (const unit of units) {
    const width = unit.quantityMw * scale;
    blocks.push({ key: `${unit.id}-${unit.price}`, x: cursor, width });
    cursor += width;
  }
  return { blocks, end: cursor };
}

/** La torre de merito: la pila despachada, de barata a cara. El hueco es el apagon. */
function MeritTower({ record, demandMw }: { record: HourRecord | null; demandMw: number }) {
  const units = record?.dispatched ?? [];
  const scale = demandMw > 0 ? 100 / demandMw : 0;
  const stack = stackOffsets(units, scale);

  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>Torre de merito</strong>
        <span style={{ color: '#8b98b8', fontSize: 12 }}>
          {record ? `hora ${record.hour}` : 'sin despacho todavia'}
        </span>
      </div>
      <svg viewBox="0 0 100 22" width="100%" height={90} preserveAspectRatio="none">
        <rect x={0} y={2} width={100} height={12} fill="rgba(255,255,255,0.04)" />
        {stack.blocks.map((block) => (
          <rect key={block.key} x={block.x} y={2} width={block.width} height={12} fill="rgba(120,180,255,0.55)" />
        ))}
        <line x1={100} y1={0} x2={100} y2={16} stroke="#ff5c5c" strokeWidth={0.6} />
        {record && record.deficitMw > 0 ? (
          <rect x={stack.end} y={2} width={Math.max(0, 100 - stack.end)} height={12} fill="rgba(255,92,92,0.35)" />
        ) : null}
      </svg>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: '#8b98b8' }}>
        <span>
          Demanda <strong style={{ color: '#e8eefc' }}>{Math.round(demandMw)} MWh</strong>
        </span>
        <span>
          Marginal{' '}
          <strong style={{ color: '#7dd3fc' }}>
            {record ? `${Math.round(record.marginalPrice)} COP/kWh` : '—'}
          </strong>
        </span>
        {record && record.deficitMw > 0 ? (
          <span style={{ color: '#ff8a8a' }}>deficit {Math.round(record.deficitMw)} MWh</span>
        ) : null}
      </div>
    </div>
  );
}

/** Serie del precio marginal de la bolsa. */
function PriceChart({ values, scarcityPrice }: { values: number[]; scarcityPrice: number }) {
  const max = Math.max(scarcityPrice, ...values, 1);
  const points = values
    .map((value, index) => {
      const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * 100;
      const y = 30 - (value / max) * 28;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>Precio de bolsa</strong>
        <span style={{ color: '#8b98b8', fontSize: 12 }}>techo escasez {scarcityPrice}</span>
      </div>
      <svg viewBox="0 0 100 30" width="100%" height={120} preserveAspectRatio="none">
        {values.length > 1 ? (
          <polyline points={points} fill="none" stroke="#7dd3fc" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
        ) : (
          <line x1={0} y1={29} x2={100} y2={29} stroke="rgba(255,255,255,0.2)" strokeWidth={0.4} />
        )}
      </svg>
    </div>
  );
}

function AgentCard({ generator }: { generator: Generator }) {
  const dead = !generator.alive;
  const waterPct = generator.embalseMaxMw > 0 ? (generator.embalseMw / generator.embalseMaxMw) * 100 : 0;
  return (
    <div
      style={{
        ...panel,
        opacity: dead ? 0.4 : 1,
        borderColor: generator.color,
        borderWidth: 1,
        padding: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: generator.color, display: 'inline-block' }} />
        <strong style={{ fontSize: 13 }}>{generator.name}</strong>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8b98b8' }}>{generator.kind}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8, fontSize: 12, color: '#c7d2e8' }}>
        <span>Costo {Math.round(generator.cost)}</span>
        <span>Cap. {Math.round(generator.capacityMw)}</span>
        <span>Caja {Math.round(generator.cash)}</span>
        <span>{dead ? 'fuera' : 'activo'}</span>
      </div>
      {generator.kind === 'hidro' ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.10)', overflow: 'hidden' }}>
            <div style={{ width: `${waterPct.toFixed(0)}%`, height: '100%', background: '#2ee6c5' }} />
          </div>
          <div style={{ fontSize: 11, color: '#8b98b8', marginTop: 3 }}>
            embalse {Math.round(generator.embalseMw)} / {Math.round(generator.embalseMaxMw)} MWh
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: '#8b98b8', marginTop: 8 }}>combustible firme</div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#8b98b8', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ?? '#e8eefc', fontFamily: mono }}>{value}</div>
    </div>
  );
}

export default function BolsaGame() {
  const { market, hours, log, running, speedMs, model, error, cost, setRunning, setSpeedMs, setModel, tick, reset } =
    useBolsa();
  const lastHour = hours.length > 0 ? hours[hours.length - 1] ?? null : null;
  const remaining = Math.max(0, market.horizonHours - market.hour);
  const estimatedUsd = (cost.inputTokens / 1_000_000) * 0.042;

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0a0e17',
        color: '#e8eefc',
        padding: 20,
        fontFamily: 'system-ui, Segoe UI, Roboto, sans-serif',
      }}
    >
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>BOLSA</h1>
        <Stat label="Hora" value={`${market.hour}/${market.horizonHours}`} />
        <Stat label="Horas restantes" value={String(remaining)} />
        <Stat
          label="Precio de bolsa"
          value={market.marginalPrice === null ? '—' : `${Math.round(market.marginalPrice)}`}
          accent="#7dd3fc"
        />
        <Stat label="Sequia" value={market.sequia.toFixed(2)} accent="#ffd93d" />
        {market.winner ? (
          <Stat
            label="Ganador"
            value={market.winner === 'agentes' ? 'AGENTES' : 'ESCASEZ'}
            accent={market.winner === 'agentes' ? '#38ff9c' : '#ff5c5c'}
          />
        ) : null}
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <button onClick={() => setRunning(!running)} disabled={market.finished} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: running ? '#ff5c5c' : '#38ff9c', color: '#0a0e17', fontWeight: 700, cursor: 'pointer' }}>
          {running ? 'Pausar' : 'Jugar'}
        </button>
        <button onClick={() => void tick()} disabled={running || market.finished} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#e8eefc', cursor: 'pointer' }}>
          Paso
        </button>
        <button onClick={reset} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#e8eefc', cursor: 'pointer' }}>
          Reiniciar
        </button>
        <label style={{ fontSize: 13, color: '#8b98b8' }}>
          Velocidad{' '}
          <select value={speedMs} onChange={(event) => setSpeedMs(Number(event.target.value))} style={{ background: '#131a2b', color: '#e8eefc', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: 4 }}>
            <option value={1600}>lenta</option>
            <option value={1000}>normal</option>
            <option value={500}>rapida</option>
          </select>
        </label>
        <label style={{ fontSize: 13, color: '#8b98b8' }}>
          Modelo{' '}
          <input value={model} onChange={(event) => setModel(event.target.value)} style={{ width: 130, background: '#131a2b', color: '#e8eefc', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: 4 }} />
        </label>
        <span style={{ fontSize: 12, color: '#8b98b8' }}>
          {cost.calls} llamadas · {(cost.inputTokens / 1000).toFixed(1)}k tokens · ~${estimatedUsd.toFixed(4)}
        </span>
      </div>

      {error ? <div style={{ ...panel, borderColor: '#ff5c5c', color: '#ffb4b4', marginBottom: 16 }}>{error}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(280px, 1.2fr) minmax(260px, 1fr)', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <MeritTower record={lastHour} demandMw={market.demandMw} />
          <PriceChart values={market.priceHistory} scarcityPrice={market.scarcityPrice} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {market.generators.map((generator) => (
            <AgentCard key={generator.id} generator={generator} />
          ))}
        </div>

        <div style={{ ...panel, maxHeight: 520, overflow: 'auto' }}>
          <strong>Bitacora</strong>
          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', fontFamily: mono, fontSize: 12, color: '#c7d2e8' }}>
            {log.length === 0 ? <li style={{ color: '#8b98b8' }}>Sin eventos todavia.</li> : null}
            {log.map((line, index) => (
              <li key={index} style={{ padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p style={{ color: '#8b98b8', fontSize: 12, marginTop: 16, maxWidth: 860 }}>
        Seis agentes ofertan cada hora. El operador despacha de barata a cara y el precio de la ultima
        unidad lo cobran todos: por eso una oferta mueve el precio de los demas. Las hidraulicas gastan
        embalse; la sequia avanza. Si la demanda no se cubre, hay apagon y gana la escasez.
      </p>
    </main>
  );
}
