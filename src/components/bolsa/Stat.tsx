import { mono } from './styles';

/** Una cifra grande del encabezado. */
export function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#8b98b8', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ?? '#e8eefc', fontFamily: mono }}>{value}</div>
    </div>
  );
}
