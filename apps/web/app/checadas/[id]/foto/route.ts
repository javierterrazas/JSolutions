// La selfie de una checada (D-117): si quien la pide puede ver la checada (el dueño o el administrador; el PM, las de
// sus obras), lo manda a un enlace firmado de pocos minutos. Si no, 404.
import { fotoDeChecada } from '@ijm/servidor';
import { NextResponse } from 'next/server';
import { comoMiembro, estadoDeAcceso } from '@/lib/acceso';
import { firmarFoto } from '@/lib/servidor';

export async function GET(_peticion: Request, { params }: RouteContext<'/checadas/[id]/foto'>) {
  const { id } = await params;
  const a = await estadoDeAcceso();
  if (a.estado !== 'abierto') return new NextResponse(null, { status: 404 });
  const r = await comoMiembro((tx) => fotoDeChecada(tx, { checadaId: id }), a.acceso).catch(() => null);
  if (!r?.ok || !r.datos) return new NextResponse(null, { status: 404 });
  const url = await firmarFoto(r.datos, 300).catch(() => null);
  if (!url) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(url, { headers: { 'Cache-Control': 'private, no-store' } });
}
