'use client';

import { useState } from 'react';

import type { TraceRecordView, TraceSummaryView } from '@/hooks/useTrace';
import { formatTokens, formatUsd } from '@/lib/ai/pricing';

interface ModelConsoleProps {
  open: boolean;
  onClose: () => void;
  records: TraceRecordView[];
  summary: TraceSummaryView | null;
  error: string | null;
  live: boolean;
  onClear: () => void;
}

type Tab = 'peticion' | 'prompt' | 'respuesta' | 'jugadas';

const TABS: { id: Tab; label: string }[] = [
  { id: 'peticion', label: 'json peticion' },
  { id: 'prompt', label: 'prompt' },
  { id: 'respuesta', label: 'json respuesta' },
  { id: 'jugadas', label: 'jugadas' },
];

const clockOf = (at: number): string => {
  const date = new Date(at);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const pretty = (value: unknown): string => JSON.stringify(value, null, 2);

function download(records: TraceRecordView[]): void {
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `nimble-traza-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Consola del modelo: el JSON exacto que sale hacia TypeSafe, el JSON exacto
 * que vuelve, la jugada normalizada, los tokens y el costo.
 *
 * Se alimenta del stream (`/api/trace/stream`), asi que la ultima peticion
 * aparece sin recargar. Mientras no fijes una, la consola sigue la mas reciente.
 */
export function ModelConsole({ open, onClose, records, summary, error, live, onClear }: ModelConsoleProps) {
  const [pinnedId, setPinnedId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('peticion');
  const [copied, setCopied] = useState(false);

  const following = pinnedId === null;
  const selected = following
    ? (records[0] ?? null)
    : (records.find((record) => record.id === pinnedId) ?? records[0] ?? null);
  const perHour = summary?.costPerHourUsd ?? null;
  const avgLatency = summary?.avgLatencyMs ?? null;

  const currentText = (): string => {
    if (!selected) return '';
    if (tab === 'peticion') return pretty(selected.request);
    if (tab === 'prompt') return selected.request.state;
    if (tab === 'respuesta') return selected.response === null ? (selected.message ?? '') : pretty(selected.response);
    return pretty({ moves: selected.moves, questions: selected.request.questions });
  };

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(currentText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Sin permiso de portapapeles no pasa nada: el JSON se sigue viendo.
    }
  };

  return (
    <aside className="console" data-open={open} aria-hidden={!open}>
      <div className="console-head">
        <div className="console-title">
          consola del modelo
          <span className="console-note">
            {live ? (
              <>
                <span className="live-dot" aria-hidden="true" /> en vivo · peticion y respuesta
              </>
            ) : (
              'peticion y respuesta'
            )}
          </span>
        </div>

        <div className="console-summary">
          <span>
            <b>{summary?.requests ?? 0}</b> peticiones
          </span>
          <span>
            <b>{formatTokens(summary?.inputTokens ?? null)}</b> tokens in
          </span>
          <span>
            <b>{formatUsd(summary?.costUsd ?? null)}</b> costo
          </span>
          <span>
            <b>{perHour === null ? '—' : `${formatUsd(perHour)}/h`}</b> ritmo
          </span>
          <span>
            <b>{avgLatency === null ? '—' : `${avgLatency} ms`}</b> latencia
          </span>
          {summary && summary.errors > 0 ? (
            <span className="console-errors">
              <b>{summary.errors}</b> errores
            </span>
          ) : null}
        </div>

        <div className="console-actions">
          {!following ? (
            <button type="button" className="btn ghost active" onClick={() => setPinnedId(null)}>
              volver a en vivo
            </button>
          ) : null}
          <button type="button" className="btn ghost" onClick={() => void copy()} disabled={!selected}>
            {copied ? 'copiado' : 'copiar'}
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => download(records)}
            disabled={records.length === 0}
          >
            exportar
          </button>
          <button type="button" className="btn ghost" onClick={onClear} disabled={records.length === 0}>
            limpiar
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            cerrar
          </button>
        </div>
      </div>

      <div className="console-body">
        {error ? <p className="console-empty">{error}</p> : null}

        {!error && records.length === 0 ? (
          <p className="console-empty">
            sin peticiones todavia. La consola guarda cada decision; si la traza esta apagada
            (control inferior) no se registra ninguna.
          </p>
        ) : null}

        {records.length > 0 ? (
          <>
            <ol className="console-list">
              {records.map((record, index) => (
                <li key={record.id}>
                  <button
                    type="button"
                    className="console-item"
                    data-selected={record.id === selected?.id}
                    data-status={record.status}
                    data-newest={index === 0}
                    onClick={() => setPinnedId(record.id)}
                  >
                    <span className="ci-time">{clockOf(record.at)}</span>
                    <span className="ci-model">{record.answeredModel ?? record.model}</span>
                    <span className="ci-latency">{record.latencyMs} ms</span>
                    <span className="ci-tokens">{formatTokens(record.usage.inputTokens)} tok</span>
                    <span className="ci-cost">
                      {record.status === 'ok' ? formatUsd(record.costUsd) : 'error'}
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            <div className="console-detail">
              {selected ? (
                <>
                  <div className="console-tabs">
                    {TABS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="tab"
                        data-active={tab === item.id}
                        onClick={() => setTab(item.id)}
                      >
                        {item.label}
                      </button>
                    ))}
                    <span className="console-detail-meta">
                      {selected.alive} vivos · reloj {(selected.clockMs / 1000).toFixed(1)} s ·{' '}
                      {formatTokens(selected.usage.inputTokens)} in
                      {selected.usage.outputTokens === null
                        ? ''
                        : ` / ${formatTokens(selected.usage.outputTokens)} out`}{' '}
                      · {formatUsd(selected.costUsd)}
                    </span>
                  </div>

                  <pre className="code">{currentText()}</pre>
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
}
