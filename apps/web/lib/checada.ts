// La llave de la checada en el celular del trabajador (D-117): una cookie "acceso.secreto", aparte de la del celular de
// los miembros (que tienen sesión y PIN). Con ella solo se checa.
import 'server-only';
import type { LlaveTrabajador } from '@ijm/servidor';
import { cookies } from 'next/headers';
import { OPCIONES_COOKIE } from './supabase';

export const COOKIE_CHECADA = 'checada';
const CUATROCIENTOS_DIAS = 400 * 24 * 3600;

export async function guardarLlaveChecada(llave: LlaveTrabajador): Promise<void> {
  (await cookies()).set(COOKIE_CHECADA, `${llave.accesoId}.${llave.secreto}`, {
    ...OPCIONES_COOKIE,
    maxAge: CUATROCIENTOS_DIAS,
  });
}

export async function leerLlaveChecada(): Promise<LlaveTrabajador | null> {
  const v = (await cookies()).get(COOKIE_CHECADA)?.value;
  const i = v?.indexOf('.') ?? -1;
  if (!v || i < 1) return null;
  return { accesoId: v.slice(0, i), secreto: v.slice(i + 1) };
}
