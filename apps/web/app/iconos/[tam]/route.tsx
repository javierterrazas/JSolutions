// Los íconos del manifiesto: /iconos/192, /iconos/512 y /iconos/maskable. Se generan al construir.
import { dibujarIcono } from '../dibujo';

const ICONOS = {
  '192': { lado: 192, margen: 0.2 },
  '512': { lado: 512, margen: 0.2 },
  maskable: { lado: 512, margen: 0.3 },
} as const;

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONOS).map((tam) => ({ tam }));
}

export async function GET(_peticion: Request, ctx: RouteContext<'/iconos/[tam]'>) {
  const { lado, margen } = ICONOS[(await ctx.params).tam as keyof typeof ICONOS];
  return dibujarIcono(lado, margen);
}
