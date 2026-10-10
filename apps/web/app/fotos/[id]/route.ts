// Ver una foto (D-026): si quien la pide puede verla (RLS, con su celular y su PIN abiertos), lo manda a un enlace
// firmado de pocos minutos. Si no, 404: no se distingue entre "no existe" y "no es tuya". Las pantallas la usan
// como <img src="/fotos/{id}">.
import { enlaceDeFoto } from '@ijm/servidor';
import { NextResponse } from 'next/server';
import { comoMiembro, estadoDeAcceso } from '@/lib/acceso';
import { firmarFoto } from '@/lib/servidor';

export async function GET(_peticion: Request, { params }: RouteContext<'/fotos/[id]'>) {
  const { id } = await params;
  const a = await estadoDeAcceso();
  if (a.estado !== 'abierto') return new NextResponse(null, { status: 404 });
  // el registro existe pero el archivo no está en Storage (o Storage no contesta): para la pantalla es lo mismo
  const r = await comoMiembro((tx) => enlaceDeFoto(tx, id, firmarFoto), a.acceso).catch(() => null);
  if (!r?.ok) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(r.datos.url, { headers: { 'Cache-Control': 'private, no-store' } });
}
