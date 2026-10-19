import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import './globals.css';
import { estadoDeAcceso } from '@/lib/acceso';
import { COLOR_MARCA, NOMBRE_APP } from './marca';
import { GENERAL, rutasDeMarca } from './marca/datos';
import { PulsoDeUso } from './pulso-de-uso';
import { RegistrarServiceWorker } from './registrar-sw';

// Ningún texto visible queda fijo en el código: todo sale de mensajes/es.json y mensajes/en.json (next-intl).

/**
 * La empresa de quien entra, para instalar la app con su nombre y su ícono (D-078); antes de entrar, J Solutions. La
 * revisión de acceso es la misma de la página (una consulta por petición).
 */
async function empresa() {
  const a = await estadoDeAcceso().catch(() => null);
  if (a?.estado !== 'abierto') return null;
  const { yo } = a.acceso;
  return { id: yo.empresaId, nombre: yo.empresa, color: yo.marca.color, version: yo.marca.version };
}

export async function generateMetadata(): Promise<Metadata> {
  const [t, e] = await Promise.all([getTranslations('app'), empresa()]);
  const nombre = e?.nombre ?? NOMBRE_APP;
  const r = rutasDeMarca(e?.id ?? GENERAL, e?.version ?? 1);
  return {
    title: nombre,
    description: t('lema'),
    applicationName: nombre,
    manifest: e ? r.manifiesto : '/manifest.webmanifest',
    icons: { icon: r.icono('32'), apple: r.icono('180') },
    appleWebApp: { capable: true, title: nombre, statusBarStyle: 'default' },
    formatDetection: { telephone: false },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const e = await empresa();
  return {
    themeColor: e?.color ?? COLOR_MARCA,
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
  };
}

export default async function RaizLayout({ children }: { children: ReactNode }) {
  const idioma = await getLocale();
  // el uso de la app (D-101), solo de quien entró: el portal del cliente y las pantallas de entrar no cuentan
  const conSesion = (await estadoDeAcceso().catch(() => null))?.estado === 'abierto';
  return (
    <html lang={idioma}>
      <body className="min-h-dvh bg-fondo text-slate-900 antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <RegistrarServiceWorker />
        {conSesion ? <PulsoDeUso /> : null}
      </body>
    </html>
  );
}
