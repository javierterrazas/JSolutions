// La plataforma (D-080): quien la administra da de alta empresas, les pone plan, precio y vencimiento, anota sus pagos,
// las suspende y reinvita a su dueño. Todo pasa por funciones de la base (20261020000100_plataforma.sql), que
// revisan que el usuario de la sesión administre la plataforma y devuelven de cada empresa solo su cuenta: nada de sus
// obras, sus clientes ni su dinero. Aquí también, lo que cada empresa ve de su propia suscripción.
import {
  type Ciclo,
  DIAS_INVITACION,
  type Dia,
  ErrorDeNegocio,
  type EstadoSuscripcion,
  finDeGracia,
  hoyEn,
} from '@ijm/core';
import postgres from 'postgres';
import { z } from 'zod';
import { cuentaDeCelular, nuevoSecreto, type UsuarioDeCorreo } from './acceso';
import type { Tx } from './conexion';
import { dia, uuid, validarEntrada } from './entrada';

export type Plan = 'basico' | 'pro' | 'empresa';
export type MetodoPagoPlataforma = 'zelle' | 'transferencia' | 'efectivo' | 'tarjeta' | 'otro';

const DE_LA_BASE = new Set(['solo_plataforma', 'empresa_no_encontrada', 'correo_ya_registrado', 'sin_dueno']);

async function deLaBase<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof postgres.PostgresError && e.code === 'P0001' && DE_LA_BASE.has(e.message))
      throw new ErrorDeNegocio(e.message);
    throw e;
  }
}

/** Hoy para la plataforma: en Austin, donde está quien la administra. */
export const hoyDeLaPlataforma = (ahora = new Date()): Dia => hoyEn(ahora, 'America/Chicago');

/** Si el usuario de la sesión administra la plataforma. */
export async function esAdminPlataforma(tx: Tx): Promise<boolean> {
  const [r] = await tx<{ si: boolean }[]>`select public.es_admin_plataforma() as si`;
  return r!.si;
}

export interface EmpresaDeLaPlataforma {
  readonly id: string;
  readonly nombre: string;
  readonly ciudad: string | null;
  readonly activa: boolean;
  readonly creadaEn: Date;
  readonly plan: Plan;
  readonly precio: number;
  readonly ciclo: Ciclo;
  readonly enPrueba: boolean;
  /** El último día pagado; null, no vence. */
  readonly venceEl: Dia | null;
  readonly notas: string | null;
  readonly estado: EstadoSuscripcion;
  readonly dueno: string | null;
  /** El correo que dio el dueño (opcional desde D-083). */
  readonly correo: string | null;
  /** El celular del dueño (+15125550101); null en los que se dieron de alta con correo. */
  readonly telefono: string | null;
  /** PMs activos. */
  readonly pms: number;
  /** Obras listas para arrancar, en obra o en cierre. */
  readonly obrasEnCurso: number;
  readonly obras: number;
  /** La última vez que alguien de la empresa abrió la app. */
  readonly ultimoUso: Date | null;
  readonly ultimoPago: { readonly dia: Dia; readonly monto: number } | null;
}

/** Las empresas de la plataforma, por nombre. Solo quien la administra. */
export async function empresasDeLaPlataforma(tx: Tx): Promise<EmpresaDeLaPlataforma[]> {
  const filas = await deLaBase(
    () => tx<
      {
        id: string;
        nombre: string;
        ciudad: string | null;
        activa: boolean;
        creada_en: Date;
        plan: Plan;
        precio: string;
        ciclo: Ciclo;
        en_prueba: boolean;
        vence_el: Dia | null;
        notas: string | null;
        estado: EstadoSuscripcion;
        dueno: string | null;
        correo: string | null;
        telefono: string | null;
        pms: number;
        obras_en_curso: number;
        obras: number;
        ultimo_uso: Date | null;
        ultimo_pago: Dia | null;
        ultimo_monto: string | null;
      }[]
    >`
      select id, nombre, ciudad, activa, creada_en, plan, precio, ciclo, en_prueba,
             to_char(vence_el, 'YYYY-MM-DD') as vence_el, notas, estado, dueno, correo, telefono, pms,
             obras_en_curso, obras,
             ultimo_uso, to_char(ultimo_pago, 'YYYY-MM-DD') as ultimo_pago, ultimo_monto
      from public.plataforma_empresas()`,
  );
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    ciudad: f.ciudad,
    activa: f.activa,
    creadaEn: f.creada_en,
    plan: f.plan,
    precio: Number(f.precio),
    ciclo: f.ciclo,
    enPrueba: f.en_prueba,
    venceEl: f.vence_el,
    notas: f.notas,
    estado: f.estado,
    dueno: f.dueno,
    correo: f.correo,
    telefono: f.telefono,
    pms: f.pms,
    obrasEnCurso: f.obras_en_curso,
    obras: f.obras,
    ultimoUso: f.ultimo_uso,
    ultimoPago: f.ultimo_pago ? { dia: f.ultimo_pago, monto: Number(f.ultimo_monto) } : null,
  }));
}

export interface PagoPlataforma {
  readonly id: string;
  readonly monto: number;
  readonly pagadoEl: Dia;
  readonly metodo: MetodoPagoPlataforma;
  readonly referencia: string | null;
  readonly venciaEl: Dia | null;
  readonly venceEl: Dia;
}

/** Una empresa con sus pagos, del más reciente al más viejo; null si no existe. Solo quien administra. */
export async function empresaDeLaPlataforma(
  tx: Tx,
  entrada: { empresaId: string },
): Promise<{ empresa: EmpresaDeLaPlataforma; pagos: PagoPlataforma[] } | null> {
  const { empresaId } = validarEntrada(z.object({ empresaId: uuid }), entrada);
  const empresa = (await empresasDeLaPlataforma(tx)).find((e) => e.id === empresaId);
  if (!empresa) return null;
  const pagos = await tx<
    {
      id: string;
      monto: string;
      pagado_el: Dia;
      metodo: MetodoPagoPlataforma;
      referencia: string | null;
      vencia_el: Dia | null;
      vence_el: Dia;
    }[]
  >`
    select id, monto, to_char(pagado_el, 'YYYY-MM-DD') as pagado_el, metodo, referencia,
           to_char(vencia_el, 'YYYY-MM-DD') as vencia_el, to_char(vence_el, 'YYYY-MM-DD') as vence_el
    from public.plataforma_pagos(${empresaId})`;
  return {
    empresa,
    pagos: pagos.map((p) => ({
      id: p.id,
      monto: Number(p.monto),
      pagadoEl: p.pagado_el,
      metodo: p.metodo,
      referencia: p.referencia,
      venciaEl: p.vencia_el,
      venceEl: p.vence_el,
    })),
  };
}

const plan = z.enum(['basico', 'pro', 'empresa']);
const ciclo = z.enum(['mensual', 'anual']);
const dinero = z.coerce.number().min(0).max(100_000);

const EntradaSuscripcion = z.object({
  empresaId: uuid,
  plan,
  precio: dinero,
  ciclo,
  enPrueba: z.boolean(),
  venceEl: dia.nullable(),
  notas: z.string().trim().max(500).default(''),
});
export type EntradaSuscripcion = z.input<typeof EntradaSuscripcion>;

/** El plan, el precio, el ciclo, si está a prueba, hasta cuándo y unas notas. Solo quien administra. */
export async function guardarSuscripcion(tx: Tx, entrada: EntradaSuscripcion): Promise<void> {
  const e = validarEntrada(EntradaSuscripcion, entrada);
  await deLaBase(
    () => tx`
      select public.plataforma_guardar_suscripcion(${e.empresaId}, ${e.plan}, ${e.precio}, ${e.ciclo}, ${e.enPrueba},
                                                   ${e.venceEl}, ${e.notas})`,
  );
}

const EntradaPago = z.object({
  empresaId: uuid,
  monto: z.coerce.number().positive().max(100_000),
  pagadoEl: dia,
  metodo: z.enum(['zelle', 'transferencia', 'efectivo', 'tarjeta', 'otro']),
  referencia: z.string().trim().max(120).default(''),
  /** Hasta cuándo cubre: la suscripción vence ese día. */
  venceEl: dia,
});
export type EntradaPagoPlataforma = z.input<typeof EntradaPago>;

/** Anota un pago; la suscripción vence en la fecha que cubre y deja de estar a prueba. Solo quien administra. */
export async function registrarPagoPlataforma(
  tx: Tx,
  entrada: EntradaPagoPlataforma,
  ahora = new Date(),
): Promise<string> {
  const e = validarEntrada(EntradaPago, entrada);
  if (e.pagadoEl > hoyDeLaPlataforma(ahora)) throw new ErrorDeNegocio('fecha_futura');
  if (e.venceEl < e.pagadoEl) throw new ErrorDeNegocio('vencimiento_antes_del_pago');
  const [r] = await deLaBase(
    () => tx<{ id: string }[]>`
      select public.plataforma_registrar_pago(${e.empresaId}, ${e.monto}, ${e.pagadoEl}, ${e.metodo},
                                              ${e.referencia}, ${e.venceEl}) as id`,
  );
  return r!.id;
}

/** Suspender (nadie de la empresa entra) o reactivar. Solo quien administra. */
export async function cambiarActivaEmpresa(
  tx: Tx,
  entrada: { empresaId: string; activa: boolean },
): Promise<void> {
  const e = validarEntrada(z.object({ empresaId: uuid, activa: z.boolean() }), entrada);
  await deLaBase(() => tx`select public.plataforma_cambiar_activa(${e.empresaId}, ${e.activa})`);
}

const EntradaAlta = z.object({
  empresa: z.string().trim().min(1).max(120),
  ciudad: z.string().trim().max(120).default(''),
  zona: z.string().trim().min(1).max(60).default('America/Chicago'),
  idioma: z.enum(['es', 'en']).default('es'),
  dueno: z.string().trim().min(1).max(80),
  /** El celular del dueño: con él entra (D-083). */
  celular: z.string().trim().max(30),
  /** Opcional: para avisos. */
  correo: z.union([z.literal(''), z.string().trim().toLowerCase().pipe(z.email())]).nullish(),
  plan,
  precio: dinero,
  ciclo,
  enPrueba: z.boolean(),
  venceEl: dia.nullable(),
});
export type EntradaAltaEmpresa = z.input<typeof EntradaAlta>;

export interface InvitacionDelDueno {
  readonly empresaId: string;
  readonly dueno: string;
  /** El token del enlace. Solo existe aquí: la base guarda su hash. */
  readonly token: string;
  readonly expira: Date;
}

const venceLaInvitacion = (ahora: Date) => new Date(ahora.getTime() + DIAS_INVITACION * 24 * 3600 * 1000);

/** Da de alta una empresa con su dueño y su suscripción, y devuelve la invitación del dueño. Solo quien administra. */
export async function altaDeEmpresa(
  tx: Tx,
  entrada: EntradaAltaEmpresa,
  usuarioDeCorreo: UsuarioDeCorreo,
  ahora = new Date(),
): Promise<InvitacionDelDueno> {
  const e = validarEntrada(EntradaAlta, entrada);
  const cuenta = cuentaDeCelular(e.celular);
  // antes de crear el usuario de Auth: quien no administra no debe poder crearlo
  if (!(await esAdminPlataforma(tx))) throw new ErrorDeNegocio('solo_plataforma');
  const userId = await usuarioDeCorreo(cuenta.correo);
  const token = nuevoSecreto();
  const expira = venceLaInvitacion(ahora);
  const [r] = await deLaBase(
    () => tx<{ id: string }[]>`
      select public.plataforma_alta_empresa(${e.empresa}, ${e.ciudad}, ${e.zona}, ${e.idioma}, ${userId}, ${e.dueno},
                                            ${token}, ${expira}, ${e.plan}, ${e.precio}, ${e.ciclo}, ${e.enPrueba},
                                            ${e.venceEl}, ${cuenta.celular}, ${e.correo || null}) as id`,
  ).catch((err: unknown) => {
    if (err instanceof ErrorDeNegocio && err.codigo === 'correo_ya_registrado')
      throw new ErrorDeNegocio('celular_ya_registrado');
    throw err;
  });
  return { empresaId: r!.id, dueno: e.dueno, token, expira };
}

/** Otra invitación para el dueño de una empresa; anula las que no usó. Solo quien administra. */
export async function reinvitarDueno(
  tx: Tx,
  entrada: { empresaId: string },
  ahora = new Date(),
): Promise<InvitacionDelDueno> {
  const { empresaId } = validarEntrada(z.object({ empresaId: uuid }), entrada);
  const token = nuevoSecreto();
  const expira = venceLaInvitacion(ahora);
  const [r] = await deLaBase(
    () => tx<{ nombre: string }[]>`
      select public.plataforma_reinvitar_dueno(${empresaId}, ${token}, ${expira}) as nombre`,
  );
  return { empresaId, dueno: r!.nombre, token, expira };
}

export interface MiSuscripcion {
  readonly estado: EstadoSuscripcion;
  readonly venceEl: Dia | null;
  readonly enPrueba: boolean;
  /** El último día de gracia, si tiene vencimiento. */
  readonly graciaHasta: Dia | null;
}

/** La suscripción de la empresa de la sesión, para los avisos del inicio. */
export async function miSuscripcion(tx: Tx): Promise<MiSuscripcion | null> {
  const [r] = await tx<{ estado: EstadoSuscripcion; vence_el: Dia | null; en_prueba: boolean }[]>`
    select estado, to_char(vence_el, 'YYYY-MM-DD') as vence_el, en_prueba from public.mi_suscripcion()`;
  if (!r) return null;
  return {
    estado: r.estado,
    venceEl: r.vence_el,
    enPrueba: r.en_prueba,
    graciaHasta: r.vence_el ? finDeGracia(r.vence_el) : null,
  };
}

/** El nombre de la empresa suspendida del usuario de la sesión, para decirle por qué no entra; null si no lo es. */
export async function miEmpresaSuspendida(tx: Tx): Promise<string | null> {
  const [r] = await tx<{ nombre: string | null }[]>`select public.mi_empresa_suspendida() as nombre`;
  return r?.nombre ?? null;
}

/**
 * Si un error es el de la base cuando la empresa está en solo lectura (la gracia ya pasó): la capa web lo convierte
 * en un error de negocio, `suscripcion_vencida`, para decírselo a quien intentó guardar.
 */
export const esSuscripcionVencida = (e: unknown): boolean =>
  e instanceof postgres.PostgresError && e.code === 'P0001' && e.message === 'suscripcion_vencida';
