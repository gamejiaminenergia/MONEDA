'use client';

import type { GameSettings } from '@/lib/client/settings';
import type { Theme } from '@/lib/client/theme';
import {
  BALL_SPEED_STEP,
  MAX_BALL_SPEED,
  MAX_INTERVAL_MS,
  MIN_BALL_SPEED,
  MIN_INTERVAL_MS,
} from '@/lib/game/constants';

export interface ModelOption {
  name: string;
  parameterSize: string | null;
  /** TypeSafe describe sus modelos; se usa como etiqueta secundaria. */
  description?: string | null;
}

/** Estado de TypeSafe, resuelto por el servidor en `/api/models`. */
export interface ProviderStatus {
  url: string;
  reachable: boolean;
  configured: boolean;
  error: string | null;
}

interface GameControlsProps {
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
  models: ModelOption[];
  provider: ProviderStatus;
  theme: Theme;
  paused: boolean;
  onTogglePause: () => void;
  onRestart: () => void;
  onClearStats: () => void;
  onClearScore: () => void;
  onRefreshModels: () => void;
  onToggleTheme: () => void;
}

const label = (model: ModelOption): string =>
  model.parameterSize ? `${model.name} · ${model.parameterSize}` : model.name;

/** Barra inferior: lo que el jugador puede tocar sin salir de la partida. */
export function GameControls({
  settings,
  onChange,
  models,
  provider,
  theme,
  paused,
  onTogglePause,
  onRestart,
  onClearStats,
  onClearScore,
  onRefreshModels,
  onToggleTheme,
}: GameControlsProps) {
  const options: ModelOption[] = [...models];
  if (!options.some((model) => model.name === settings.model)) {
    options.push({ name: settings.model, parameterSize: null });
  }

  const providerHint = !provider.configured
    ? `typesafe sin configurar · ${provider.url}`
    : provider.reachable
      ? `typesafe ok · ${provider.url}`
      : `typesafe sin conexion · ${provider.url}`;

  return (
    <footer className="controls">
      <div className="ctrl">
        <label className="ctrl-label" htmlFor="ctrl-model">
          modelo
        </label>
        <select
          id="ctrl-model"
          value={settings.model}
          onChange={(event) => onChange({ model: event.target.value })}
        >
          {options.map((model) => (
            <option key={model.name} value={model.name} title={model.description ?? undefined}>
              {label(model)}
            </option>
          ))}
        </select>
      </div>

      <div className="ctrl ctrl-range">
        <label className="ctrl-label" htmlFor="ctrl-interval">
          decidir cada
        </label>
        <input
          id="ctrl-interval"
          type="range"
          min={MIN_INTERVAL_MS}
          max={MAX_INTERVAL_MS}
          step={100}
          value={settings.intervalMs}
          onChange={(event) => onChange({ intervalMs: Number(event.target.value) })}
        />
        <span className="ctrl-value">{settings.intervalMs} ms</span>
      </div>

      <div className="ctrl ctrl-range">
        <label className="ctrl-label" htmlFor="ctrl-ball">
          velocidad bola
        </label>
        <input
          id="ctrl-ball"
          type="range"
          min={MIN_BALL_SPEED}
          max={MAX_BALL_SPEED}
          step={BALL_SPEED_STEP}
          value={settings.ballSpeed}
          onChange={(event) => onChange({ ballSpeed: Number(event.target.value) })}
        />
        <span className="ctrl-value">{settings.ballSpeed} px/s</span>
      </div>

      <div className="ctrl-group">
        <button type="button" className={`btn ${paused ? 'active' : ''}`} onClick={onTogglePause}>
          {paused ? 'reanudar' : 'pausa'}
        </button>
        <button type="button" className="btn" onClick={onRestart}>
          reiniciar
        </button>
        <button
          type="button"
          className={`btn ${settings.muted ? '' : 'active'}`}
          onClick={() => onChange({ muted: !settings.muted })}
          title="sonido"
        >
          {settings.muted ? 'sonido off' : 'sonido on'}
        </button>
      </div>

      <div className="ctrl-group">
        <button type="button" className="btn ghost" onClick={onClearStats}>
          borrar comparativa
        </button>
        <button type="button" className="btn ghost" onClick={onClearScore}>
          borrar marcador
        </button>
        <button type="button" className="btn ghost" onClick={onRefreshModels}>
          refrescar modelos
        </button>
        <button
          type="button"
          className={`btn ghost ${settings.trace ? 'active' : ''}`}
          onClick={() => onChange({ trace: !settings.trace })}
          title="guardar cada peticion para la consola del modelo"
        >
          traza {settings.trace ? 'on' : 'off'}
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={onToggleTheme}
          title="cambiar entre modo claro y oscuro"
        >
          {theme === 'light' ? 'modo oscuro' : 'modo claro'}
        </button>
      </div>

      <span className={`hintline ${provider.configured && provider.reachable ? 'ok' : 'off'}`} title={provider.error ?? undefined}>
        {providerHint}
      </span>
    </footer>
  );
}
