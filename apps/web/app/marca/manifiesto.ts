// El manifiesto de la app de una empresa (D-078): con él, el teléfono la instala con el nombre y el ícono de la
// empresa que la usa. "general" es J Solutions.
import 'server-only';
import { NextResponse } from 'next/server';
import { COLOR_FONDO } from '../marca';
import { marcaDe, rutasDeMarca } from './datos';

export async function manifiestoDe(empresa: string): Promise<NextResponse> {
  const m = await marcaDe(empresa);
  if (!m) return new NextResponse(null, { status: 404 });
  const r = rutasDeMarca(empresa, m.version);
  return NextResponse.json(
    {
      name: m.nombre,
      short_name: m.nombre,
      id: '/',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      theme_color: m.color,
      background_color: COLOR_FONDO,
      icons: [
        { src: r.icono('192'), sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: r.icono('512'), sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: r.icono('maskable'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' } },
  );
}
