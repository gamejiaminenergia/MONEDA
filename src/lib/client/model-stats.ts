import { createPersistentStore } from './store';

export interface ModelStat {
  decisions: number;
  latencySumMs: number;
  /** Mayor tiempo que un modelo mantuvo vivo a su jugador. */
  survivalMs: number;
}

export type ModelStats = Record<string, ModelStat>;

const STORAGE_KEY = 'nimble.modelStats.v3';

export const emptyStat = (): ModelStat => ({ decisions: 0, latencySumMs: 0, survivalMs: 0 });

function parseModelStats(raw: string | null): ModelStats | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const stats: ModelStats = {};
    for (const [model, value] of Object.entries(parsed as Record<string, Partial<ModelStat>>)) {
      stats[model] = {
        decisions: Number(value?.decisions) || 0,
        latencySumMs: Number(value?.latencySumMs) || 0,
        survivalMs: Number(value?.survivalMs) || 0,
      };
    }
    return stats;
  } catch {
    return null;
  }
}

export const modelStatsStore = createPersistentStore<ModelStats>({
  key: STORAGE_KEY,
  defaults: {},
  parse: parseModelStats,
});

export function mergeRecord(
  stats: ModelStats,
  model: string,
  patch: { decisions?: number; latencyMs?: number; survivalMs?: number },
): ModelStats {
  const current = stats[model] ?? emptyStat();
  return {
    ...stats,
    [model]: {
      decisions: current.decisions + (patch.decisions ?? 0),
      latencySumMs: current.latencySumMs + (patch.latencyMs ?? 0),
      survivalMs: Math.max(current.survivalMs, patch.survivalMs ?? 0),
    },
  };
}

export function averageLatency(stat: ModelStat | undefined): number | null {
  if (!stat || stat.decisions === 0) return null;
  return Math.round(stat.latencySumMs / stat.decisions);
}
