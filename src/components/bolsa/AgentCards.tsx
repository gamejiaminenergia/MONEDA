import { availabilityFactor } from '@/lib/bolsa/hydrology';
import type { Agent, Resource } from '@/lib/bolsa/types';

import { TYPE_SHORT, panel } from './styles';

/** Ficha de un generador: su cartera, disponibilidad y caja. */
export function GeneratorCard({ agent, resources, embalsePct }: { agent: Agent; resources: Resource[]; embalsePct: number }) {
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
              <span style={{ color: '#8b98b8' }}>
                {TYPE_SHORT[resource.type]} {disponible}/{Math.round(resource.capacityGwh)} GWh · {Math.round(resource.cost)} COP
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Ficha de un comercializador: cobertura, exposicion y riesgo de bolsa. */
export function ComercializadorCard({ agent, weight, marginal }: { agent: Agent; weight: number; marginal: number | null }) {
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
