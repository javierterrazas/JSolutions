'use server';
// El equipo del dueño: invitar a un PM, una invitación nueva, quitar un celular, dar de baja y reactivar.
import {
  cambiarActivo as cambiarActivoEnLaBase,
  invitarPm,
  reinvitar,
  revocarDispositivo,
  type Invitacion,
} from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { comoMiembro, exigirDueno, type Resultado } from '@/lib/acceso';
import { auth } from '@/lib/servidor';

export interface EnlaceDeInvitacion {
  readonly nombre: string;
  readonly enlace: string;
}

/** El enlace que se manda al invitado, en la dirección por la que entró el dueño. */
async function enlaceDe(inv: Invitacion): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const protocolo =
    h.get('x-forwarded-proto') ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https');
  return `${protocolo}://${host}/invitacion/${inv.token}`;
}

export async function invitar(
  _previo: Resultado<EnlaceDeInvitacion> | null,
  formulario: FormData,
): Promise<Resultado<EnlaceDeInvitacion>> {
  const nombre = String(formulario.get('nombre') ?? '');
  const entrada = {
    nombre,
    correo: String(formulario.get('correo') ?? ''),
    idioma: String(formulario.get('idioma') ?? 'es') as 'es' | 'en',
  };
  const r = await comoMiembro((tx) => invitarPm(tx, entrada, auth().usuarioDeCorreo), await exigirDueno());
  if (!r.ok) return r;
  revalidatePath('/equipo');
  return { ok: true, datos: { nombre: nombre.trim(), enlace: await enlaceDe(r.datos) } };
}

export async function nuevaInvitacion(
  miembro: { id: string; nombre: string },
  _previo: Resultado<EnlaceDeInvitacion> | null,
): Promise<Resultado<EnlaceDeInvitacion>> {
  const r = await comoMiembro((tx) => reinvitar(tx, { miembroId: miembro.id }), await exigirDueno());
  if (!r.ok) return r;
  revalidatePath('/equipo');
  return { ok: true, datos: { nombre: miembro.nombre, enlace: await enlaceDe(r.datos) } };
}

export async function quitarCelular(dispositivoId: string): Promise<void> {
  await comoMiembro((tx) => revocarDispositivo(tx, { dispositivoId }), await exigirDueno());
  revalidatePath('/equipo');
}

export async function cambiarActivo(miembroId: string, activo: boolean): Promise<void> {
  await comoMiembro((tx) => cambiarActivoEnLaBase(tx, { miembroId, activo }), await exigirDueno());
  revalidatePath('/equipo');
}
