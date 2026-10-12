'use client';

import type { CSSProperties } from 'react';

import { availabilityFactor } from '@/lib/bolsa/hydrology';
import { SCENARIOS } from '@/lib/bolsa/scenario';
import type { Agent, Embalse, MonthRecord, Resource } from '@/lib/bolsa/types';

import { useBolsa } from './useBolsa';

const panel: CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 12,
  padding: 14,
};

const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const TYPE_SHORT: Record<Resource['type'], string> = { hidro: 'hidro', termica: 'term.', solar: 'solar', eolica: 'eol.' };

function MeritTower({ record, demandGwh, colorOf }: { record: MonthRecord | null; demandGwh: number; colorOf: (id: string) => string }) {
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

function PriceChart({ marginal, bolsa, escasez }: { marginal: number[]; bolsa: number[]; escasez: number }) {
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

function EmbalsesPanel({ embalses, embalsePct, aportePct }: { embalses: Embalse[]; embalsePct: number; aportePct: number }) {
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
          <div key={embalse.id} style={{ fontSize: 11, color: '#c7d2e8' }}>{embalse.name} <span style={{ color: '#8b98b8' }}>· {embalse.river}</span></div>
        ))}
      </div>
    </div>
  );
}

function GeneratorCard({ agent, resources, embalsePct }: { agent: Agent; resources: Resource[]; embalsePct: number }) {
  const mine = resources.filter((resource) => agent.resources.includes(resource.id));
  return (
    <div style={{ ...panel, padding: 10, opacity: agent.alive ? 1 : 0.4, borderColor: agent.color }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: agent.color, display: 'inline-block' }} />
        <strong style={{ fontSize: 13 }}>{agent.name}</strong>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8b98b8' }}>{Math.round(agent.cash)} MCOP</span>
      </div>
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {mine.map((resource) => {
          const disponible = Math.round(resource.capacityGwh * availabilityFactor(resource, embalsePct));
          return (
            <div key={resource.id} style={{ fontSize: 11, color: '#c7d2e8' }}>
              <span style={{ color: agent.color }}>■</span> {resource.name}{' '}
              <span style={{ color: '#8b98b8' }}>{TYPE_SHORT[resource.type]} {disponible}/{Math.round(resource.capacityGwh)} GWh · {Math.round(resource.cost)} COP</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComercializadorCard({ agent, weight, marginal }: { agent: Agent; weight: number; marginal: number | null }) {
  const share = weight > 0 ? agent.demandGwh / weight : 0;
  const exposure = 1 - agent.coverage;
  const spotRisk = marginal === null ? 0 : exposure * agent.demandGwh * Math.max(0, marginal - agent.tariff);
  return (
    <div style={{ ...panel, padding: 10, opacity: agent.alive ? 1 : 0.4, borderColor: agent.color }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: agent.color, display: 'inline-block' }} />
        <strong style={{ fontSize: 13 }}>{agent.name}</strong>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8b98b8' }}>{Math.round(agent.cash)} MCOP</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6, fontSize: 11, color: '#c7d2e8' }}>
        <span>Cuota {(share * 100).toFixed(0)}%</span>
        <span>Cubre {(agent.coverage * 100).toFixed(0)}%</span>
        <span>Expuesta {(exposure * 100).toFixed(0)}%</span>
        <span style={{ color: spotRisk > 0 ? '#ff8a8a' : '#8b98b8' }}>bolsa {Math.round(spotRisk)} MCOP</span>
      </div>
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
  const { scenarioId, market, months, log, running, speedMs, model, error, cost, setRunning, setSpeedMs, setModel, tick, reset } = useBolsa();
  const last = months.length > 0 ? months[months.length - 1] ?? null : null;
  const currentPeriod = market.periods[Math.min(market.monthIndex, market.months - 1)];
  const estimatedUsd = (cost.inputTokens / 1_000_000) * 0.042;

  const colorOf = (resourceId: string): string => {
    const resource = market.resources.find((item) => item.id === resourceId);
    const owner = resource ? market.agents.find((agent) => agent.id === resource.owner) : undefined;
    return owner?.color ?? '#8899bb';
  };

  const generadores = market.agents.filter((agent) => agent.role === 'generador');
  const comercializadores = market.agents.filter((agent) => agent.role === 'comercializador');
  const weight = comercializadores.filter((agent) => agent.alive).reduce((sum, agent) => sum + agent.demandGwh, 0);
  const score = market.score;

  return (
    <main style={{ minHeight: '100vh', background: '#0a0e17', color: '#e8eefc', padding: 20, fontFamily: 'system-ui, Segoe UI, Roboto, sans-serif' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>BOLSA <span style={{ fontSize: 12, color: '#8b98b8' }}>mensual 2020-2025</span></h1>
        <label style={{ fontSize: 13, color: '#8b98b8' }}>
          Escenario{' '}
          <select value={scenarioId} onChange={(event) => reset(event.target.value)} style={{ background: '#131a2b', color: '#e8eefc', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: 4 }} disabled={running}>
            {SCENARIOS.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>{scenario.name}</option>
            ))}
          </select>
        </label>
        <Stat label="Mes" value={currentPeriod?.month ?? '—'} />
        <Stat label="Avance" value={`${market.monthIndex}/${market.months}`} />
        <Stat label="Marginal" value={market.marginalPrice === null ? '—' : `${Math.round(market.marginalPrice)}`} accent="#7dd3fc" />
        <Stat label="Bolsa real" value={`${Math.round(currentPeriod?.bolsaRef ?? 0)}`} accent="#ffb454" />
        <Stat label="Embalse" value={`${((market.embalsePct ?? 0) * 100).toFixed(0)}%`} accent="#2ee6c5" />
        {market.winner ? <Stat label="Ganador" value={market.winner === 'agentes' ? 'AGENTES' : 'ESCASEZ'} accent={market.winner === 'agentes' ? '#38ff9c' : '#ff5c5c'} /> : null}
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <button onClick={() => setRunning(!running)} disabled={market.finished} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: running ? '#ff5c5c' : '#38ff9c', color: '#0a0e17', fontWeight: 700, cursor: 'pointer' }}>
          {running ? 'Pausar' : 'Jugar'}
        </button>
        <button onClick={() => void tick()} disabled={running || market.finished} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#e8eefc', cursor: 'pointer' }}>Paso (1 mes)</button>
        <button onClick={() => reset(scenarioId)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#e8eefc', cursor: 'pointer' }}>Reiniciar</button>
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
        <span style={{ fontSize: 12, color: '#8b98b8' }}>{cost.calls} llamadas · {(cost.inputTokens / 1000).toFixed(1)}k tokens · ~${estimatedUsd.toFixed(4)}</span>
      </div>

      {error ? <div style={{ ...panel, borderColor: '#ff5c5c', color: '#ffb4b4', marginBottom: 16 }}>{error}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.1fr) minmax(300px, 1.2fr) minmax(260px, 1fr)', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <MeritTower record={last} demandGwh={market.demandGwh} colorOf={colorOf} />
          <EmbalsesPanel embalses={market.embalses} embalsePct={market.embalsePct} aportePct={currentPeriod?.aportePct ?? 1} />
          <PriceChart marginal={market.priceHistory} bolsa={market.bolsaHistory} escasez={market.escasez} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, color: '#8b98b8', textTransform: 'uppercase', letterSpacing: 1 }}>Generadores ({generadores.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {generadores.map((agent) => (
              <GeneratorCard key={agent.id} agent={agent} resources={market.resources} embalsePct={market.embalsePct} />
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#8b98b8', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>Comercializadores ({comercializadores.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {comercializadores.map((agent) => (
              <ComercializadorCard key={agent.id} agent={agent} weight={weight} marginal={market.marginalPrice} />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={panel}>
            <strong>Marcador</strong>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8, fontSize: 12, color: '#c7d2e8' }}>
              <span>Meses servidos</span><span style={{ fontFamily: mono }}>{score.monthsServed}</span>
              <span>Meses con deficit</span><span style={{ fontFamily: mono }}>{score.deficitMonths}</span>
              <span>Marginal medio</span><span style={{ fontFamily: mono }}>{Math.round(score.avgMarginal)}</span>
              <span>Bolsa real media</span><span style={{ fontFamily: mono }}>{Math.round(score.avgBolsaRef)}</span>
              <span>CO2 total</span><span style={{ fontFamily: mono }}>{Math.round(score.emissionsTon)} t</span>
              <span>Insolvencias</span><span style={{ fontFamily: mono }}>{score.insolvencies}</span>
            </div>
          </div>
          <div style={{ ...panel, maxHeight: 420, overflow: 'auto' }}>
            <strong>Bitacora</strong>
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', fontFamily: mono, fontSize: 12, color: '#c7d2e8' }}>
              {log.length === 0 ? <li style={{ color: '#8b98b8' }}>Sin eventos todavia.</li> : null}
              {log.map((line, index) => (
                <li key={index} style={{ padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <p style={{ color: '#8b98b8', fontSize: 12, marginTop: 16, maxWidth: 940 }}>
        Setenta y dos meses (2020-2025) con demanda, bolsa, escasez, embalse y aportes reales de XM. Ocho
        generadores ofertan su cartera cada mes; cuatro comercializadores sirven su demanda con contratos y
        bolsa. El operador despacha por merito y el marginal lo cobran todos. El clima es exogeno: el embalse
        real limita la hidro, y la sequia de 2024 aprieta. Gana quien termina con al menos un generador solvente.
      </p>
    </main>
  );
}
