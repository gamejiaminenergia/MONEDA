import type { Metadata } from 'next';

import BolsaGame from '@/components/bolsa/BolsaGame';

export const metadata: Metadata = {
  title: 'BOLSA — mercado de energia',
  description:
    'Seis agentes ofertan energia cada hora: el operador despacha por merito y el precio marginal lo cobran todos. Un juego que refleja lo basico del mercado mayorista.',
};

export default function BolsaPage() {
  return <BolsaGame />;
}
