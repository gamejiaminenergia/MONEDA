'use client';

import { useCallback, useSyncExternalStore } from 'react';

import {
  emptyStat,
  mergeRecord,
  modelStatsStore,
  type ModelStat,
} from '@/lib/client/model-stats';

/** Estadisticas por modelo, persistidas en localStorage. */
export function useModelStats() {
  const stats = useSyncExternalStore(modelStatsStore.subscribe, modelStatsStore.get, modelStatsStore.getServer);

  const record = useCallback((model: string, patch: Partial<Omit<ModelStat, 'latencySumMs'>> & { latencyMs?: number }) => {
    modelStatsStore.set((current) => mergeRecord(current, model, patch));
  }, []);

  /** Solo escribe si el rally supera el record; asi no re-renderiza de mas. */
  const recordMaxRally = useCallback((model: string, rally: number) => {
    modelStatsStore.set((current) => {
      const stat = current[model] ?? emptyStat();
      return rally > stat.maxRally ? mergeRecord(current, model, { maxRally: rally }) : current;
    });
  }, []);

  const reset = useCallback(() => modelStatsStore.set({}), []);

  return { stats, record, recordMaxRally, reset };
}
