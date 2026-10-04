import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import './globals.css';
import { COLOR_MARCA, NOMBRE_APP } from './marca';
import { RegistrarServiceWorker } from './registrar-sw';

// Ningún texto visible queda fijo en el código: todo sale de mensajes/es.json y mensajes/en.json (next-intl).

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app');
  return {
    title: NOMBRE_APP,
    description: t('lema'),
    applicationName: NOMBRE_APP,
    appleWebApp: { capable: true, title: NOMBRE_APP, statusBarStyle: 'default' },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: COLOR_MARCA,
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RaizLayout({ children }: { children: ReactNode }) {
  const idioma = await getLocale();
  return (
    <html lang={idioma}>
      <body className="min-h-dvh bg-fondo text-slate-900 antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
