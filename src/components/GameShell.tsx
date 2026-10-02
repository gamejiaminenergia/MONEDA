'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ControlBar, type ModelOption } from '@/components/ControlBar';
import { DebugPanel } from '@/components/DebugPanel';
import { ModelBoard } from '@/components/ModelBoard';
import { Stage } from '@/components/Stage';
import { Standings, type Status } from '@/components/Standings';
import { StatsBar } from '@/components/StatsBar';
import { TeamCard } from '@/components/TeamCard';
import { useEngineUi } from '@/hooks/useEngineUi';
import { useGameSettings } from '@/hooks/useGameSettings';
import { useModelStats } from '@/hooks/useModelStats';
import type { DecisionResponse } from '@/lib/ai/contracts';
import { SoundBoard } from '@/lib/client/audio';
import { DecisionLoop } from '@/lib/client/decision-loop';
import { BoardRenderer } from '@/lib/client/renderer';
import { HEURISTIC_MODEL, defaultSettings } from '@/lib/client/settings';
import { GameEngine } from '@/lib/game/engine';
import { buildStatePrompt } from '@/lib/game/prompt';
import { SIDES, type Side } from '@/lib/game/sides';
import type { GameEvent, GameSnapshot } from '@/lib/game/types';

interface ModelsPayload {
  reachable: boolean;
  url: string;
  models: ModelOption[];
  error: string | null;
}

async function fetchModels(signal?: AbortSignal): Promise<ModelsPayload> {
  const response = await fetch('/api/models', { cache: 'no-store', ...(signal ? { signal } : {}) });
  return (await response.json()) as ModelsPayload;
}

async function requestDecision(signal: AbortSignal, body: unknown): Promise<DecisionResponse> {
  const response = await fetch('/api/decision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `El servidor respondio ${response.status}`);
  }
  return (await response.json()) as DecisionResponse;
}

export function GameShell() {
  const [engine] = useState(() => new GameEngine({ lives: defaultSettings.lives }));
  const ui = useEngineUi(engine);
  const { settings, update } = useGameSettings();
  const { stats: modelStats, record, recordMaxRally, reset: resetStats } = useModelStats();
  const { model: modelId, lives } = settings;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sound] = useState(() => new SoundBoard(defaultSettings.muted));
  const activeModelRef = useRef<string>(HEURISTIC_MODEL);
  const lastSnapshotRef = useRef<GameSnapshot | null>(null);
  const settingsRef = useRef(settings);

  const [status, setStatus] = useState<Status>({ text: 'conectando…', kind: 'loading' });
  const [models, setModels] = useState<ModelOption[]>([]);
  const [ollama, setOllama] = useState({ url: '—', reachable: false });
  const [debug, setDebug] = useState({ snapshot: '', response: '' });

  /* ------------------------------ preferencias ---------------------------- */

  useEffect(() => {
    sound.setMuted(settings.muted);
  }, [sound, settings.muted]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const unlock = () => sound.unlock();
    document.addEventListener('pointerdown', unlock, { once: true });
    return () => document.removeEventListener('pointerdown', unlock);
  }, [sound]);

  /* --------------------------- estado de Ollama --------------------------- */

  const applyModels = useCallback((payload: ModelsPayload) => {
    setModels(payload.models);
    setOllama({ url: payload.url, reachable: payload.reachable });
    setStatus((current) =>
      current.kind === 'err'
        ? {
            text: payload.reachable ? 'conectado' : (payload.error ?? 'sin conexión'),
            kind: payload.reachable ? 'on' : 'err',
          }
        : current,
    );
  }, []);

  const refreshModels = useCallback(async () => {
    try {
      applyModels(await fetchModels());
    } catch {
      setOllama((current) => ({ ...current, reachable: false }));
      setStatus({ text: 'sin conexión con el servidor', kind: 'err' });
    }
  }, [applyModels]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async (): Promise<void> => {
      try {
        const payload = await fetchModels(controller.signal);
        if (!controller.signal.aborted) applyModels(payload);
      } catch {
        // el servidor de Next puede no estar listo todavia; se reintenta solo
      }
    };
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [applyModels]);

  /* --------------------------- bucle de simulacion ------------------------ */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new BoardRenderer(canvas);

    const playEvent = (event: GameEvent): void => {
      switch (event.type) {
        case 'paddle-hit':
          sound.beep(520 + SIDES.indexOf(event.side) * 60, 0.05, 'square', 0.04);
          break;
        case 'wall':
          sound.beep(300, 0.03, 'square', 0.02);
          break;
        case 'life-lost':
          sound.beep(200, 0.16, 'sawtooth', 0.05);
          break;
        case 'death':
          sound.beep(140, 0.5, 'sawtooth', 0.07);
          window.setTimeout(() => sound.beep(70, 0.7, 'sawtooth', 0.07), 160);
          break;
        case 'game-over':
          sound.beep(660, 0.12, 'sine', 0.06);
          window.setTimeout(() => sound.beep(880, 0.18, 'sine', 0.06), 130);
          break;
        default:
          break;
      }
    };

    let frame = 0;
    let last = performance.now();

    const tick = (now: number): void => {
      const dt = Math.min(now - last, 50);
      last = now;

      const events = engine.step(dt);
      for (const event of events) {
        renderer.pushEvent(event, now);
        playEvent(event);
        if (event.type === 'paddle-hit') {
          recordMaxRally(activeModelRef.current, event.rally);
        }
      }

      renderer.draw(engine.view(), now);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      renderer.destroy();
    };
  }, [engine, recordMaxRally, sound]);

  /* --------------------------- bucle de decisiones ------------------------ */

  /**
   * Config vigente leida en cada vuelta. Asi el bucle no se reinicia (ni
   * cancela la peticion en curso) mientras arrastras el deslizador de intervalo.
   */
  const decide = useCallback(
    (snapshot: GameSnapshot, signal: AbortSignal): Promise<DecisionResponse> => {
      const { model, strategy: currentStrategy } = settingsRef.current;
      lastSnapshotRef.current = snapshot;
      return requestDecision(signal, {
        snapshot,
        model: model === HEURISTIC_MODEL ? HEURISTIC_MODEL : model,
        strategy: currentStrategy,
      });
    },
    [],
  );

  useEffect(() => {
    const loop = new DecisionLoop({
      engine,
      intervalMs: () => settingsRef.current.intervalMs,
      request: decide,
      onResult: (result, roundTripMs) => {
        activeModelRef.current = result.model;
        record(result.model, {
          decisions: 1,
          latencyMs: result.latencyMs,
          fallbacks: result.fallbackReason ? 1 : 0,
        });
        setStatus(
          result.strategy === 'model'
            ? { text: `conectado · ${result.model} · ${result.latencyMs} ms`, kind: 'on' }
            : result.fallbackReason
              ? { text: `respaldo local · ${result.fallbackReason}`, kind: 'pause' }
              : { text: `heurístico local · ${Math.round(roundTripMs)} ms`, kind: 'on' },
        );
        setDebug({
          snapshot: lastSnapshotRef.current ? buildStatePrompt(lastSnapshotRef.current) : '',
          response: JSON.stringify(result, null, 2),
        });
      },
      onError: (message) => setStatus({ text: message, kind: 'err' }),
      onIdle: () => {
        if (engine.finished) return;
        setStatus((current) => (current.kind === 'pause' ? current : { text: 'en pausa', kind: 'pause' }));
      },
    });

    loop.start();
    return () => loop.stop();
  }, [decide, engine, record]);

  /* ------------------------------- acciones ------------------------------- */

  const restart = useCallback(() => {
    engine.reset({ lives: settingsRef.current.lives });
    setStatus({ text: 'partida nueva · 4 equipos vivos', kind: 'on' });
  }, [engine]);

  useEffect(() => {
    if (engine.startingLives !== lives) engine.reset({ lives });
  }, [engine, lives]);

  const togglePause = useCallback(() => {
    engine.togglePause();
    const paused = engine.isPaused;
    setStatus(paused ? { text: 'en pausa', kind: 'pause' } : { text: 'conectado', kind: 'on' });
  }, [engine]);

  const clearStats = resetStats;

  const setDebugOpen = useCallback(
    (open: boolean) => {
      update({ showDebug: open });
      if (open) {
        setDebug((current) => ({
          snapshot: current.snapshot || (lastSnapshotRef.current ? buildStatePrompt(lastSnapshotRef.current) : ''),
          response: current.response,
        }));
      }
    },
    [update],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const element = event.target as HTMLElement | null;
      if (element && (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA')) return;
      const key = event.key.toLowerCase();
      if (event.code === 'Space' || key === ' ') {
        event.preventDefault();
        togglePause();
      } else if (key === 'r') restart();
      else if (key === 'm') update({ muted: !settings.muted });
      else if (key === 'd') setDebugOpen(!settings.showDebug);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [restart, setDebugOpen, togglePause, update, settings.muted, settings.showDebug]);

  const aliveCount = ui.aliveCount;
  const activeModel = ui.lastSource === 'model' ? modelId : HEURISTIC_MODEL;

  return (
    <div id="app">
      <div className="layout">
        <section className="board-col">
          <h1>
            NIMBLE <span>PONG</span>
            <small>· 4 EQUIPOS · MUERE A LAS {ui.startingLives}</small>
          </h1>
          <Standings sides={ui.sides} startingLives={ui.startingLives} status={status} />
          <Stage
            canvasRef={canvasRef}
            thinking={ui.thinking}
            paused={ui.paused}
            winner={ui.winner}
            decisions={ui.decisions}
            avgLatencyMs={ui.avgLatencyMs}
            onRestart={restart}
          />
          <p className="hint">
            <kbd>espacio</kbd> pausa · <kbd>R</kbd> reiniciar · <kbd>M</kbd> sonido · <kbd>D</kbd> debug
          </p>
        </section>

        <aside className="hud-col">
          <div id="cards">
            {SIDES.map((side: Side) => (
              <TeamCard key={side} side={side} state={ui.sides[side]} />
            ))}
          </div>

          <StatsBar
            decisions={ui.decisions}
            avgLatencyMs={ui.avgLatencyMs}
            rally={ui.rally}
            maxRally={ui.maxRally}
            points={ui.points}
            aliveCount={aliveCount}
          />

          <ModelBoard stats={modelStats} activeModel={activeModel} />

          <ControlBar
            settings={settings}
            onChange={update}
            models={models}
            ollamaUrl={ollama.url}
            ollamaReachable={ollama.reachable}
            paused={ui.paused}
            onTogglePause={togglePause}
            onRestart={restart}
            onClearStats={clearStats}
            onRefreshModels={() => void refreshModels()}
          />

          <DebugPanel
            open={settings.showDebug}
            onToggle={setDebugOpen}
            snapshot={debug.snapshot}
            response={debug.response}
          />
        </aside>
      </div>
    </div>
  );
}
