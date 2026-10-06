// Quién entra (D-024, D-038). Una página o acción del miembro pasa por aquí: la sesión de Auth dice quién es, la
// llave del celular (su cookie) dice que es SU celular verificado, y el PIN dice que lo abrió hoy. La base revisa
// las tres en una sola transacción (estado_dispositivo), y también que el miembro y su empresa sigan activos.
import 'server-only';
import { esErrorDeNegocio } from '@ijm/core';
import { enNombreDe, estadoDispositivo, quienSoy, type Llave, type Tx, type Yo } from '@ijm/servidor';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { servidor } from './servidor';
import { OPCIONES_COOKIE, usuarioDeLaSesion } from './supabase';

/** La cookie con la llave del celular: "dispositivo.secreto". Dura lo más que permite el navegador (400 días). */
export const COOKIE_DISPOSITIVO = 'dispositivo';
const CUATROCIENTOS_DIAS = 400 * 24 * 3600;

export async function guardarLlave(llave: Llave): Promise<void> {
  (await cookies()).set(COOKIE_DISPOSITIVO, `${llave.dispositivoId}.${llave.secreto}`, {
    ...OPCIONES_COOKIE,
    maxAge: CUATROCIENTOS_DIAS,
  });
}

export async function leerLlave(): Promise<Llave | null> {
  const v = (await cookies()).get(COOKIE_DISPOSITIVO)?.value;
  const i = v?.indexOf('.') ?? -1;
  if (!v || i < 1) return null;
  return { dispositivoId: v.slice(0, i), secreto: v.slice(i + 1) };
}

export interface Acceso {
  readonly userId: string;
  readonly llave: Llave;
  readonly yo: Yo;
}

/**
 * Exige un miembro activo, en su celular verificado y con el PIN abierto. Si falta algo, manda a donde
 * corresponde: sin celular verificado, a /sin-acceso; sin PIN todavía, a elegirlo; cerrado, a escribirlo.
 */
export async function exigirAcceso(): Promise<Acceso> {
  const sesion = await usuarioDeLaSesion();
  const llave = await leerLlave();
  if (!sesion || !llave) redirect('/sin-acceso');
  const r = await enNombreDe(servidor(), { userId: sesion.userId }, async (tx) => {
    const estado = await estadoDispositivo(tx, llave);
    return estado === 'abierto' ? { estado, yo: await quienSoy(tx) } : { estado };
  });
  if (r.estado === 'sin_pin') redirect('/pin/nuevo');
  if (r.estado === 'cerrado') redirect('/pin');
  if (r.estado !== 'abierto' || !r.yo) redirect('/sin-acceso');
  return { userId: sesion.userId, llave, yo: r.yo };
}

/**
 * Para las pantallas del PIN: exige la sesión y la llave del celular, pero no que esté abierto. Si no hay alguna
 * de las dos, a /sin-acceso.
 */
export async function conLlave<T>(fn: (tx: Tx, llave: Llave) => Promise<T>): Promise<T> {
  const sesion = await usuarioDeLaSesion();
  const llave = await leerLlave();
  if (!sesion || !llave) redirect('/sin-acceso');
  return enNombreDe(servidor(), { userId: sesion.userId }, (tx) => fn(tx, llave));
}

/** Exige además que sea el dueño o el administrador. */
export async function exigirDueno(): Promise<Acceso> {
  const a = await exigirAcceso();
  if (a.yo.rol === 'pm') redirect('/');
  return a;
}

/** Lo que devuelve una acción a su formulario: listo, o el error de negocio con su código para traducirlo. */
export type Resultado<T = undefined> =
  | { readonly ok: true; readonly datos: T }
  | { readonly ok: false; readonly codigo: string; readonly datos?: Readonly<Record<string, unknown>> };

/** Corre `fn` a nombre del miembro con acceso; un error de negocio vuelve como resultado, no como excepción. */
export async function comoMiembro<T>(
  fn: (tx: Tx, acceso: Acceso) => Promise<T>,
  acceso?: Acceso,
): Promise<Resultado<T>> {
  const a = acceso ?? (await exigirAcceso());
  try {
    return { ok: true, datos: await enNombreDe(servidor(), { userId: a.userId }, (tx) => fn(tx, a)) };
  } catch (e) {
    if (esErrorDeNegocio(e)) return { ok: false, codigo: e.codigo, ...(e.datos ? { datos: e.datos } : {}) };
    throw e;
  }
}
