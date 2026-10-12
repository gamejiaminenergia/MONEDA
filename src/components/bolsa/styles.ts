import type { CSSProperties } from 'react';

import type { Resource } from '@/lib/bolsa/types';

/** Estilos y etiquetas compartidos por la sala de despacho. */
export const panel: CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 12,
  padding: 14,
};

export const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace';

export const TYPE_SHORT: Record<Resource['type'], string> = {
  hidro: 'hidro',
  termica: 'term.',
  solar: 'solar',
  eolica: 'eol.',
};
