// El logo de una empresa (D-078), para el encabezado de cada pantalla y el portal del cliente. 404 si no tiene.
import { NextResponse } from 'next/server';
import { marcaDe } from '../../datos';

export async function GET(_peticion: Request, ctx: RouteContext<'/marca/[empresa]/logo'>) {
  const { empresa } = await ctx.params;
  const m = await marcaDe(empresa);
  if (!m?.logo || !m.logoTipo) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(m.logo), {
    headers: { 'Content-Type': m.logoTipo, 'Cache-Control': 'public, max-age=86400' },
  });
}
