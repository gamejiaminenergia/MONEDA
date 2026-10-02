import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Have No Mouth, and I Must Scream IA — diez jugadores y una bola que mata',
  description:
    'Diez jugadores con nombre de color huyen de una bola que rebota para siempre: un roce y se acaba. Cada jugada la decide un modelo de IA (System One de TypeSafe) y una consola muestra la peticion, la respuesta y el costo.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0e17',
};

/**
 * Antes de que React pinte nada, el <html> ya sabe si va en oscuro. Sin esto,
 * quien eligio oscuro ve un destello blanco al recargar.
 */
const THEME_SCRIPT = `try{if(localStorage.getItem('nimble.theme')==='dark'){document.documentElement.dataset.theme='dark'}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
