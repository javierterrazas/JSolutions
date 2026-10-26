'use server';
// La checada con GPS y selfie (D-117). Del trabajador (sin sesión, con la llave de su celular): activar su celular con
// la invitación y checar. Del dueño o administrador: invitar a un trabajador, quitarle la checada, poner una salida
// olvidada y anular. Del dueño, el administrador o el PM de la obra: fijar la geocerca.
import { randomUUID } from 'node:crypto';
import { esErrorDeNegocio } from '@ijm/core';
import {
  anularChecada,
  canjearAccesoTrabajador,
  checar,
  corregirSalida,
  estadoDeAccesoTrabajador,
  fijarGeocerca,
  invitarTrabajadorChecada,
  quitarAccesoTrabajador,
  sinUsuario,
  trabajadorDeLlave,
  type ResultadoChecada,
} from '@ijm/servidor';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { comoMiembro, exigirAccesoCon, exigirDuenoCon, type Resultado } from '@/lib/acceso';
import { guardarLlaveChecada, leerLlaveChecada } from '@/lib/checada';
import { nombreDelDispositivo } from '@/lib/dispositivo';
import { enlaceDeLaApp } from '@/lib/enlace';
import { borrarSelfie, servidor, subirSelfie } from '@/lib/servidor';

/** Activar la checada en el celular del trabajador con su invitación; si ya es suya en este navegador, a checar. */
export async function activarChecada(token: string): Promise<void> {
  const dispositivo = nombreDelDispositivo((await headers()).get('user-agent'));
  try {
    const llave = await sinUsuario(servidor(), (tx) => canjearAccesoTrabajador(tx, { token, dispositivo }));
    await guardarLlaveChecada(llave);
  } catch (e) {
    if (!esErrorDeNegocio(e)) throw e;
    const actual = await leerLlaveChecada();
    const estado = await sinUsuario(servidor(), (tx) =>
      estadoDeAccesoTrabajador(tx, { token, llave: actual }),
    );
    if (estado === 'tuya') redirect('/checar');
    redirect(`/invitacion/invalida?motivo=${estado}`);
  }
  redirect('/checar');
}

export interface RespuestaChecada {
  readonly resultado: ResultadoChecada | 'sin_foto';
  readonly obra: string | null;
  readonly distancia: number | null;
  readonly en: string | null;
  readonly horas: number | null;
}

const LIMITE_FOTO = 5 * 1024 * 1024;

/**
 * Checar entrada o salida: la ubicación (lat, lng, precisión) y la selfie. La selfie se sube primero; si la checada no
 * se registra (fuera de la obra, por ejemplo), se borra.
 */
export async function checarAhora(formulario: FormData): Promise<RespuestaChecada> {
  const llave = await leerLlaveChecada();
  const numero = (campo: string) => {
    const v = Number(formulario.get(campo));
    return Number.isFinite(v) ? v : NaN;
  };
  const tipo = formulario.get('tipo') === 'salida' ? 'salida' : 'entrada';
  const foto = formulario.get('foto');
  const nada = { obra: null, distancia: null, en: null, horas: null };
  const t = await sinUsuario(servidor(), (tx) => trabajadorDeLlave(tx, llave));
  if (!t) return { resultado: 'sin_acceso', ...nada };
  if (
    !(foto instanceof Blob) ||
    foto.size === 0 ||
    foto.size > LIMITE_FOTO ||
    !foto.type.startsWith('image/')
  )
    return { resultado: 'sin_foto', ...nada };
  const ruta = `${t.empresaId}/checadas/${t.trabajadorId}/${randomUUID()}.jpg`;
  await subirSelfie(ruta, foto);
  const r = await sinUsuario(servidor(), (tx) =>
    checar(tx, llave, {
      tipo,
      lat: numero('lat'),
      lng: numero('lng'),
      precision: Number.isNaN(numero('precision')) ? null : numero('precision'),
      foto: ruta,
      capturada: String(formulario.get('capturada') ?? '') || null,
    }),
  ).catch(async (e) => {
    await borrarSelfie(ruta).catch(() => {});
    if (esErrorDeNegocio(e)) return null;
    throw e;
  });
  if (!r) return { resultado: 'gps_impreciso', ...nada };
  if (r.resultado !== 'ok') await borrarSelfie(ruta).catch(() => {});
  return {
    resultado: r.resultado,
    obra: r.obra,
    distancia: r.distancia,
    en: r.en?.toISOString() ?? null,
    horas: r.horas,
  };
}

export interface EnlaceDeChecada {
  readonly nombre: string;
  readonly enlace: string;
}

/** La invitación para que el trabajador active la checada en su celular. */
export async function invitarAChecar(
  trabajadorId: string,
  nombre: string,
  _previo: Resultado<EnlaceDeChecada> | null,
): Promise<Resultado<EnlaceDeChecada>> {
  const r = await comoMiembro(
    (tx) => invitarTrabajadorChecada(tx, { trabajadorId }),
    await exigirDuenoCon('checada'),
  );
  if (!r.ok) return r;
  revalidatePath('/cuadrilla');
  return { ok: true, datos: { nombre, enlace: await enlaceDeLaApp(`/checar/invitacion/${r.datos.token}`) } };
}

export async function quitarChecada(trabajadorId: string): Promise<void> {
  await comoMiembro((tx) => quitarAccesoTrabajador(tx, { trabajadorId }), await exigirDuenoCon('checada'));
  revalidatePath('/cuadrilla');
}

export async function ponerSalida(
  entradaId: string,
  _previo: Resultado | null,
  formulario: FormData,
): Promise<Resultado> {
  const entrada = {
    entradaId,
    hora: String(formulario.get('hora') ?? ''),
    motivo: String(formulario.get('motivo') ?? ''),
  };
  const r = await comoMiembro((tx) => corregirSalida(tx, entrada), await exigirDuenoCon('checada'));
  if (r.ok) revalidatePath('/checadas');
  return r.ok ? { ok: true, datos: undefined } : r;
}

export async function anularLaChecada(
  checadaId: string,
  _previo: Resultado | null,
  formulario: FormData,
): Promise<Resultado> {
  const motivo = String(formulario.get('motivo') ?? '');
  const r = await comoMiembro(
    (tx) => anularChecada(tx, { checadaId, motivo }),
    await exigirDuenoCon('checada'),
  );
  if (r.ok) revalidatePath('/checadas');
  return r.ok ? { ok: true, datos: undefined } : r;
}

/** Fijar la geocerca de la obra con la ubicación de quien está en ella. */
export async function fijarUbicacion(
  obraId: string,
  ubicacion: { lat: number; lng: number; radio: number },
): Promise<Resultado> {
  const r = await comoMiembro(
    (tx) => fijarGeocerca(tx, { obraId, ...ubicacion }),
    await exigirAccesoCon('checada'),
  );
  if (r.ok) revalidatePath(`/obras/${obraId}/ubicacion`);
  return r.ok ? { ok: true, datos: undefined } : r;
}
