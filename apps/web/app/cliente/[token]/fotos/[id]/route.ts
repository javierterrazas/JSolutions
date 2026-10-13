// Una foto del portal del cliente (D-066): si el enlace sirve y la foto está marcada para él, lo manda a un enlace
// firmado de pocos minutos. Si no, 404, sin decir por qué.
import { enlaceDeFotoDelPortal, sinUsuario } from '@ijm/servidor';
import { NextResponse } from 'next/server';
import { firmarFoto, servidor } from '@/lib/servidor';

export async function GET(_peticion: Request, { params }: RouteContext<'/cliente/[token]/fotos/[id]'>) {
  const { token, id } = await params;
  const r = await sinUsuario(servidor(), (tx) =>
    enlaceDeFotoDelPortal(tx, { token, fotoId: id }, firmarFoto),
  ).catch(() => null);
  if (!r) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(r.url, { headers: { 'Cache-Control': 'private, no-store' } });
}
