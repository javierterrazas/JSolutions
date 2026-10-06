'use server';
// Entrar: canjear la invitación en el celular, elegir el PIN, escribirlo y salir (D-024, D-038).
import { esErrorDeNegocio } from '@ijm/core';
import {
  canjearInvitacion,
  cerrarDispositivo,
  entrarConPin as entrarConPinEnLaBase,
  fijarPin,
  fijarSesionDispositivo,
  quienSoy,
  sinUsuario,
  tomarIdentidad,
  type Llave,
} from '@ijm/servidor';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_IDIOMA } from '@/i18n/idioma';
import { conLlave, guardarLlave, type Resultado } from '@/lib/acceso';
import { nombreDelDispositivo, sesionDelToken } from '@/lib/dispositivo';
import { auth, servidor } from '@/lib/servidor';
import { clienteSupabase, OPCIONES_COOKIE } from '@/lib/supabase';

/**
 * Canjea la invitación: verifica este celular (su llave va a una cookie) y abre la sesión de Auth del invitado.
 * Todo en una transacción: si la sesión no se abre, la invitación sigue sin usarse.
 */
export async function canjear(token: string): Promise<void> {
  const nombre = nombreDelDispositivo((await headers()).get('user-agent'));
  let llave: Llave;
  try {
    llave = await sinUsuario(servidor(), async (tx) => {
      const c = await canjearInvitacion(tx, { token, nombreDispositivo: nombre });
      const supabase = await clienteSupabase();
      await supabase.auth.signOut({ scope: 'local' });
      const { data, error } = await supabase.auth.verifyOtp({
        type: 'magiclink',
        token_hash: await auth().tokenDeSesion(c.correo),
      });
      if (error || !data.session) throw error ?? new Error('Auth no abrió la sesión');
      const nueva = { dispositivoId: c.dispositivoId, secreto: c.secreto };
      const sesionId = sesionDelToken(data.session.access_token);
      await tomarIdentidad(tx, { userId: c.userId });
      if (sesionId) await fijarSesionDispositivo(tx, { ...nueva, sesionId });
      return nueva;
    });
  } catch (e) {
    if (esErrorDeNegocio(e)) redirect('/invitacion/invalida');
    throw e;
  }
  await guardarLlave(llave);
  redirect('/pin/nuevo');
}

/** La app se muestra en el idioma del miembro, en cualquier celular donde entre. */
async function idiomaDelMiembro(idioma: string) {
  (await cookies()).set(COOKIE_IDIOMA, idioma, { ...OPCIONES_COOKIE, maxAge: 365 * 24 * 3600 });
}

export async function elegirPin(_previo: Resultado | null, formulario: FormData): Promise<Resultado> {
  const pin = String(formulario.get('pin') ?? '');
  if (pin !== String(formulario.get('repetir') ?? '')) return { ok: false, codigo: 'pin_no_coincide' };
  let idioma: string;
  try {
    idioma = await conLlave(async (tx, llave) => {
      await fijarPin(tx, { ...llave, pin });
      return (await quienSoy(tx)).idioma;
    });
  } catch (e) {
    if (!esErrorDeNegocio(e)) throw e;
    if (e.codigo === 'pin_ya_fijado') redirect('/pin');
    if (e.codigo === 'dispositivo_invalido' || e.codigo === 'sin_acceso') redirect('/sin-acceso');
    return { ok: false, codigo: e.codigo, ...(e.datos ? { datos: e.datos } : {}) };
  }
  await idiomaDelMiembro(idioma);
  redirect('/');
}

export async function entrarConPin(_previo: Resultado | null, formulario: FormData): Promise<Resultado> {
  const pin = String(formulario.get('pin') ?? '');
  const r = await conLlave(async (tx, llave) => {
    const r = await entrarConPinEnLaBase(tx, { ...llave, pin });
    return r.resultado === 'ok' ? { ...r, idioma: (await quienSoy(tx)).idioma } : r;
  });
  if (r.resultado === 'ok') {
    await idiomaDelMiembro(r.idioma);
    redirect('/');
  }
  if (r.resultado === 'pin_incorrecto')
    return { ok: false, codigo: 'pin_incorrecto', datos: { quedan: r.quedan } };
  if (r.resultado === 'pin_bloqueado')
    return { ok: false, codigo: 'pin_bloqueado', datos: { hasta: r.hasta } };
  redirect(r.resultado === 'sin_pin' ? '/pin/nuevo' : '/sin-acceso');
}

/** Salir: este celular queda cerrado hasta que se escriba el PIN. */
export async function salir(): Promise<void> {
  await conLlave((tx, llave) => cerrarDispositivo(tx, llave));
  redirect('/pin');
}
