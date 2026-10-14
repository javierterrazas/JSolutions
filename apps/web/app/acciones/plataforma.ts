'use server';
// La plataforma (D-080): dar de alta una empresa, su suscripción, sus pagos, suspenderla y reinvitar a su dueño.
// Entra quien administra la plataforma, con su celular y su PIN como cualquier miembro; la base revisa que lo sea.
import {
  altaDeEmpresa,
  cambiarActivaEmpresa,
  guardarSuscripcion,
  registrarPagoPlataforma,
  reinvitarDueno,
} from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { comoMiembro, type Resultado } from '@/lib/acceso';
import { enlaceDeInvitacion } from '@/lib/enlace';
import { exigirPlataforma } from '@/lib/plataforma';
import { auth } from '@/lib/servidor';
import type { EnlaceDeInvitacion } from './equipo';

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();
const fecha = (f: FormData, campo: string) => texto(f, campo) || null;

/** Lo común del alta y de la suscripción: plan, precio, ciclo, si está a prueba y hasta cuándo. */
const suscripcionDe = (f: FormData) => ({
  plan: texto(f, 'plan') as 'basico' | 'pro' | 'empresa',
  precio: texto(f, 'precio') || '0',
  ciclo: texto(f, 'ciclo') as 'mensual' | 'anual',
  enPrueba: f.get('enPrueba') === 'on',
  venceEl: fecha(f, 'venceEl'),
});

export async function darDeAlta(
  _previo: Resultado<EnlaceDeInvitacion & { empresaId: string }> | null,
  f: FormData,
): Promise<Resultado<EnlaceDeInvitacion & { empresaId: string }>> {
  const r = await comoMiembro(
    (tx) =>
      altaDeEmpresa(
        tx,
        {
          empresa: texto(f, 'empresa'),
          ciudad: texto(f, 'ciudad'),
          idioma: texto(f, 'idioma') === 'en' ? 'en' : 'es',
          dueno: texto(f, 'dueno'),
          correo: texto(f, 'correo'),
          ...suscripcionDe(f),
        },
        auth().usuarioDeCorreo,
      ),
    await exigirPlataforma(),
  );
  if (!r.ok) return r;
  revalidatePath('/plataforma');
  return {
    ok: true,
    datos: {
      empresaId: r.datos.empresaId,
      nombre: r.datos.dueno,
      enlace: await enlaceDeInvitacion(r.datos.token),
    },
  };
}

export async function guardarLaSuscripcion(
  empresaId: string,
  _previo: Resultado | null,
  f: FormData,
): Promise<Resultado> {
  const r = await comoMiembro(
    (tx) => guardarSuscripcion(tx, { empresaId, ...suscripcionDe(f), notas: texto(f, 'notas') }),
    await exigirPlataforma(),
  );
  if (!r.ok) return r;
  revalidatePath('/plataforma');
  return { ok: true, datos: undefined };
}

export async function registrarPago(
  empresaId: string,
  _previo: Resultado | null,
  f: FormData,
): Promise<Resultado> {
  const r = await comoMiembro(
    (tx) =>
      registrarPagoPlataforma(tx, {
        empresaId,
        monto: texto(f, 'monto'),
        pagadoEl: texto(f, 'pagadoEl'),
        metodo: texto(f, 'metodo') as 'zelle',
        referencia: texto(f, 'referencia'),
        venceEl: texto(f, 'venceEl'),
      }),
    await exigirPlataforma(),
  );
  if (!r.ok) return r;
  revalidatePath('/plataforma');
  return { ok: true, datos: undefined };
}

export async function cambiarActiva(
  empresaId: string,
  activa: boolean,
  _previo: Resultado | null,
): Promise<Resultado> {
  const r = await comoMiembro(
    (tx) => cambiarActivaEmpresa(tx, { empresaId, activa }),
    await exigirPlataforma(),
  );
  if (!r.ok) return r;
  revalidatePath('/plataforma');
  return { ok: true, datos: undefined };
}

export async function reinvitarAlDueno(
  empresaId: string,
  _previo: Resultado<EnlaceDeInvitacion> | null,
): Promise<Resultado<EnlaceDeInvitacion>> {
  const r = await comoMiembro((tx) => reinvitarDueno(tx, { empresaId }), await exigirPlataforma());
  if (!r.ok) return r;
  return { ok: true, datos: { nombre: r.datos.dueno, enlace: await enlaceDeInvitacion(r.datos.token) } };
}
