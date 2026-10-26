// La checada con GPS y selfie (D-117). El trabajador checa entrada y salida en su celular, dentro de la geocerca de la
// obra, con una selfie; sus horas reemplazan la cuadrilla del cierre del PM (cada salida escribe en mano_obra). El
// trabajador no tiene sesión: su celular tiene una llave que sale de una invitación de un solo uso (como el portal del
// cliente). Aquí: la geocerca de la obra, las invitaciones y llaves, checar, y lo que ven el dueño y el PM.
import { DIAS_INVITACION, type Dia, ErrorDeNegocio } from '@ijm/core';
import postgres from 'postgres';
import { z } from 'zod';
import { nuevoSecreto } from './acceso';
import type { Tx } from './conexion';
import { dia, uuid, validarEntrada } from './entrada';
import { exigirDueno, exigirModulo, leerSesion } from './sesion';

// Los rechazos de las funciones de la base que son de negocio (SQLSTATE P0001 con el código como mensaje).
const DE_LA_BASE = new Set([
  'obra_no_encontrada',
  'modulo_no_incluido',
  'trabajador_invalido',
  'checada_invalida',
  'hora_invalida',
  'motivo_requerido',
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

/** La llave del celular del trabajador, como la guarda su cookie. */
export interface LlaveTrabajador {
  readonly accesoId: string;
  readonly secreto: string;
}
const EsquemaLlave = z.object({ accesoId: uuid, secreto: z.string().min(20).max(200) });
const llaveValida = (llave: LlaveTrabajador | null) => EsquemaLlave.safeParse(llave).data ?? null;

/**
 * La geocerca de una obra: el punto (la ubicación de quien está en la obra) y el radio en metros. El dueño, el
 * administrador o el PM de la obra. Errores: `obra_no_encontrada`, `datos_invalidos`.
 */
export async function fijarGeocerca(
  tx: Tx,
  entrada: { obraId: string; lat: number; lng: number; radio?: number },
): Promise<void> {
  const e = validarEntrada(
    z.object({
      obraId: uuid,
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      radio: z.number().int().min(30).max(2000).default(150),
    }),
    entrada,
  );
  await leerSesion(tx);
  await enLaBase(() => tx`select public.fijar_geocerca(${e.obraId}, ${e.lat}, ${e.lng}, ${e.radio})`);
}

export interface GeocercaDeObra {
  readonly obra: { id: string; folio: string; cliente: string };
  readonly lat: number | null;
  readonly lng: number | null;
  readonly radio: number;
}

/** La geocerca de una obra que el miembro ve (el PM, solo las suyas); null si no la ve. */
export async function geocercaDeObra(tx: Tx, entrada: { obraId: string }): Promise<GeocercaDeObra | null> {
  const { obraId } = validarEntrada(z.object({ obraId: uuid }), entrada);
  await leerSesion(tx);
  const [o] = await tx<
    { id: string; folio: string; cliente: string; lat: string | null; lng: string | null; radio: number }[]
  >`
    select id, folio, cliente, geocerca_lat as lat, geocerca_lng as lng, geocerca_radio as radio
    from obras where id = ${obraId}`;
  if (!o) return null;
  return {
    obra: { id: o.id, folio: o.folio, cliente: o.cliente },
    lat: o.lat === null ? null : Number(o.lat),
    lng: o.lng === null ? null : Number(o.lng),
    radio: o.radio,
  };
}

/**
 * Una invitación para que el trabajador active la checada en su celular; anula las anteriores que no usó. Devuelve el
 * token (va en el enlace; la base guarda su huella). Solo el dueño o el administrador, con el módulo.
 */
export async function invitarTrabajadorChecada(
  tx: Tx,
  entrada: { trabajadorId: string },
  ahora = new Date(),
): Promise<{ token: string }> {
  const { trabajadorId } = validarEntrada(z.object({ trabajadorId: uuid }), entrada);
  exigirDueno(await leerSesion(tx, ahora));
  const token = nuevoSecreto();
  const expira = new Date(ahora.getTime() + DIAS_INVITACION * 24 * 3600 * 1000);
  await enLaBase(() => tx`select public.invitar_trabajador_checada(${trabajadorId}, ${token}, ${expira})`);
  return { token };
}

/** Quitarle la checada al celular del trabajador (y anular su invitación pendiente). Dueño o administrador. */
export async function quitarAccesoTrabajador(tx: Tx, entrada: { trabajadorId: string }): Promise<void> {
  const { trabajadorId } = validarEntrada(z.object({ trabajadorId: uuid }), entrada);
  exigirDueno(await leerSesion(tx));
  await tx`select public.quitar_acceso_trabajador(${trabajadorId})`;
}

export interface AccesoDeTrabajador {
  /** Con la checada activa en un celular, o con una invitación sin usar. */
  readonly estado: 'activo' | 'pendiente';
  readonly dispositivo: string | null;
  readonly ultimoUso: Date | null;
  readonly expira: Date;
}

/** La checada de cada trabajador de la empresa: su celular activo o su invitación pendiente. Dueño o administrador. */
export async function accesosDeTrabajadores(tx: Tx): Promise<Map<string, AccesoDeTrabajador>> {
  exigirDueno(await leerSesion(tx));
  const filas = await tx<
    {
      trabajador_id: string;
      usado: boolean;
      dispositivo: string | null;
      ultimo_uso: Date | null;
      expira_en: Date;
    }[]
  >`
    select distinct on (trabajador_id) trabajador_id, usado_en is not null as usado, dispositivo, ultimo_uso,
           expira_en
    from accesos_trabajador
    where revocado_en is null and (usado_en is not null or (anulado_en is null and expira_en > now()))
    order by trabajador_id, usado_en is not null desc, creado_en desc`;
  return new Map(
    filas.map((f) => [
      f.trabajador_id,
      {
        estado: f.usado ? 'activo' : 'pendiente',
        dispositivo: f.dispositivo,
        ultimoUso: f.ultimo_uso,
        expira: f.expira_en,
      },
    ]),
  );
}

export type EstadoAccesoTrabajador = 'tuya' | 'usada' | 'anulada' | 'vencida' | 'invalida' | 'vigente';

/** Por qué una invitación de checada no se puede canjear (como estadoDeInvitacion, D-115). Sin sesión. */
export async function estadoDeAccesoTrabajador(
  tx: Tx,
  entrada: { token: string; llave: LlaveTrabajador | null },
): Promise<EstadoAccesoTrabajador> {
  const { token } = validarEntrada(z.object({ token: z.string().min(20).max(200) }), {
    token: entrada.token,
  });
  const llave = llaveValida(entrada.llave);
  const [r] = await tx<{ estado: EstadoAccesoTrabajador }[]>`
    select public.estado_acceso_trabajador(${token}, ${llave?.accesoId ?? null}, ${llave?.secreto ?? null})
      as estado`;
  return r!.estado;
}

/**
 * Canjear la invitación de checada en el celular del trabajador: devuelve la llave para su cookie. Los celulares que
 * tenía antes dejan de servir. Sin sesión. Error: `invitacion_invalida`.
 */
export async function canjearAccesoTrabajador(
  tx: Tx,
  entrada: { token: string; dispositivo?: string },
): Promise<LlaveTrabajador & { trabajador: string }> {
  const e = validarEntrada(
    z.object({ token: z.string().min(20).max(200), dispositivo: z.string().trim().max(80).default('') }),
    entrada,
  );
  const secreto = nuevoSecreto();
  const [r] = await tx<{ acceso_id: string; trabajador: string }[]>`
    select * from public.canjear_acceso_trabajador(${e.token}, ${secreto}, ${e.dispositivo})`;
  if (!r) throw new ErrorDeNegocio('invitacion_invalida');
  return { accesoId: r.acceso_id, secreto, trabajador: r.trabajador };
}

export interface TrabajadorDeLaChecada {
  readonly trabajadorId: string;
  readonly nombre: string;
  readonly empresaId: string;
  readonly empresa: string;
  readonly zona: string;
  readonly tipoPago: 'hora' | 'dia';
  /** Su entrada sin salida, si tiene. */
  readonly dentro: { readonly entradaId: string; readonly desde: Date; readonly obra: string } | null;
}

/** Quién es el trabajador de esta llave y si está dentro; null si la llave no sirve. Sin sesión. */
export async function trabajadorDeLlave(
  tx: Tx,
  llave: LlaveTrabajador | null,
): Promise<TrabajadorDeLaChecada | null> {
  const l = llaveValida(llave);
  if (!l) return null;
  const [r] = await tx<
    {
      trabajador_id: string;
      nombre: string;
      empresa_id: string;
      empresa: string;
      zona: string;
      tipo_pago: 'hora' | 'dia';
      entrada_id: string | null;
      entrada_en: Date | null;
      entrada_obra: string | null;
    }[]
  >`select * from public.trabajador_de_acceso(${l.accesoId}, ${l.secreto})`;
  if (!r) return null;
  return {
    trabajadorId: r.trabajador_id,
    nombre: r.nombre,
    empresaId: r.empresa_id,
    empresa: r.empresa,
    zona: r.zona,
    tipoPago: r.tipo_pago,
    dentro: r.entrada_id ? { entradaId: r.entrada_id, desde: r.entrada_en!, obra: r.entrada_obra! } : null,
  };
}

export type ResultadoChecada =
  'ok' | 'fuera' | 'sin_obras' | 'gps_impreciso' | 'ya_dentro' | 'sin_entrada' | 'sin_acceso';

export interface Checada {
  readonly resultado: ResultadoChecada;
  readonly checadaId: string | null;
  /** La obra donde checó; si quedó fuera, la más cercana. */
  readonly obra: string | null;
  readonly distancia: number | null;
  readonly en: Date | null;
  /** Lo que se le contó al salir: horas, o 1 si cobra por día. */
  readonly horas: number | null;
}

const EntradaChecar = z.object({
  tipo: z.enum(['entrada', 'salida']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  precision: z.number().min(0).max(100_000).nullish(),
  /** La ruta de la selfie ya subida. */
  foto: z.string().max(300).nullish(),
  /** Cuándo se capturó en el celular, si se envió después (ISO). */
  capturada: z.string().max(40).nullish(),
});

/**
 * Checar entrada o salida con la llave del celular. Dentro de la geocerca de una obra en curso (la entrada, de la más
 * cercana; la salida, de la de su entrada). El resultado dice qué pasó; no lanza errores de negocio. Sin sesión.
 */
export async function checar(
  tx: Tx,
  llave: LlaveTrabajador | null,
  entrada: z.input<typeof EntradaChecar>,
): Promise<Checada> {
  const l = llaveValida(llave);
  const e = validarEntrada(EntradaChecar, entrada);
  if (!l)
    return { resultado: 'sin_acceso', checadaId: null, obra: null, distancia: null, en: null, horas: null };
  const capturada = e.capturada && !Number.isNaN(Date.parse(e.capturada)) ? new Date(e.capturada) : null;
  const [r] = await tx<
    {
      resultado: ResultadoChecada;
      checada_id: string | null;
      obra: string | null;
      distancia_m: number | null;
      en: Date | null;
      horas: string | null;
    }[]
  >`
    select * from public.checar(${l.accesoId}, ${l.secreto}, ${e.tipo}, ${e.lat}, ${e.lng},
                                ${e.precision === null || e.precision === undefined ? null : Math.round(e.precision)},
                                ${e.foto ?? null}, ${capturada})`;
  return {
    resultado: r!.resultado,
    checadaId: r!.checada_id,
    obra: r!.obra,
    distancia: r!.distancia_m,
    en: r!.en,
    horas: r!.horas === null ? null : Number(r!.horas),
  };
}

export interface ChecadaDelDia {
  readonly entradaId: string;
  readonly trabajador: string;
  readonly trabajadorId: string;
  readonly obra: { readonly id: string; readonly folio: string };
  readonly entrada: {
    readonly en: Date;
    readonly distancia: number | null;
    readonly precision: number | null;
  };
  readonly entradaConFoto: boolean;
  readonly entradaDespues: boolean;
  readonly salida: {
    readonly id: string;
    readonly en: Date;
    readonly origen: 'celular' | 'correccion';
    readonly motivo: string | null;
    readonly conFoto: boolean;
    readonly despues: boolean;
  } | null;
  /** Lo que se contó (horas, o 1 por día); null sin salida. */
  readonly horas: number | null;
}

async function leerChecadas(
  tx: Tx,
  desde: Date,
  hasta: Date,
  obraId: string | null,
): Promise<ChecadaDelDia[]> {
  const filas = await tx<
    {
      entrada_id: string;
      trabajador: string;
      trabajador_id: string;
      obra_id: string;
      folio: string;
      en: Date;
      distancia_m: number | null;
      precision_m: number | null;
      foto: boolean;
      despues: boolean;
      salida_id: string | null;
      salida_en: Date | null;
      origen: 'celular' | 'correccion' | null;
      motivo: string | null;
      salida_foto: boolean | null;
      salida_despues: boolean | null;
      horas: string | null;
    }[]
  >`
    select e.id as entrada_id, t.nombre as trabajador, t.id as trabajador_id, o.id as obra_id, o.folio, e.en,
           e.distancia_m, e.precision_m, e.foto_path is not null as foto, e.enviada_despues as despues,
           s.id as salida_id, s.en as salida_en, s.origen, s.motivo, s.foto_path is not null as salida_foto,
           s.enviada_despues as salida_despues, m.cantidad as horas
    from checadas e
    join trabajadores t on t.id = e.trabajador_id
    join obras o on o.id = e.obra_id
    left join checadas s on s.entrada_id = e.id and s.estado = 'vigente'
    left join mano_obra m on m.id = s.mano_obra_id and m.estado = 'vigente'
    where e.tipo = 'entrada' and e.estado = 'vigente' and e.en >= ${desde} and e.en < ${hasta}
      and (${obraId}::uuid is null or e.obra_id = ${obraId})
    order by t.nombre, e.en`;
  return filas.map((f) => ({
    entradaId: f.entrada_id,
    trabajador: f.trabajador,
    trabajadorId: f.trabajador_id,
    obra: { id: f.obra_id, folio: f.folio },
    entrada: { en: f.en, distancia: f.distancia_m, precision: f.precision_m },
    entradaConFoto: f.foto,
    entradaDespues: f.despues,
    salida: f.salida_id
      ? {
          id: f.salida_id,
          en: f.salida_en!,
          origen: f.origen!,
          motivo: f.motivo,
          conFoto: !!f.salida_foto,
          despues: !!f.salida_despues,
        }
      : null,
    horas: f.horas === null ? null : Number(f.horas),
  }));
}

/** El principio y el fin de un día de negocio, en la zona de la empresa. */
async function limitesDelDia(tx: Tx, elDia: Dia, zona: string): Promise<[Date, Date]> {
  const [r] = await tx<{ desde: Date; hasta: Date }[]>`
    select (${elDia}::date)::timestamp at time zone ${zona} as desde,
           (${elDia}::date + 1)::timestamp at time zone ${zona} as hasta`;
  return [r!.desde, r!.hasta];
}

/**
 * Las checadas de un día de la empresa (hoy, si no se dice), por trabajador: cada entrada con su salida y lo que se
 * contó. Y las entradas sin salida de días anteriores, para corregirlas. Dueño o administrador, con el módulo.
 */
export async function checadasDelDia(
  tx: Tx,
  entrada: { dia?: string | null } = {},
  ahora = new Date(),
): Promise<{ hoy: Dia; dia: Dia; checadas: ChecadaDelDia[]; sinSalidaAntes: ChecadaDelDia[] }> {
  const e = validarEntrada(z.object({ dia: dia.nullish() }), entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  exigirModulo(s, 'checada');
  const elDia = e.dia ?? s.hoy;
  const [desde, hasta] = await limitesDelDia(tx, elDia, s.zona);
  const [hoyDesde] = await limitesDelDia(tx, s.hoy, s.zona);
  const antes = await leerChecadas(tx, new Date(hoyDesde.getTime() - 30 * 24 * 3600 * 1000), hoyDesde, null);
  return {
    hoy: s.hoy,
    dia: elDia,
    checadas: await leerChecadas(tx, desde, hasta, null),
    sinSalidaAntes: antes.filter((c) => !c.salida),
  };
}

/** Las checadas de una obra en un día: lo que el PM ve en su cierre en vez de capturar la cuadrilla. */
export async function checadasDeLaObra(
  tx: Tx,
  entrada: { obraId: string; dia: string },
  ahora = new Date(),
): Promise<ChecadaDelDia[]> {
  const e = validarEntrada(z.object({ obraId: uuid, dia }), entrada);
  const s = await leerSesion(tx, ahora);
  const [desde, hasta] = await limitesDelDia(tx, e.dia, s.zona);
  return leerChecadas(tx, desde, hasta, e.obraId);
}

/**
 * Poner la salida que el trabajador olvidó: la hora (HH:MM, el día de su entrada, en la zona de la empresa) y el
 * motivo. Dueño o administrador. Errores: `checada_invalida`, `hora_invalida`, `motivo_requerido`.
 */
export async function corregirSalida(
  tx: Tx,
  entrada: { entradaId: string; hora: string; motivo: string },
  ahora = new Date(),
): Promise<void> {
  const e = validarEntrada(
    z.object({
      entradaId: uuid,
      hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      motivo: z.string().trim().max(300),
    }),
    entrada,
  );
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const [r] = await tx<{ en: Date | null }[]>`
    select (((c.en at time zone ${s.zona})::date + ${e.hora}::time) at time zone ${s.zona}) as en
    from checadas c where c.id = ${e.entradaId}`;
  if (!r?.en) throw new ErrorDeNegocio('checada_invalida');
  await enLaBase(() => tx`select public.corregir_salida(${e.entradaId}, ${r.en}, ${e.motivo})`);
}

/** Anular una checada (una entrada se lleva su salida y sus horas), con motivo. Dueño o administrador. */
export async function anularChecada(tx: Tx, entrada: { checadaId: string; motivo: string }): Promise<void> {
  const e = validarEntrada(z.object({ checadaId: uuid, motivo: z.string().trim().max(300) }), entrada);
  exigirDueno(await leerSesion(tx));
  await enLaBase(() => tx`select public.anular_checada(${e.checadaId}, ${e.motivo})`);
}

/** La ruta de la selfie de una checada que el miembro puede ver; null si no la ve o no tiene. */
export async function fotoDeChecada(tx: Tx, entrada: { checadaId: string }): Promise<string | null> {
  const { checadaId } = validarEntrada(z.object({ checadaId: uuid }), entrada);
  await leerSesion(tx);
  const [r] = await tx<
    { foto_path: string | null }[]
  >`select foto_path from checadas where id = ${checadaId}`;
  return r?.foto_path ?? null;
}

/** Ligar (o desligar, con null) las horas checadas de una obra y un día a su cierre (D-117). */
export async function ligarChecadasAlCierre(
  tx: Tx,
  obraId: string,
  elDia: Dia,
  bitacoraId: string | null,
): Promise<void> {
  await tx`select public.ligar_checadas_al_cierre(${obraId}, ${elDia}, ${bitacoraId})`;
}
