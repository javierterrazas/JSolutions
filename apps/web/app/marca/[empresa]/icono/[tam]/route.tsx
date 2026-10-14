// Los íconos de la app de una empresa (D-078): /marca/{empresa}/icono/{32|180|192|512|maskable}. Con su logo o sus
// iniciales; "general" es J Solutions.
import { NextResponse } from 'next/server';
import { dibujarIcono } from '../../../../iconos/dibujo';
import { marcaDe } from '../../../datos';

const ICONOS = {
  '32': { lado: 32, margen: 0.08 },
  '180': { lado: 180, margen: 0.14 },
  '192': { lado: 192, margen: 0.16 },
  '512': { lado: 512, margen: 0.16 },
  maskable: { lado: 512, margen: 0.26 },
} as const;

export async function GET(_peticion: Request, ctx: RouteContext<'/marca/[empresa]/icono/[tam]'>) {
  const { empresa, tam } = await ctx.params;
  const icono = ICONOS[tam as keyof typeof ICONOS];
  const marca = icono ? await marcaDe(empresa) : null;
  if (!icono || !marca) return new NextResponse(null, { status: 404 });
  const imagen = dibujarIcono(icono.lado, icono.margen, marca);
  // cambia con la versión de la marca, que va en la dirección
  imagen.headers.set('Cache-Control', 'public, max-age=86400');
  return imagen;
}
