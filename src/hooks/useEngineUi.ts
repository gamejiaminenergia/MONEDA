'use client';

import { useSyncExternalStore } from 'react';

import type { GameEngine } from '@/lib/game/engine';
import type { UiState } from '@/lib/game/types';

/**
 * Conecta React al motor. Re-renderiza solo cuando el motor marca un cambio,
 * nunca en cada frame: el canvas se dibuja aparte, fuera de React.
 */
export function useEngineUi(engine: GameEngine): UiState {
  return useSyncExternalStore(engine.subscribe, () => engine.ui(), () => engine.ui());
}
