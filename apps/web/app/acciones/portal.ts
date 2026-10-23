'use server';
// El portal del cliente (D-066): el dueño crea o desactiva el enlace de una obra; el PM o el dueño marcan qué fotos
// ve el cliente; y el cliente, con su enlace, responde sus órdenes de cambio (D-067).
import { esErrorDeNegocio } from '@ijm/core';
import {
  anularEnlaceCliente,
  crearEnlaceCliente,
  marcarFotoCliente,
  responderCambioCliente,
  sinUsuario,
} from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { comoMiembro, exigirAccesoCon, exigirDuenoCon, type Resultado } from '@/lib/acceso';
import { servidor } from '@/lib/servidor';

/** Crea el enlace (y anula el anterior). El token vuelve una sola vez: la base guarda su hash. */
export async function crearEnlace(
  obraId: string,
  _previo: Resultado<{ token: string }> | null,
): Promise<Resultado<{ token: string }>> {
  const r = await comoMiembro((tx) => crearEnlaceCliente(tx, { obraId }), await exigirDuenoCon('portal'));
  if (r.ok) revalidatePath(`/obras/${obraId}/seguimiento`);
  return r;
}

export async function desactivarEnlace(
  obraId: string,
  _previo: Resultado<void> | null,
): Promise<Resultado<void>> {
  const r = await comoMiembro((tx) => anularEnlaceCliente(tx, { obraId }), await exigirDuenoCon('portal'));
  if (r.ok) revalidatePath(`/obras/${obraId}/seguimiento`);
  return r;
}

/** Marca o desmarca una foto para el cliente, desde el álbum de la obra. */
export async function marcarFoto(obraId: string, fotoId: string, visible: boolean): Promise<void> {
  await comoMiembro((tx) => marcarFotoCliente(tx, { fotoId, visible }), await exigirAccesoCon('portal'));
  revalidatePath(`/obras/${obraId}/album`);
}

/**
 * El cliente aprueba (con su nombre y su firma) o no aprueba una orden de cambio desde su portal. Sin sesión: el
 * token del enlace es la prueba, y la base revisa que la orden sea de su obra y siga por aprobar. Guarda también el
 * IP y el navegador, como evidencia.
 */
export async function responderCambio(
  token: string,
  ordenId: string,
  _previo: Resultado | null,
  f: FormData,
): Promise<Resultado> {
  const h = await headers();
  try {
    await sinUsuario(servidor(), (tx) =>
      responderCambioCliente(tx, {
        token,
        ordenId,
        decision: f.get('decision') === 'aprobada' ? 'aprobada' : 'rechazada',
        nombre: String(f.get('nombre') ?? ''),
        firma: String(f.get('firma') ?? '') || null,
        comentario: String(f.get('comentario') ?? '') || null,
        ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        navegador: h.get('user-agent'),
        huella: String(f.get('huella') ?? '') || null,
      }),
    );
  } catch (e) {
    if (!esErrorDeNegocio(e)) throw e;
    // el dueño la editó mientras la veía: que vea la nueva
    if (e.codigo === 'orden_cambiada') revalidatePath(`/cliente/${token}`);
    return { ok: false, codigo: e.codigo };
  }
  revalidatePath(`/cliente/${token}`);
  return { ok: true, datos: undefined };
}
