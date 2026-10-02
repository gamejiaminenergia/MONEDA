'use client';

import { MAX_INTERVAL_MS, MIN_INTERVAL_MS } from '@/lib/game/constants';
import { HEURISTIC_MODEL, type GameSettings, type Strategy } from '@/lib/client/settings';

export interface ModelOption {
  name: string;
  parameterSize: string | null;
}

interface ControlBarProps {
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
  models: ModelOption[];
  ollamaUrl: string;
  ollamaReachable: boolean;
  paused: boolean;
  onTogglePause: () => void;
  onRestart: () => void;
  onClearStats: () => void;
  onRefreshModels: () => void;
}

/** Vidas por equipo: al perder la ultima, el equipo muere. */
const LIVES = [3, 5, 10, 20];

const label = (model: ModelOption): string =>
  model.parameterSize ? `${model.name} · ${model.parameterSize}` : model.name;

export function ControlBar({
  settings,
  onChange,
  models,
  ollamaUrl,
  ollamaReachable,
  paused,
  onTogglePause,
  onRestart,
  onClearStats,
  onRefreshModels,
}: ControlBarProps) {
  const options: ModelOption[] = [{ name: HEURISTIC_MODEL, parameterSize: null }, ...models];
  if (!options.some((model) => model.name === settings.model)) {
    options.push({ name: settings.model, parameterSize: null });
  }

  return (
    <div className="controls">
      <label>
        modelo
        <select value={settings.model} onChange={(event) => onChange({ model: event.target.value })}>
          <option value={HEURISTIC_MODEL}>heurístico (local)</option>
          {options
            .filter((model) => model.name !== HEURISTIC_MODEL)
            .map((model) => (
              <option key={model.name} value={model.name}>
                {label(model)}
              </option>
            ))}
        </select>
      </label>

      <label>
        estrategia
        <select
          value={settings.strategy}
          onChange={(event) => onChange({ strategy: event.target.value as Strategy })}
        >
          <option value="auto">auto (modelo, respaldo local)</option>
          <option value="model">solo modelo</option>
          <option value="heuristic">solo heurístico</option>
        </select>
      </label>

      <label>
        decidir cada
        <input
          type="range"
          min={MIN_INTERVAL_MS}
          max={MAX_INTERVAL_MS}
          step={100}
          value={settings.intervalMs}
          onChange={(event) => onChange({ intervalMs: Number(event.target.value) })}
        />
        <span>{settings.intervalMs} ms</span>
      </label>

      <label>
        muere a las
        <select value={settings.lives} onChange={(event) => onChange({ lives: Number(event.target.value) })}>
          {LIVES.map((lives) => (
            <option key={lives} value={lives}>
              {lives} derrotas
            </option>
          ))}
        </select>
      </label>

      <button type="button" className={paused ? 'active' : ''} onClick={onTogglePause}>
        {paused ? 'reanudar' : 'pausa'}
      </button>
      <button type="button" onClick={onRestart}>
        reiniciar
      </button>
      <button
        type="button"
        className={settings.muted ? '' : 'active'}
        onClick={() => onChange({ muted: !settings.muted })}
      >
        {settings.muted ? '🔇' : '🔊'}
      </button>
      <button type="button" onClick={onClearStats} title="borrar la comparativa de modelos">
        borrar comparativa
      </button>
      <button type="button" onClick={onRefreshModels} title="volver a consultar los modelos de Ollama">
        ↻ modelos
      </button>

      <span className={`hintline ${ollamaReachable ? 'ok' : 'off'}`}>
        ollama {ollamaReachable ? 'ok' : 'sin conexión'} · {ollamaUrl}
      </span>
    </div>
  );
}
