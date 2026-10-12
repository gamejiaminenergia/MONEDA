import { mono, panel } from './styles';

/** Bitacora de eventos de la partida. */
export function Bitacora({ log }: { log: string[] }) {
  return (
    <div style={{ ...panel, maxHeight: 420, overflow: 'auto' }}>
      <strong>Bitacora</strong>
      <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', fontFamily: mono, fontSize: 12, color: '#c7d2e8' }}>
        {log.length === 0 ? <li style={{ color: '#8b98b8' }}>Sin eventos todavia.</li> : null}
        {log.map((line, index) => (
          <li key={index} style={{ padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
