'use client';

import { useBolsa } from '@/hooks/useBolsa';
import { SCENARIOS } from '@/lib/bolsa/scenario';

import { Bitacora } from './Bitacora';
import { ComercializadorCard, GeneratorCard } from './AgentCards';
import { EmbalsesPanel } from './EmbalsesPanel';
import { MeritTower } from './MeritTower';
import { PriceChart } from './PriceChart';
import { ScoreBoard } from './ScoreBoard';
import { Stat } from './Stat';
import { panel } from './styles';

/**
 * Vista (MVC): solo pinta. El estado y las acciones vienen del controlador
 * (`useBolsa`); aqui no hay logica de negocio ni acceso a la red.
 */
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

  return (
    <main style={{ minHeight: '100vh', background: '#0a0e17', color: '#e8eefc', padding: 20, fontFamily: 'system-ui, Segoe UI, Roboto, sans-serif' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>
          BOLSA <span style={{ fontSize: 12, color: '#8b98b8' }}>mensual 2020-2025</span>
        </h1>
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
        <Stat label="Embalse" value={`${(market.embalsePct * 100).toFixed(0)}%`} accent="#2ee6c5" />
        {market.winner ? <Stat label="Ganador" value={market.winner === 'agentes' ? 'AGENTES' : 'ESCASEZ'} accent={market.winner === 'agentes' ? '#38ff9c' : '#ff5c5c'} /> : null}
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <button onClick={() => setRunning(!running)} disabled={market.finished} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: running ? '#ff5c5c' : '#38ff9c', color: '#0a0e17', fontWeight: 700, cursor: 'pointer' }}>
          {running ? 'Pausar' : 'Jugar'}
        </button>
        <button onClick={() => void tick()} disabled={running || market.finished} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#e8eefc', cursor: 'pointer' }}>
          Paso (1 mes)
        </button>
        <button onClick={() => reset(scenarioId)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#e8eefc', cursor: 'pointer' }}>
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
          <ScoreBoard score={market.score} />
          <Bitacora log={log} />
        </div>
      </div>

      <p style={{ color: '#8b98b8', fontSize: 12, marginTop: 16, maxWidth: 940 }}>
        Setenta y dos meses (2020-2025) con demanda, bolsa, escasez, embalse y aportes reales de XM. Ocho generadores ofertan su
        cartera cada mes; cuatro comercializadores sirven su demanda con contratos y bolsa. El operador despacha por merito y el
        marginal lo cobran todos. El clima es exogeno: el embalse real limita la hidro, y la sequia de 2024 aprieta. Gana quien
        termina con al menos un generador solvente.
      </p>
    </main>
  );
}
