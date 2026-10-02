import { createPersistentStore } from './store';

export interface ModelStat {
  decisions: number;
  latencySumMs: number;
  maxRally: number;
  fallbacks: number;
}

export type ModelStats = Record<string, ModelStat>;

const STORAGE_KEY = 'nimble.modelStats.v1';

export const emptyStat = (): ModelStat => ({ decisions: 0, latencySumMs: 0, maxRally: 0, fallbacks: 0 });

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
        maxRally: Number(value?.maxRally) || 0,
        fallbacks: Number(value?.fallbacks) || 0,
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
  patch: { decisions?: number; latencyMs?: number; maxRally?: number; fallbacks?: number },
): ModelStats {
  const current = stats[model] ?? emptyStat();
  return {
    ...stats,
    [model]: {
      decisions: current.decisions + (patch.decisions ?? 0),
      latencySumMs: current.latencySumMs + (patch.latencyMs ?? 0),
      maxRally: Math.max(current.maxRally, patch.maxRally ?? 0),
      fallbacks: current.fallbacks + (patch.fallbacks ?? 0),
    },
  };
}

export function averageLatency(stat: ModelStat | undefined): number | null {
  if (!stat || stat.decisions === 0) return null;
  return Math.round(stat.latencySumMs / stat.decisions);
}
