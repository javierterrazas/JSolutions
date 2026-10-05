// El manifiesto de la PWA: con él, el teléfono ofrece instalar la app y la abre sin la barra del navegador.
import type { MetadataRoute } from 'next';
import { COLOR_FONDO, COLOR_MARCA, NOMBRE_APP } from './marca';

export default function manifiesto(): MetadataRoute.Manifest {
  return {
    name: NOMBRE_APP,
    short_name: NOMBRE_APP,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: COLOR_MARCA,
    background_color: COLOR_FONDO,
    icons: [
      { src: '/iconos/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/iconos/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/iconos/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
