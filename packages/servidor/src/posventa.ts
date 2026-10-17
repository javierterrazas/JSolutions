// Los retrabajos, las garantías y el seguimiento después de la entrega (D-090; legacy: duNoCalidad, duGarantia,
// duCerrarGarantia y duCosecha). Hallazgo de la simulación (D-088): nada de esto tenía pantalla, así que los
// indicadores de costo de no calidad, garantías y reseñas salían siempre en cero o en rojo.
// - Un **retrabajo** es un error propio que se paga (repetir una hilada de tile): nace cerrado, con su costo y los días
//   que se perdieron. No es una orden de cambio: esa la paga el cliente.
// - Una **garantía** es un reclamo del cliente después de la entrega: nace abierta y se cierra con lo que costó.
// - **Después de la entrega** (la "cosecha" del legacy): las fotos autorizadas, la reseña pedida y recibida, el
//   referido y la visita de los 11 meses, en la entrega de la obra.
// Lleva dinero: solo el dueño o el administrador.
import { type Dia, ErrorDeNegocio, sumarDias } from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import { textoLargo, uuid, validarEntrada } from './entrada';
import { exigirDueno, leerSesion } from './sesion';

export const CAUSAS_NO_CALIDAD = [
  'error_instalacion',
  'error_especificacion',
  'error_estimacion',
  'material_defectuoso',
  'falta_supervision',
] as const;
export type CausaNoCalidad = (typeof CAUSAS_NO_CALIDAD)[number];

export interface RegistroNoCalidad {
  readonly id: string;
  readonly folio: string;
  readonly tipo: 'retrabajo' | 'garantia';
  readonly causa: CausaNoCalidad | null;
  readonly sub: string | null;
  readonly costo: number;
  readonly diasPerdidos: number;
  readonly descripcion: string;
  readonly abierto: boolean;
  readonly creado: Date;
  readonly cerrado: Date | null;
}

export interface RetrabajosDeObra {
  readonly obra: { id: string; folio: string; cliente: string; entregada: boolean };
  readonly registros: readonly RegistroNoCalidad[];
  /** Los subs activos, por si el error fue de uno. */
  readonly subs: readonly { id: string; nombre: string }[];
}

/** Los retrabajos y garantías de una obra, lo más nuevo primero; null si no existe. */
export async function retrabajosDeObra(
  tx: Tx,
  entrada: { obraId: string },
  ahora = new Date(),
): Promise<RetrabajosDeObra | null> {
  const { obraId } = validarEntrada(z.object({ obraId: uuid }), entrada);
  exigirDueno(await leerSesion(tx, ahora));
  const [obra] = await tx<RetrabajosDeObra['obra'][]>`
    select id, folio, cliente, estado = 'entregada' as entregada from obras where id = ${obraId}`;
  if (!obra) return null;
  const filas = await tx<
    (Omit<RegistroNoCalidad, 'costo' | 'abierto'> & { costo: string; estado: string })[]
  >`
    select n.id, n.folio, n.tipo, n.causa, s.nombre as sub, n.costo, n.dias_perdidos as "diasPerdidos",
           n.descripcion, n.estado, n.creado_en as creado, n.cerrado_en as cerrado
    from no_calidad n left join subcontratistas s on s.id = n.subcontratista_id
    where n.obra_id = ${obraId} order by n.creado_en desc`;
  const subs = await tx<{ id: string; nombre: string }[]>`
    select id, nombre from subcontratistas where activo order by nombre`;
  return {
    obra,
    registros: filas.map(({ estado, costo, ...x }) => ({
      ...x,
      costo: Number(costo),
      abierto: estado === 'abierto',
    })),
    subs,
  };
}

const EntradaNoCalidad = z.object({
  obraId: uuid,
  tipo: z.enum(['retrabajo', 'garantia']),
  causa: z.enum(CAUSAS_NO_CALIDAD).nullish(),
  subId: uuid.nullish(),
  costo: z.number().min(0).max(1_000_000).default(0),
  diasPerdidos: z.number().int().min(0).max(365).default(0),
  descripcion: textoLargo,
});
export type EntradaNoCalidad = z.input<typeof EntradaNoCalidad>;

/**
 * Registra un retrabajo (nace cerrado) o un reclamo de garantía (nace abierto; solo en una obra entregada). Errores:
 * `falta_descripcion`, `obra_no_encontrada`, `garantia_sin_entrega`.
 */
export async function registrarNoCalidad(
  tx: Tx,
  entrada: EntradaNoCalidad,
  ahora = new Date(),
): Promise<{ id: string; folio: string }> {
  const e = validarEntrada(EntradaNoCalidad, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const descripcion = e.descripcion.trim();
  if (descripcion.length < 4) throw new ErrorDeNegocio('falta_descripcion');
  const [obra] = await tx<{ entregada: boolean }[]>`
    select estado = 'entregada' as entregada from obras where id = ${e.obraId}`;
  if (!obra) throw new ErrorDeNegocio('obra_no_encontrada');
  if (e.tipo === 'garantia' && !obra.entregada) throw new ErrorDeNegocio('garantia_sin_entrega');
  const retrabajo = e.tipo === 'retrabajo';
  const [n] = await tx<{ id: string; folio: string }[]>`
    insert into no_calidad (empresa_id, obra_id, tipo, causa, subcontratista_id, costo, dias_perdidos, descripcion,
                            estado, cerrado_en)
    values (${s.empresaId}, ${e.obraId}, ${e.tipo}, ${e.causa ?? null}, ${e.subId ?? null}, ${e.costo},
            ${retrabajo ? e.diasPerdidos : 0}, ${descripcion}, ${retrabajo ? 'cerrado' : 'abierto'},
            ${retrabajo ? ahora : null})
    returning id, folio`;
  return { id: n!.id, folio: n!.folio };
}

/** Cierra un reclamo de garantía con lo que costó atenderlo. Errores: `registro_no_encontrado`, `ya_cerrado`. */
export async function cerrarGarantia(
  tx: Tx,
  entrada: { noCalidadId: string; costo: number },
  ahora = new Date(),
): Promise<void> {
  const e = validarEntrada(z.object({ noCalidadId: uuid, costo: z.number().min(0).max(1_000_000) }), entrada);
  exigirDueno(await leerSesion(tx, ahora));
  const [n] = await tx<{ estado: string }[]>`
    select estado from no_calidad where id = ${e.noCalidadId} and tipo = 'garantia'`;
  if (!n) throw new ErrorDeNegocio('registro_no_encontrado');
  if (n.estado === 'cerrado') throw new ErrorDeNegocio('ya_cerrado');
  await tx`update no_calidad set estado = 'cerrado', cerrado_en = ${ahora}, costo = ${e.costo}
           where id = ${e.noCalidadId}`;
}

// ------------------------------------------------------------------ después de la entrega
export const PASOS_POSVENTA = [
  'autoriza_fotos',
  'resena_pedida',
  'resena_recibida',
  'referido_pedido',
  'visita_11m',
] as const;
export type PasoPosventa = (typeof PASOS_POSVENTA)[number];

export interface PosventaDeObra {
  readonly fechaEntrega: Dia;
  readonly garantiaVence: Dia;
  readonly pasos: Readonly<Record<PasoPosventa, boolean>>;
}

/** Lo hecho después de la entrega de una obra; null si no tiene entrega. */
export async function posventaDeObra(
  tx: Tx,
  entrada: { obraId: string },
  ahora = new Date(),
): Promise<PosventaDeObra | null> {
  const { obraId } = validarEntrada(z.object({ obraId: uuid }), entrada);
  exigirDueno(await leerSesion(tx, ahora));
  const [e] = await tx<(Record<PasoPosventa, boolean> & { entrega: Dia; vence: Dia })[]>`
    select to_char(fecha_entrega, 'YYYY-MM-DD') as entrega, to_char(garantia_vence, 'YYYY-MM-DD') as vence,
           autoriza_fotos, resena_pedida, resena_recibida, referido_pedido, visita_11m
    from entregas where obra_id = ${obraId}`;
  if (!e) return null;
  const { entrega, vence, ...pasos } = e;
  return { fechaEntrega: entrega, garantiaVence: vence, pasos };
}

/** Marca o desmarca un paso de después de la entrega. Error: `sin_entrega`. */
export async function marcarPosventa(
  tx: Tx,
  entrada: { obraId: string; paso: PasoPosventa; hecho: boolean },
  ahora = new Date(),
): Promise<void> {
  const e = validarEntrada(
    z.object({ obraId: uuid, paso: z.enum(PASOS_POSVENTA), hecho: z.boolean() }),
    entrada,
  );
  exigirDueno(await leerSesion(tx, ahora));
  const r = await tx`update entregas set ${tx({ [e.paso]: e.hecho })} where obra_id = ${e.obraId}`;
  if (!r.count) throw new ErrorDeNegocio('sin_entrega');
}

export interface PendientesDePosventa {
  /** Los reclamos de garantía abiertos, el más viejo primero. */
  readonly garantias: readonly {
    obraId: string;
    folio: string;
    cliente: string;
    reclamo: string;
    desde: Date;
  }[];
  /** Las obras entregadas hace 3 días o más sin reseña. */
  readonly sinResena: readonly {
    obraId: string;
    folio: string;
    cliente: string;
    entrega: Dia;
    pedida: boolean;
  }[];
  /** Las garantías que vencen en menos de 40 días sin la visita de los 11 meses. */
  readonly visitas: readonly { obraId: string; folio: string; cliente: string; vence: Dia }[];
}

/** Lo que falta después de entregar, para el inicio del dueño (legacy: la cosecha y las garantías abiertas). */
export async function pendientesDePosventa(tx: Tx, ahora = new Date()): Promise<PendientesDePosventa> {
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const garantias = await tx<PendientesDePosventa['garantias'][number][]>`
    select n.obra_id as "obraId", o.folio, o.cliente, n.descripcion as reclamo, n.creado_en as desde
    from no_calidad n join obras o on o.id = n.obra_id
    where n.tipo = 'garantia' and n.estado = 'abierto' order by n.creado_en`;
  const sinResena = await tx<PendientesDePosventa['sinResena'][number][]>`
    select e.obra_id as "obraId", o.folio, o.cliente, to_char(e.fecha_entrega, 'YYYY-MM-DD') as entrega,
           e.resena_pedida as pedida
    from entregas e join obras o on o.id = e.obra_id
    where o.estado = 'entregada' and not e.resena_recibida and e.fecha_entrega <= ${sumarDias(s.hoy, -3)}
      and e.garantia_vence >= ${s.hoy}
    order by e.fecha_entrega`;
  const visitas = await tx<PendientesDePosventa['visitas'][number][]>`
    select e.obra_id as "obraId", o.folio, o.cliente, to_char(e.garantia_vence, 'YYYY-MM-DD') as vence
    from entregas e join obras o on o.id = e.obra_id
    where o.estado = 'entregada' and not e.visita_11m
      and e.garantia_vence between ${s.hoy} and ${sumarDias(s.hoy, 40)}
    order by e.garantia_vence`;
  return { garantias, sinResena, visitas };
}
