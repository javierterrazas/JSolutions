// Gastos del PM (fase 2, paso 6b; legacy: pm/servidor.js pmGasto, pmSubirRecibo; admin/servidor.js
// duRevisarGasto). Todo gasto va a una obra; sin partida, a Generales de obra. Con la tarjeta de la empresa. Arriba
// del límite de compra del PM queda pendiente de revisión del dueño. El recibo es una foto del gasto (refTipo
// 'gasto'), que se puede subir después; la meta es tenerlo antes de 72 h.
//
// El gasto lleva una clave de envío (D-049): sin señal va a la cola del teléfono, y un reintento con la misma clave
// recibe el gasto que ya existe.
import {
  type Dia,
  diaDeCaptura,
  ErrorDeNegocio,
  estadoDePartida,
  exigir,
  validarDiaDeCaptura,
} from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import type { Nombre } from './consultas-obra';
import { dia, instante, textoCorto, textoLargo, uuid, validarEntrada } from './entrada';
import { exigirDueno, leerSesion } from './sesion';

export const CATEGORIAS_GASTO = [
  'material',
  'renta_equipo',
  'herramienta',
  'permisos',
  'disposicion',
  'otro',
] as const;
export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number];

const EntradaGasto = z.object({
  obraId: uuid,
  claveEnvio: uuid,
  /** Cuándo lo capturó el teléfono (ISO): decide el día del gasto aunque llegue después. */
  capturado: instante.nullish(),
  monto: z.number().nullish(),
  partidaId: uuid.nullish(),
  categoria: z.enum(CATEGORIAS_GASTO).default('material'),
  proveedor: textoCorto.nullish(),
  descripcion: textoLargo.nullish(),
  /** Cuántas fotos del recibo vienen detrás (0 o 1). */
  recibo: z.number().int().min(0).max(1).default(0),
});
export type EntradaGasto = z.input<typeof EntradaGasto>;

export interface GastoRegistrado {
  readonly gastoId: string;
  readonly folio: string;
  /** Pasó el límite de compra: le aparece al dueño para revisarlo. */
  readonly enRevision: boolean;
  readonly limite: number;
}

/**
 * Registra un gasto del PM en una de sus obras (legacy: pmGasto). Errores: `faltan` (proveedor), `monto_invalido`,
 * `obra_no_encontrada`, `partida_de_otra_obra`, `falta_tipo_generales`, `fuera_de_ventana` (D-054).
 */
export async function registrarGasto(
  tx: Tx,
  entrada: EntradaGasto,
  ahora = new Date(),
): Promise<GastoRegistrado> {
  const e = validarEntrada(EntradaGasto, entrada);
  const s = await leerSesion(tx, ahora);
  const [cfg] = await tx<{ limite: string }[]>`select limite_compra_pm as limite from configuracion_pm`;
  const limite = Number(cfg?.limite ?? 0);

  // el reintento de uno que ya llegó recibe el mismo
  const [ya] = await tx<{ id: string; folio: string; revision: string | null }[]>`
    select id, folio, revision from gastos where clave_envio = ${e.claveEnvio}`;
  if (ya) return { gastoId: ya.id, folio: ya.folio, enRevision: ya.revision === 'pendiente', limite };

  exigir([[e.proveedor?.trim(), 'proveedor']]);
  const monto = Number(e.monto);
  if (!(monto > 0) || monto >= 1e10) throw new ErrorDeNegocio('monto_invalido');
  const [obra] = await tx<{ id: string }[]>`
    select id from obras where id = ${e.obraId} and pm_id = ${s.miembroId} and estado <> 'entregada'`;
  if (!obra) throw new ErrorDeNegocio('obra_no_encontrada');

  // sin partida va a Generales de obra: es costo del proyecto, no de un espacio
  let espacioId: string;
  if (e.partidaId) {
    const [p] = await tx<{ espacio_id: string }[]>`
      select espacio_id from partidas_obra where id = ${e.partidaId} and obra_id = ${e.obraId}`;
    if (!p) throw new ErrorDeNegocio('partida_de_otra_obra');
    espacioId = p.espacio_id;
  } else {
    const [g] = await tx<{ id: string }[]>`
      select e.id from espacios e join tipos_espacio t on t.id = e.tipo_espacio_id
      where e.obra_id = ${e.obraId} and t.es_generales`;
    if (!g) throw new ErrorDeNegocio('falta_tipo_generales');
    espacioId = g.id;
  }
  // el día lo dice la hora del teléfono: no más atrás que un cierre tardío (D-054)
  const dia = diaDeCaptura(e.capturado, ahora, s.zona);
  validarDiaDeCaptura(dia, s.hoy, s.calendario);
  const [yo] = await tx<{ tarjeta: string | null }[]>`
    select tarjeta_ultimos4 as tarjeta from miembros where id = ${s.miembroId}`;
  const enRevision = limite > 0 && monto > limite;

  const [g] = await tx<{ id: string; folio: string }[]>`
    insert into gastos (empresa_id, obra_id, espacio_id, partida_obra_id, dia, categoria, proveedor, descripcion,
                        monto, metodo_pago, tarjeta_ultimos4, origen, revision, clave_envio)
    values (${s.empresaId}, ${e.obraId}, ${espacioId}, ${e.partidaId ?? null},
            ${dia}, ${e.categoria}, ${e.proveedor!.trim()},
            ${e.descripcion?.trim() || null}, ${monto}, 'tarjeta_empresa', ${yo?.tarjeta ?? null}, 'pm',
            ${enRevision ? 'pendiente' : null}, ${e.claveEnvio})
    returning id, folio`;
  return { gastoId: g!.id, folio: g!.folio, enRevision, limite };
}

/** El gasto de esa clave de envío, para las fotos de la cola; null si todavía no llega. */
export async function gastoDeClave(tx: Tx, claveEnvio: string): Promise<string | null> {
  const clave = validarEntrada(uuid, claveEnvio);
  const [g] = await tx<{ id: string }[]>`select id from gastos where clave_envio = ${clave}`;
  return g?.id ?? null;
}

// ------------------------------------------------------------------ lo que leen las pantallas del PM

export interface GastoDelPm {
  readonly id: string;
  readonly folio: string;
  readonly dia: string;
  readonly obra: string;
  readonly monto: number;
  readonly proveedor: string;
  readonly descripcion: string | null;
  readonly categoria: CategoriaGasto;
  readonly partidaId: string | null;
  readonly conRecibo: boolean;
  readonly enRevision: boolean;
  /** Quién lo compró: el PM en obra o la oficina (D-063). */
  readonly origen: 'pm' | 'oficina';
  /** Todavía lo puede corregir o anular: el PM, 48 h (D-044); el dueño, mientras la obra no esté cerrada (D-068). */
  readonly corregible: boolean;
  readonly creadoEn: string;
}

export interface DatosGasto {
  readonly obra: { id: string; folio: string; cliente: string };
  readonly limite: number;
  /** Las partidas sin terminar, por espacio; las que van en curso, sugeridas. */
  readonly espacios: readonly {
    id: string;
    nombre: string;
    partidas: readonly { id: string; nombre: Nombre; enCurso: boolean }[];
  }[];
  /** Sus gastos de esta obra sin recibo, y los que todavía puede corregir. */
  readonly sinRecibo: readonly GastoDelPm[];
  readonly recientes: readonly GastoDelPm[];
}

const HORAS_CORREGIBLE = 48;

/**
 * Los gastos vigentes de una obra que el usuario ve (RLS: el PM, los suyos; el dueño, todos), lo más nuevo primero.
 * Con `dueno`, son corregibles mientras la obra no esté cerrada; si no, 48 horas.
 */
async function gastosDelPm(
  tx: Tx,
  obraId: string,
  ahora: Date,
  dueno?: { obraCerrada: boolean },
): Promise<GastoDelPm[]> {
  const filas = await tx<
    {
      id: string;
      folio: string;
      dia: string;
      obra: string;
      monto: string;
      proveedor: string;
      descripcion: string | null;
      categoria: CategoriaGasto;
      partida_obra_id: string | null;
      recibo: boolean;
      revision: string | null;
      origen: 'pm' | 'oficina';
      creado_en: Date;
    }[]
  >`
    select g.id, g.folio, to_char(g.dia, 'YYYY-MM-DD') as dia, o.folio as obra, g.monto, g.proveedor, g.descripcion,
           g.categoria, g.partida_obra_id, g.revision, g.origen, g.creado_en,
           exists (select 1 from fotos f where f.ref_tipo = 'gasto' and f.ref_id = g.id) as recibo
    from gastos g join obras o on o.id = g.obra_id
    where g.obra_id = ${obraId} and g.estado = 'vigente'
    order by g.creado_en desc`;
  return filas.map((g) => ({
    id: g.id,
    folio: g.folio,
    dia: g.dia,
    obra: g.obra,
    monto: Number(g.monto),
    proveedor: g.proveedor,
    descripcion: g.descripcion,
    categoria: g.categoria,
    partidaId: g.partida_obra_id,
    conRecibo: g.recibo,
    enRevision: g.revision === 'pendiente',
    origen: g.origen,
    corregible: dueno
      ? !dueno.obraCerrada
      : ahora.getTime() - g.creado_en.getTime() <= HORAS_CORREGIBLE * 3_600_000,
    creadoEn: g.creado_en.toISOString(),
  }));
}

/** La pantalla de gastos de una obra del PM; null si no es suya. RLS le deja ver solo los gastos que él registró. */
export async function datosParaGasto(
  tx: Tx,
  entrada: { obraId: string },
  ahora = new Date(),
): Promise<DatosGasto | null> {
  const { obraId } = validarEntrada(z.object({ obraId: uuid }), entrada);
  const s = await leerSesion(tx, ahora);
  const [obra] = await tx<{ id: string; folio: string; cliente: string }[]>`
    select id, folio, cliente from obras where id = ${obraId} and pm_id = ${s.miembroId} and estado <> 'entregada'`;
  if (!obra) return null;
  const [cfg] = await tx<{ limite: string }[]>`select limite_compra_pm as limite from configuracion_pm`;
  const espacios = await tx<{ id: string; nombre: string }[]>`
    select id, nombre from espacios where obra_id = ${obraId} order by orden`;
  const partidas = await tx<{ id: string; espacio_id: string; es: string; en: string | null }[]>`
    select id, espacio_id, nombre_es as es, nombre_en as en from partidas_obra
    where obra_id = ${obraId} and estado = 'activa' order by orden, nombre_es`;
  const avance = await tx<{ partida: string; estado: 'en_progreso' | 'terminada' }[]>`
    select partida_obra_id as partida, estado from avance where obra_id = ${obraId} and estado_registro = 'vigente'`;
  const estado = (id: string) => estadoDePartida(avance.filter((x) => x.partida === id));
  const gastos = await gastosDelPm(tx, obraId, ahora);
  return {
    obra,
    limite: Number(cfg?.limite ?? 0),
    espacios: espacios
      .map((e) => ({
        id: e.id,
        nombre: e.nombre,
        partidas: partidas
          .filter((p) => p.espacio_id === e.id && estado(p.id) !== 'terminada')
          .map((p) => ({
            id: p.id,
            nombre: { es: p.es, en: p.en },
            enCurso: estado(p.id) === 'en_progreso',
          })),
      }))
      .filter((e) => e.partidas.length),
    sinRecibo: gastos.filter((g) => !g.conRecibo),
    recientes: gastos.filter((g) => g.corregible),
  };
}

// ------------------------------------------------------------------ la revisión del dueño

export interface GastoEnRevision {
  readonly id: string;
  readonly folio: string;
  readonly dia: string;
  readonly obra: { id: string; folio: string; cliente: string };
  readonly pm: string;
  readonly monto: number;
  readonly proveedor: string;
  readonly descripcion: string | null;
  readonly categoria: CategoriaGasto;
  /** La foto del recibo, si ya la subió. */
  readonly reciboId: string | null;
}

/** Las compras del PM arriba de su límite que el dueño no ha revisado, las más viejas primero. */
export async function gastosEnRevision(tx: Tx, ahora = new Date()): Promise<GastoEnRevision[]> {
  exigirDueno(await leerSesion(tx, ahora));
  const filas = await tx<
    {
      id: string;
      folio: string;
      dia: string;
      obra_id: string;
      obra_folio: string;
      cliente: string;
      pm: string;
      monto: string;
      proveedor: string;
      descripcion: string | null;
      categoria: CategoriaGasto;
      recibo: string | null;
    }[]
  >`
    select g.id, g.folio, to_char(g.dia, 'YYYY-MM-DD') as dia, o.id as obra_id, o.folio as obra_folio, o.cliente,
           coalesce(m.nombre, '') as pm, g.monto, g.proveedor, g.descripcion, g.categoria,
           (select f.id from fotos f where f.ref_tipo = 'gasto' and f.ref_id = g.id order by f.indice limit 1) as recibo
    from gastos g join obras o on o.id = g.obra_id left join miembros m on m.id = g.creado_por
    where g.revision = 'pendiente' and g.estado = 'vigente'
    order by g.creado_en`;
  return filas.map((g) => ({
    id: g.id,
    folio: g.folio,
    dia: g.dia,
    obra: { id: g.obra_id, folio: g.obra_folio, cliente: g.cliente },
    pm: g.pm,
    monto: Number(g.monto),
    proveedor: g.proveedor,
    descripcion: g.descripcion,
    categoria: g.categoria,
    reciboId: g.recibo,
  }));
}

/** El dueño marca revisada una compra arriba del límite (legacy: duRevisarGasto). Queda en la auditoría. */
export async function marcarGastoRevisado(
  tx: Tx,
  entrada: { gastoId: string },
  ahora = new Date(),
): Promise<void> {
  const { gastoId } = validarEntrada(z.object({ gastoId: uuid }), entrada);
  exigirDueno(await leerSesion(tx, ahora));
  const r =
    await tx`update gastos set revision = 'revisado' where id = ${gastoId} and revision = 'pendiente'`;
  if (!r.count) throw new ErrorDeNegocio('registro_no_encontrado');
}

// ------------------------------------------------------------------ las compras de la oficina
/** Cómo pagó la oficina una compra. */
export const METODOS_PAGO = [
  'transferencia',
  'tarjeta',
  'cheque',
  'zelle',
  'efectivo',
  'tarjeta_empresa',
] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export interface DatosCompra {
  readonly obra: { id: string; folio: string; cliente: string };
  /** Ya entregada o cerrada: no se registran compras ni se corrigen. */
  readonly cerrada: boolean;
  /** Las compras de la obra, de la oficina y del PM, lo más nuevo primero, para corregirlas o anularlas (D-068). */
  readonly compras: readonly GastoDelPm[];
  /** Hoy en la zona de la empresa: el día de la compra si no se dice otro. */
  readonly hoy: Dia;
  /** Cada espacio con sus partidas (también las terminadas: a veces se paga después). */
  readonly espacios: readonly {
    id: string;
    nombre: string;
    partidas: readonly { id: string; nombre: Nombre }[];
  }[];
}

/** Lo que necesita la pantalla de una compra de la oficina (D-063). Null si la obra no existe. Solo el dueño. */
export async function datosParaCompra(
  tx: Tx,
  entrada: { obraId: string },
  ahora = new Date(),
): Promise<DatosCompra | null> {
  const { obraId } = validarEntrada(z.object({ obraId: uuid }), entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const [obra] = await tx<{ id: string; folio: string; cliente: string; cerrada: boolean }[]>`
    select id, folio, cliente,
           estado = 'entregada' or exists (select 1 from obras_cerradas c where c.obra_id = o.id) as cerrada
    from obras o where id = ${obraId}`;
  if (!obra) return null;
  const espacios = await tx<{ id: string; nombre: string }[]>`
    select id, nombre from espacios where obra_id = ${obraId} order by orden`;
  const partidas = await tx<{ id: string; espacio_id: string; es: string; en: string | null }[]>`
    select id, espacio_id, nombre_es as es, nombre_en as en from partidas_obra
    where obra_id = ${obraId} and estado = 'activa' order by orden, nombre_es`;
  return {
    obra: { id: obra.id, folio: obra.folio, cliente: obra.cliente },
    cerrada: obra.cerrada,
    compras: await gastosDelPm(tx, obraId, ahora, { obraCerrada: obra.cerrada }),
    hoy: s.hoy,
    espacios: espacios
      .map((e) => ({
        id: e.id,
        nombre: e.nombre,
        partidas: partidas
          .filter((p) => p.espacio_id === e.id)
          .map((p) => ({ id: p.id, nombre: { es: p.es, en: p.en } })),
      }))
      .filter((e) => e.partidas.length),
  };
}

const EntradaCompra = z.object({
  obraId: uuid,
  monto: z.number().nullish(),
  /** El día de la compra; hoy, si no se dice. */
  dia: dia.nullish(),
  partidaId: uuid.nullish(),
  categoria: z.enum(CATEGORIAS_GASTO).default('material'),
  proveedor: textoCorto.nullish(),
  descripcion: textoLargo.nullish(),
  metodoPago: z.enum(METODOS_PAGO).default('transferencia'),
});
export type EntradaCompra = z.input<typeof EntradaCompra>;

/**
 * Una compra de la oficina para una obra (D-063; legacy: duGasto): el dueño o el administrador la registra con su
 * proveedor, qué se compró, el monto, el día, cómo se pagó y, si se sabe, la partida; sin partida va a Generales de
 * obra. El PM nunca la ve. Errores: `faltan` (proveedor, descripción), `monto_invalido`, `dia_futuro`,
 * `obra_no_encontrada`, `obra_cerrada_gastos`, `partida_de_otra_obra`, `falta_tipo_generales`, `solo_dueno`.
 */
export async function registrarCompraOficina(
  tx: Tx,
  entrada: EntradaCompra,
  ahora = new Date(),
): Promise<{ gastoId: string; folio: string }> {
  const e = validarEntrada(EntradaCompra, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  exigir([
    [e.proveedor?.trim(), 'proveedor'],
    [e.descripcion?.trim(), 'descripcion'],
  ]);
  const monto = Number(e.monto);
  if (!(monto > 0) || monto >= 1e10) throw new ErrorDeNegocio('monto_invalido');
  const elDia = e.dia ?? s.hoy;
  if (elDia > s.hoy) throw new ErrorDeNegocio('dia_futuro');
  const [obra] = await tx<{ id: string }[]>`select id from obras where id = ${e.obraId}`;
  if (!obra) throw new ErrorDeNegocio('obra_no_encontrada');
  const [cerrada] = await tx`select 1 from obras_cerradas where obra_id = ${e.obraId}`;
  if (cerrada) throw new ErrorDeNegocio('obra_cerrada_gastos');

  let espacioId: string;
  if (e.partidaId) {
    const [p] = await tx<{ espacio_id: string }[]>`
      select espacio_id from partidas_obra where id = ${e.partidaId} and obra_id = ${e.obraId}`;
    if (!p) throw new ErrorDeNegocio('partida_de_otra_obra');
    espacioId = p.espacio_id;
  } else {
    const [g] = await tx<{ id: string }[]>`
      select e.id from espacios e join tipos_espacio t on t.id = e.tipo_espacio_id
      where e.obra_id = ${e.obraId} and t.es_generales`;
    if (!g) throw new ErrorDeNegocio('falta_tipo_generales');
    espacioId = g.id;
  }
  const [g] = await tx<{ id: string; folio: string }[]>`
    insert into gastos (empresa_id, obra_id, espacio_id, partida_obra_id, dia, categoria, proveedor, descripcion,
                        monto, metodo_pago, origen)
    values (${s.empresaId}, ${e.obraId}, ${espacioId}, ${e.partidaId ?? null}, ${elDia}, ${e.categoria},
            ${e.proveedor!.trim()}, ${e.descripcion!.trim()}, ${monto}, ${e.metodoPago}, 'oficina')
    returning id, folio`;
  return { gastoId: g!.id, folio: g!.folio };
}
