'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { GameControls, type ModelOption, type ProviderStatus } from '@/components/GameControls';
import { LiveStats } from '@/components/LiveStats';
import { ModelConsole } from '@/components/ModelConsole';
import { ModelPanel } from '@/components/ModelPanel';
import { PlayerRail } from '@/components/PlayerRail';
import { Stage } from '@/components/Stage';
import { TopBar } from '@/components/TopBar';
import { useEngineUi } from '@/hooks/useEngineUi';
import { useGameSettings } from '@/hooks/useGameSettings';
import { useModelStats } from '@/hooks/useModelStats';
import { useTheme } from '@/hooks/useTheme';
import { useTrace } from '@/hooks/useTrace';
import type { DecisionResponse } from '@/lib/ai/contracts';
import { createBoard, type BoardHandle } from '@/lib/client/board/board';
import { DecisionLoop } from '@/lib/client/decision-loop';
import { MatchRecorder, SAMPLE_MS } from '@/lib/client/match-recorder';
import { discardMatch, submitMatch } from '@/lib/client/matches';
import { defaultSettings } from '@/lib/client/settings';
import type { Status } from '@/lib/client/ui';
import { AUTO_RESTART_MS, SURVIVAL_MS } from '@/lib/game/constants';
import { GameEngine } from '@/lib/game/engine';
import { PLAYERS, type Player } from '@/lib/game/players';
import type { GameEvent, GameSnapshot, PlayerRecord } from '@/lib/game/types';

/** Cuantas peticiones pide la consola cuando esta abierta. */
const CONSOLE_RECORDS = 30;

interface ModelsPayload {
  reachable: boolean;
  configured: boolean;
  url: string;
  defaultModel: string;
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

const emptyWins = (): PlayerRecord<number> =>
  Object.fromEntries(PLAYERS.map((player) => [player, 0])) as PlayerRecord<number>;

export function GameShell() {
  const [engine] = useState(() => new GameEngine());
  // Junta la telemetria de la ronda en curso; solo se guarda si llega al minuto.
  const [recorder] = useState(() => new MatchRecorder());
  const ui = useEngineUi(engine);
  const { settings, update } = useGameSettings();
  const { theme, toggle: toggleTheme } = useTheme();
  const { stats: modelStats, record, recordSurvival, reset: resetStats } = useModelStats();
  const { model: modelId } = settings;

  const boardRef = useRef<HTMLDivElement | null>(null);
  const boardHandleRef = useRef<BoardHandle | null>(null);
  const activeModelRef = useRef<string>(defaultSettings.model);
  /** Modelos del catalogo ya cargado: evita mandar un nombre que no existe. */
  const modelsRef = useRef<Set<string>>(new Set());
  const themeRef = useRef(theme);
  const settingsRef = useRef(settings);

  const [status, setStatus] = useState<Status>({ text: 'conectando…', kind: 'loading' });
  const [models, setModels] = useState<ModelOption[]>([]);
  const [provider, setProvider] = useState<ProviderStatus>({
    url: '—',
    reachable: false,
    configured: false,
    error: null,
  });
  const [wins, setWins] = useState<PlayerRecord<number>>(emptyWins);
  const [round, setRound] = useState(1);
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  /** Segundos que faltan para la tregua (el minuto). `null` si no hay ronda. */
  const [survivalSec, setSurvivalSec] = useState<number | null>(null);
  /** El numero de ronda para el historico: `onEvent` no ve el estado de React. */
  const roundRef = useRef(round);
  /**
   * Identidad de la partida en curso. Viaja en cada `/api/decision` para que el
   * servidor archive las peticiones/respuestas de Jev bajo esta partida, y es la
   * misma que lleva el documento que se guarda al final.
   */
  const matchIdRef = useRef<string>(crypto.randomUUID());

  /* ------------------------------ preferencias ---------------------------- */

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  /**
   * Muestreo de la mesa para el historico: una foto cada `SAMPLE_MS` mientras
   * la ronda corre. Guarda posiciones, no dibuja, y no toca React.
   */
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (engine.finished || engine.isPaused) return;
      recorder.sample(engine.view());
    }, SAMPLE_MS);
    return () => window.clearInterval(timer);
  }, [engine, recorder]);

  /**
   * Cuenta atras visible hacia la tregua: lee el reloj del motor cada 250 ms
   * (React no corre a 60 fps) y solo cambia cuando cambia el segundo.
   */
  useEffect(() => {
    const tick = (): void => {
      if (engine.finished || engine.isPaused) {
        setSurvivalSec(null);
        return;
      }
      const remaining = Math.max(0, SURVIVAL_MS - engine.view().clockMs);
      setSurvivalSec(Math.ceil(remaining / 1000));
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [engine]);

  /** El silencio viaja a la escena sin recrearla. */
  useEffect(() => {
    boardHandleRef.current?.setMuted(settings.muted);
  }, [settings.muted]);

  /** La velocidad de la bola se ajusta en vivo desde el panel. */
  useEffect(() => {
    engine.setBallSpeed(settings.ballSpeed);
  }, [engine, settings.ballSpeed]);

  /** El tema viaja al lienzo de Phaser sin recrear la escena. */
  useEffect(() => {
    themeRef.current = theme;
    boardHandleRef.current?.setTheme(theme);
  }, [theme]);

  /* --------------------------- estado de TypeSafe ------------------------- */

  const applyModels = useCallback(
    (payload: ModelsPayload) => {
      setModels(payload.models);
      modelsRef.current = new Set(payload.models.map((model) => model.name));
      setProvider({
        url: payload.url,
        reachable: payload.reachable,
        configured: payload.configured,
        error: payload.error,
      });
      // Si el modelo guardado ya no existe (p.ej. se retiro), se pasa al
      // modelo por defecto del proveedor.
      const currentModel = settingsRef.current.model;
      if (payload.models.length > 0 && !payload.models.some((model) => model.name === currentModel)) {
        update({ model: payload.defaultModel });
      }
      setStatus((current) =>
        current.kind === 'err'
          ? {
              text: payload.reachable ? 'conectado' : (payload.error ?? 'sin conexión'),
              kind: payload.reachable ? 'on' : 'err',
            }
          : current,
      );
    },
    [update],
  );

  const refreshModels = useCallback(async () => {
    try {
      applyModels(await fetchModels());
    } catch {
      setProvider((current) => ({ ...current, reachable: false }));
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

  /* ------------------------- consola del modelo --------------------------- */

  // El HUD solo necesita el resumen (barato); la consola pide las peticiones.
  const hudTrace = useTrace({ limit: 0, intervalMs: 3000 });
  const consoleTrace = useTrace({
    limit: CONSOLE_RECORDS,
    live: true,
    enabled: settings.showConsole,
  });

  /**
   * Cierra la partida en curso y abre una nueva. `discard` libera las llamadas
   * a Jev archivadas: no se pide en la tregua, donde el POST ya las tomo.
   */
  const rotateMatch = useCallback((discard: boolean) => {
    if (discard) void discardMatch(matchIdRef.current);
    matchIdRef.current = crypto.randomUUID();
  }, []);

  /* --------------------------- bucle de simulacion ------------------------ */

  useEffect(() => {
    const parent = boardRef.current;
    if (!parent) return;

    let cancelled = false;
    let handle: BoardHandle | null = null;

    // La escena de Phaser corre su propio bucle: avanza el motor, dibuja y
    // sintetiza el audio. Aqui solo se atiende el final de ronda.
    void createBoard({
      parent,
      engine,
      muted: settingsRef.current.muted,
      theme: themeRef.current,
      onEvent: (event: GameEvent) => {
        recorder.note(event, engine.view().clockMs);

        // Tregua: se aguanto el minuto, reviven los muertos y gana la mesa
        // entera. Es la UNICA partida que se guarda: la ronda completa. Las que
        // terminan antes (ganador o grilla) se descartan.
        if (event.type === 'truce') {
          recordSurvival(activeModelRef.current, engine.ui().clockMs);
          setWins((current) =>
            Object.fromEntries(
              PLAYERS.map((player) => [player, current[player] + 1]),
            ) as PlayerRecord<number>,
          );
          const stats = engine.ui();
          const document = recorder.finish(
            {
              round: roundRef.current,
              outcome: 'truce',
              winner: null,
              model: activeModelRef.current,
              intervalMs: settingsRef.current.intervalMs,
              snapshot: engine.snapshot(),
              stats,
            },
            matchIdRef.current,
          );
          void submitMatch(document);
          recorder.reset();
          // El POST ya tomo las llamadas de Jev: no hay que descartar nada.
          rotateMatch(false);
          return;
        }

        if (event.type !== 'game-over') return;
        recordSurvival(activeModelRef.current, event.winner === null ? 0 : engine.ui().clockMs);
        if (event.winner) {
          const champion: Player = event.winner;
          setWins((current) => ({ ...current, [champion]: current[champion] + 1 }));
        }
        // No llego al minuto: no es una partida completa y no se guarda. Se
        // sueltan sus llamadas a Jev y se abre la partida siguiente.
        recorder.reset();
        rotateMatch(true);
      },
    }).then((created) => {
      // StrictMode monta dos veces en desarrollo: si este efecto ya se limpio,
      // el juego se destruye en el acto y no quedan dos canvas.
      if (cancelled) {
        created.destroy();
        return;
      }
      handle = created;
      created.setMuted(settingsRef.current.muted);
      created.setTheme(themeRef.current);
      boardHandleRef.current = created;
    });

    return () => {
      cancelled = true;
      handle?.destroy();
      boardHandleRef.current = null;
    };
  }, [engine, recordSurvival, recorder, rotateMatch]);

  /* ---------------------------- bucle infinito ---------------------------- */

  /**
   * Al morir el penultimo jugador se canta al ganador y, tras unos segundos,
   * la ronda siguiente arranca sola. Nadie tiene que pulsar nada: la partida
   * es un bucle mientras la pestana siga abierta.
   */
  useEffect(() => {
    // Fin de ronda con ganador, con la mesa vacia (la grilla se los llevo a
    // todos) o con tregua (aguantaron el minuto): la ronda siguiente arranca
    // sola en los tres casos.
    if (!ui.winner && !ui.draw && !ui.truce) return;

    const deadline = performance.now() + AUTO_RESTART_MS;

    const countdown = window.setInterval(() => {
      setCountdownSec(Math.max(0, Math.ceil((deadline - performance.now()) / 1000)));
    }, 200);

    const restartTimer = window.setTimeout(() => {
      engine.reset();
      setCountdownSec(null);
      setRound((current) => current + 1);
      setStatus({ text: `ronda nueva · ${PLAYERS.length} jugadores vivos`, kind: 'on' });
    }, AUTO_RESTART_MS);

    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(restartTimer);
    };
  }, [engine, ui.winner, ui.draw, ui.truce]);

  /* --------------------------- bucle de decisiones ------------------------ */

  /**
   * Config vigente leida en cada vuelta. Asi el bucle no se reinicia (ni
   * cancela la peticion en curso) mientras arrastras el deslizador de intervalo.
   */
  const decide = useCallback(
    (snapshot: GameSnapshot, signal: AbortSignal): Promise<DecisionResponse> => {
      const { model, trace } = settingsRef.current;
      // Mientras el catalogo no ha llegado no mandamos un modelo inventado:
      // el servidor usa el suyo por defecto.
      const requestedModel = modelsRef.current.has(model) ? model : undefined;
      return requestDecision(signal, {
        snapshot,
        model: requestedModel,
        trace,
        matchId: matchIdRef.current,
      });
    },
    [],
  );

  useEffect(() => {
    const loop = new DecisionLoop({
      engine,
      intervalMs: () => settingsRef.current.intervalMs,
      request: decide,
      onResult: (result) => {
        activeModelRef.current = result.model;
        recorder.decision(result, engine.view().clockMs);
        record(result.model, { decisions: 1, latencyMs: result.latencyMs });
        setStatus({ text: `conectado · ${result.model} · ${result.latencyMs} ms`, kind: 'on' });
      },
      onError: (message) => setStatus({ text: message, kind: 'err' }),
      onIdle: () => {
        if (engine.finished) return;
        setStatus((current) => (current.kind === 'pause' ? current : { text: 'en pausa', kind: 'pause' }));
      },
    });

    loop.start();
    return () => loop.stop();
  }, [decide, engine, record, recorder]);

  /* ------------------------------- acciones ------------------------------- */

  const restart = useCallback(() => {
    engine.reset();
    // Reinicio a mano: la ronda a medias no se guarda y se sueltan sus llamadas.
    rotateMatch(true);
    setCountdownSec(null);
    setRound((current) => current + 1);
    setStatus({ text: `ronda nueva · ${PLAYERS.length} jugadores vivos`, kind: 'on' });
  }, [engine, rotateMatch]);

  const togglePause = useCallback(() => {
    engine.togglePause();
    const paused = engine.isPaused;
    setStatus(paused ? { text: 'en pausa', kind: 'pause' } : { text: 'conectado', kind: 'on' });
  }, [engine]);

  const clearScore = useCallback(() => {
    setWins(emptyWins());
    setRound(1);
  }, []);

  const toggleConsole = useCallback(() => {
    update({ showConsole: !settingsRef.current.showConsole });
  }, [update]);

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
      else if (key === 'c') toggleConsole();
      else if (key === 'escape' && settings.showConsole) update({ showConsole: false });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [restart, togglePause, toggleConsole, update, settings.muted, settings.showConsole]);

  const aliveCount = ui.aliveCount;

  return (
    <div id="app" className="app" data-console={settings.showConsole}>
      <TopBar
        round={round}
        aliveCount={aliveCount}
        status={status}
        model={modelId}
        inputTokens={hudTrace.summary?.inputTokens ?? null}
        costUsd={hudTrace.summary?.costUsd ?? null}
        costPerHourUsd={hudTrace.summary?.costPerHourUsd ?? null}
        avgLatencyMs={ui.avgLatencyMs}
        consoleOpen={settings.showConsole}
        onToggleConsole={toggleConsole}
      />

      <main className="arena">
        <PlayerRail players={ui.players} wins={wins} />

        <section className="board-col">
          <Stage
            boardRef={boardRef}
            thinking={ui.thinking}
            paused={ui.paused}
            winner={ui.winner}
            draw={ui.draw}
            truce={ui.truce}
            wins={wins}
            round={round}
            countdownSec={countdownSec ?? Math.ceil(AUTO_RESTART_MS / 1000)}
            decisions={ui.decisions}
            avgLatencyMs={ui.avgLatencyMs}
            clockMs={ui.clockMs}
            survivalSec={survivalSec}
            survivalMs={SURVIVAL_MS}
            statusKind={status.kind}
            onRestart={restart}
          />
          <p className="hint">
            <kbd>espacio</kbd> pausa · <kbd>R</kbd> reiniciar · <kbd>M</kbd> sonido · <kbd>C</kbd> consola
          </p>
        </section>

        <aside className="side-col">
          <LiveStats
            decisions={ui.decisions}
            avgLatencyMs={ui.avgLatencyMs}
            bounces={ui.bounces}
            kills={ui.kills}
            crowdKills={ui.crowdKills}
            aliveCount={aliveCount}
            ballSpeed={ui.ballSpeed}
            clockMs={ui.clockMs}
          />
          <ModelPanel stats={modelStats} activeModel={modelId} />
        </aside>
      </main>

      <GameControls
        settings={settings}
        onChange={update}
        models={models}
        provider={provider}
        theme={theme}
        paused={ui.paused}
        onTogglePause={togglePause}
        onRestart={restart}
        onClearStats={resetStats}
        onClearScore={clearScore}
        onRefreshModels={() => void refreshModels()}
        onToggleTheme={toggleTheme}
      />

      <ModelConsole
        open={settings.showConsole}
        onClose={() => update({ showConsole: false })}
        records={consoleTrace.records}
        summary={consoleTrace.summary ?? hudTrace.summary}
        error={consoleTrace.error}
        live
        onClear={() => void consoleTrace.clear()}
      />
    </div>
  );
}
