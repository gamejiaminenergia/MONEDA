'use client';

interface DebugPanelProps {
  open: boolean;
  onToggle: (open: boolean) => void;
  snapshot: string;
  response: string;
}

export function DebugPanel({ open, onToggle, snapshot, response }: DebugPanelProps) {
  return (
    <details
      className="debugbox"
      open={open}
      onToggle={(event) => onToggle(event.currentTarget.open)}
    >
      <summary>estado enviado y respuesta del servidor</summary>
      <pre>
        ESTADO:
        {'\n'}
        {snapshot || '—'}
        {'\n\n'}
        RESPUESTA:
        {'\n'}
        {response || '—'}
      </pre>
    </details>
  );
}
