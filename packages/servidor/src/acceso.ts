// Entrar a la app: invitar, canjear la invitación en el celular, el PIN, quitar celulares y dar de baja (D-024,
// D-038). Lo delicado (la llave del celular, el PIN y sus intentos) lo guardan y revisan funciones de la base
// (20261007000100_acceso.sql); aquí se validan las entradas y las reglas de @ijm/core, y se traducen los rechazos.
import { randomBytes } from 'node:crypto';
import { DIAS_INVITACION, ErrorDeNegocio, validarPin } from '@ijm/core';
import postgres from 'postgres';
import { z } from 'zod';
import type { Tx } from './conexion';
import { uuid, validarEntrada } from './entrada';
import { exigirDueno, leerSesion } from './sesion';

/** Un secreto al azar, para el enlace de una invitación o la llave de un celular: 32 bytes en base64url. */
export const nuevoSecreto = (): string => randomBytes(32).toString('base64url');

/**
 * El usuario de Auth de un correo: lo crea si no existe (con la API de Auth y el service role, sin mandarle nada)
 * y devuelve su id. La capa web y las pruebas dan la implementación.
 */
export type UsuarioDeCorreo = (correo: string) => Promise<string>;

// Los rechazos de las funciones de la base que son de negocio (SQLSTATE P0001 con el código como mensaje).
const DE_LA_BASE = new Set([
  'correo_ya_registrado',
  'miembro_no_activo',
  'miembro_invalido',
  'dispositivo_invalido',
  'pin_ya_fijado',
  'pin_invalido',
]);

async function enLaBase<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof postgres.PostgresError && e.code === 'P0001' && DE_LA_BASE.has(e.message))
      throw new ErrorDeNegocio(e.message);
    throw e;
  }
}

const venceEn = (ahora: Date) => new Date(ahora.getTime() + DIAS_INVITACION * 24 * 3600 * 1000);

export interface Invitacion {
  readonly miembroId: string;
  /** El token del enlace. Solo existe aquí: la base guarda su hash. */
  readonly token: string;
  readonly expira: Date;
}

const EntradaInvitar = z.object({
  nombre: z.string().trim().min(1).max(80),
  correo: z.string().trim().toLowerCase().pipe(z.email()),
  idioma: z.enum(['es', 'en']).default('es'),
});
export type EntradaInvitar = z.input<typeof EntradaInvitar>;

/** El dueño da de alta a un PM y lo invita. Un correo que ya es de un miembro, de cualquier empresa, no se invita. */
export async function invitarPm(
  tx: Tx,
  entrada: EntradaInvitar,
  usuarioDeCorreo: UsuarioDeCorreo,
  ahora = new Date(),
): Promise<Invitacion> {
  exigirDueno(await leerSesion(tx, ahora));
  const e = validarEntrada(EntradaInvitar, entrada);
  const userId = await usuarioDeCorreo(e.correo);
  const token = nuevoSecreto();
  const expira = venceEn(ahora);
  const [r] = await enLaBase(
    () => tx<{ id: string }[]>`
      select public.invitar_pm(${userId}, ${e.nombre}, ${e.idioma}, ${token}, ${expira}) as id`,
  );
  return { miembroId: r!.id, token, expira };
}

/** Otra invitación para un miembro activo (un celular nuevo, o el propio del dueño). Anula las que no se usaron. */
export async function reinvitar(
  tx: Tx,
  entrada: { miembroId: string },
  ahora = new Date(),
): Promise<Invitacion> {
  exigirDueno(await leerSesion(tx, ahora));
  const { miembroId } = validarEntrada(z.object({ miembroId: uuid }), entrada);
  const token = nuevoSecreto();
  const expira = venceEn(ahora);
  await enLaBase(() => tx`select public.reinvitar(${miembroId}, ${token}, ${expira})`);
  return { miembroId, token, expira };
}

export async function anularInvitacion(
  tx: Tx,
  entrada: { invitacionId: string },
  ahora = new Date(),
): Promise<void> {
  exigirDueno(await leerSesion(tx, ahora));
  const { invitacionId } = validarEntrada(z.object({ invitacionId: uuid }), entrada);
  await tx`select public.anular_invitacion(${invitacionId})`;
}

export interface Canje {
  readonly userId: string;
  readonly correo: string;
  readonly dispositivoId: string;
  /** La llave del celular: va a su cookie y no se guarda en ningún otro lado. */
  readonly secreto: string;
}

const EntradaCanje = z.object({
  token: z.string().min(20).max(200),
  nombreDispositivo: z.string().trim().max(80).default(''),
});

/**
 * Canjea la invitación: el celular queda verificado con una llave nueva. Se corre SIN identidad (`sinUsuario`),
 * porque todavía no hay sesión. Un token que no sirve es `invitacion_invalida`, sin decir por qué.
 */
export async function canjearInvitacion(tx: Tx, entrada: z.input<typeof EntradaCanje>): Promise<Canje> {
  const { token, nombreDispositivo } = validarEntrada(EntradaCanje, entrada);
  const secreto = nuevoSecreto();
  const [r] = await tx<{ user_id: string; correo: string; dispositivo_id: string }[]>`
    select * from public.canjear_invitacion(${token}, ${secreto}, ${nombreDispositivo})`;
  if (!r) throw new ErrorDeNegocio('invitacion_invalida');
  return { userId: r.user_id, correo: r.correo, dispositivoId: r.dispositivo_id, secreto };
}

/** La llave de un celular, como la guarda su cookie. */
export interface Llave {
  readonly dispositivoId: string;
  readonly secreto: string;
}
const EntradaLlave = z.object({ dispositivoId: uuid, secreto: z.string().min(20).max(200) });

/** Anota la sesión de Auth que se abrió en el celular, para cerrarla si se revoca. Ya con la identidad del miembro. */
export async function fijarSesionDispositivo(tx: Tx, entrada: Llave & { sesionId: string }): Promise<void> {
  const { dispositivoId, secreto, sesionId } = validarEntrada(
    EntradaLlave.extend({ sesionId: uuid }),
    entrada,
  );
  await enLaBase(() => tx`select public.fijar_sesion_dispositivo(${dispositivoId}, ${secreto}, ${sesionId})`);
}

/** El primer PIN del celular, con las reglas de su rol. Abre la sesión. */
export async function fijarPin(
  tx: Tx,
  entrada: Llave & { pin: string },
  ahora = new Date(),
): Promise<{ hasta: Date }> {
  const { dispositivoId, secreto, pin } = validarEntrada(EntradaLlave.extend({ pin: z.string() }), entrada);
  validarPin(pin, (await leerSesion(tx, ahora)).rol);
  const [r] = await enLaBase(
    () => tx<{ hasta: Date }[]>`select public.fijar_pin(${dispositivoId}, ${secreto}, ${pin}) as hasta`,
  );
  return { hasta: r!.hasta };
}

export type ResultadoPin =
  | { readonly resultado: 'ok'; readonly hasta: string }
  | { readonly resultado: 'pin_incorrecto'; readonly quedan: number }
  | { readonly resultado: 'pin_bloqueado'; readonly hasta: string }
  | { readonly resultado: 'dispositivo_invalido' | 'sin_pin' };

/**
 * Entrar con el PIN. No lanza error por un PIN equivocado: devuelve el resultado, y la transacción tiene que
 * confirmarse para que cuente el intento fallido.
 */
export async function entrarConPin(tx: Tx, entrada: Llave & { pin: string }): Promise<ResultadoPin> {
  const { dispositivoId, secreto, pin } = validarEntrada(
    EntradaLlave.extend({ pin: z.string().max(12) }),
    entrada,
  );
  const [r] = await tx<{ r: ResultadoPin }[]>`
    select public.entrar_con_pin(${dispositivoId}, ${secreto}, ${pin}) as r`;
  return r!.r;
}

export type EstadoDispositivo = 'abierto' | 'cerrado' | 'sin_pin' | 'invalido';

/** Cómo está el celular en esta petición: abierto, pide el PIN, falta elegirlo, o no sirve. */
export async function estadoDispositivo(tx: Tx, entrada: Llave): Promise<EstadoDispositivo> {
  const r = EntradaLlave.safeParse(entrada);
  if (!r.success) return 'invalido';
  const [e] = await tx<{ estado: EstadoDispositivo }[]>`
    select public.estado_dispositivo(${r.data.dispositivoId}, ${r.data.secreto}) as estado`;
  return e!.estado;
}

/** Cerrar la sesión de este celular: la próxima vez pide el PIN. */
export async function cerrarDispositivo(tx: Tx, entrada: Llave): Promise<void> {
  const { dispositivoId, secreto } = validarEntrada(EntradaLlave, entrada);
  await tx`select public.cerrar_dispositivo(${dispositivoId}, ${secreto})`;
}

/** Quitar un celular: el dueño, cualquiera de su empresa; cada miembro, los suyos. */
export async function revocarDispositivo(tx: Tx, entrada: { dispositivoId: string }): Promise<void> {
  const { dispositivoId } = validarEntrada(z.object({ dispositivoId: uuid }), entrada);
  await enLaBase(() => tx`select public.revocar_dispositivo(${dispositivoId})`);
}

/** Dar de baja o volver a activar a un miembro. La baja le corta el acceso en ese instante. */
export async function cambiarActivo(
  tx: Tx,
  entrada: { miembroId: string; activo: boolean },
  ahora = new Date(),
): Promise<void> {
  exigirDueno(await leerSesion(tx, ahora));
  const { miembroId, activo } = validarEntrada(z.object({ miembroId: uuid, activo: z.boolean() }), entrada);
  await enLaBase(() => tx`select public.cambiar_activo(${miembroId}, ${activo})`);
}

/** El idioma del miembro de la sesión: lo sigue en cualquier celular. */
export async function cambiarMiIdioma(tx: Tx, idioma: string): Promise<void> {
  const i = validarEntrada(z.enum(['es', 'en']), idioma);
  await tx`select public.cambiar_mi_idioma(${i})`;
}

export interface Yo {
  readonly miembroId: string;
  readonly nombre: string;
  readonly rol: 'dueno' | 'admin' | 'pm';
  readonly idioma: 'es' | 'en';
}

/** Quién es el usuario de la sesión. Sin miembro activo: `sin_acceso`. */
export async function quienSoy(tx: Tx): Promise<Yo> {
  const [m] = await tx<Yo[]>`
    select id as "miembroId", nombre, rol, idioma from public.miembros where id = public.miembro_actual()`;
  if (!m) throw new ErrorDeNegocio('sin_acceso');
  return m;
}

export interface MiembroDelEquipo {
  readonly id: string;
  readonly nombre: string;
  readonly rol: 'dueno' | 'admin' | 'pm';
  readonly activo: boolean;
  readonly dispositivos: readonly {
    id: string;
    nombre: string;
    verificadoEn: string;
    ultimoUso: string | null;
  }[];
  /** La invitación pendiente más reciente, si hay. */
  readonly invitacion: { id: string; expira: string } | null;
}

/** El equipo de la empresa, para el dueño: cada miembro con sus celulares y su invitación pendiente. */
export async function equipo(tx: Tx, ahora = new Date()): Promise<MiembroDelEquipo[]> {
  exigirDueno(await leerSesion(tx, ahora));
  return tx<MiembroDelEquipo[]>`
    select m.id, m.nombre, m.rol, m.activo,
           coalesce((select json_agg(json_build_object('id', d.id, 'nombre', d.nombre, 'verificadoEn', d.verificado_en,
                                                       'ultimoUso', d.ultimo_uso) order by d.verificado_en)
                     from public.dispositivos d where d.miembro_id = m.id and d.revocado_en is null), '[]') as dispositivos,
           (select json_build_object('id', i.id, 'expira', i.expira_en)
            from public.invitaciones i
            where i.miembro_id = m.id and i.usada_en is null and i.anulada_en is null and i.expira_en > ${ahora}
            order by i.creado_en desc limit 1) as invitacion
    from public.miembros m
    order by m.rol = 'dueno' desc, m.activo desc, m.nombre`;
}
