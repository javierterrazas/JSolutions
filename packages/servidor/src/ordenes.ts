// Las órdenes de trabajo de los subs, para el PM (fase 2, paso 6d; legacy: pm/servidor.js pmConfirmarOT,
// pmAprobarOT y las listas porConfirmar y subsActivos de construirDatos_). El PM nunca ve el precio de una orden
// (ordenes_trabajo_precios es de la muralla financiera): solo quién, qué y cuándo.
//   · Confirmar: el sub confirmó por escrito que llega en la fecha (la confirmación T-48 h).
//   · Que llegó (se_presento) lo marca el cierre del día (D-041).
//   · Aprobar: el PM caminó el trabajo con el sub y lo recibe; con eso el sub puede cobrar.
import { ErrorDeNegocio } from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import type { Nombre } from './consultas-obra';
import { uuid, validarEntrada } from './entrada';
import { leerSesion } from './sesion';

export interface OrdenDelPm {
  readonly id: string;
  readonly folio: string;
  readonly sub: string;
  readonly telefono: string | null;
  readonly oficio: Nombre | null;
  readonly alcance: string;
  readonly partida: Nombre | null;
  readonly espacio: string;
  readonly inicio: string;
  readonly fin: string;
}

export interface DatosOrdenes {
  readonly obra: { id: string; folio: string; cliente: string };
  /** Emitidas sin confirmar: falta que el sub confirme por escrito que llega. */
  readonly porConfirmar: readonly OrdenDelPm[];
  /** El sub ya llegó y el trabajo no se ha aprobado. */
  readonly porAprobar: readonly OrdenDelPm[];
}

/** Las órdenes de una obra del PM que esperan algo de él; null si la obra no es suya. */
export async function ordenesDelPm(
  tx: Tx,
  entrada: { obraId: string },
  ahora = new Date(),
): Promise<DatosOrdenes | null> {
  const { obraId } = validarEntrada(z.object({ obraId: uuid }), entrada);
  const s = await leerSesion(tx, ahora);
  const [obra] = await tx<{ id: string; folio: string; cliente: string }[]>`
    select id, folio, cliente from obras where id = ${obraId} and pm_id = ${s.miembroId} and estado <> 'entregada'`;
  if (!obra) return null;
  const filas = await tx<
    {
      id: string;
      folio: string;
      sub: string | null;
      telefono: string | null;
      oficio_es: string | null;
      oficio_en: string | null;
      alcance: string;
      partida_es: string | null;
      partida_en: string | null;
      espacio: string;
      inicio: string;
      fin: string;
      estado: 'emitida' | 'confirmada';
      confirmada: boolean;
      se_presento: boolean | null;
      aprobada: boolean;
    }[]
  >`
    select o.id, o.folio, s.nombre as sub, s.telefono, f.nombre_es as oficio_es, f.nombre_en as oficio_en, o.alcance,
           p.nombre_es as partida_es, p.nombre_en as partida_en, e.nombre as espacio,
           to_char(o.inicio_programado, 'YYYY-MM-DD') as inicio, to_char(o.fin_programado, 'YYYY-MM-DD') as fin,
           o.estado, o.confirmada_en is not null as confirmada, o.se_presento, o.aprobada_en is not null as aprobada
    from ordenes_trabajo o
    left join subcontratistas_pm s on s.id = o.subcontratista_id
    left join oficios f on f.id = s.oficio_id
    left join partidas_obra p on p.id = o.partida_obra_id
    join espacios e on e.id = o.espacio_id
    where o.obra_id = ${obraId} and o.estado in ('emitida', 'confirmada')
    order by o.inicio_programado, o.folio`;
  const orden = (o: (typeof filas)[number]): OrdenDelPm => ({
    id: o.id,
    folio: o.folio,
    sub: o.sub ?? '',
    telefono: o.telefono,
    oficio: o.oficio_es ? { es: o.oficio_es, en: o.oficio_en } : null,
    alcance: o.alcance,
    partida: o.partida_es ? { es: o.partida_es, en: o.partida_en } : null,
    espacio: o.espacio,
    inicio: o.inicio,
    fin: o.fin,
  });
  return {
    obra,
    porConfirmar: filas.filter((o) => o.estado === 'emitida' && !o.confirmada).map(orden),
    porAprobar: filas.filter((o) => o.se_presento === true && !o.aprobada).map(orden),
  };
}

/** La orden, si es de una obra del PM y sigue viva; si no, `orden_no_encontrada`. */
async function ordenViva(tx: Tx, ordenId: string, miembroId: string) {
  const [o] = await tx<{ estado: string; confirmada: boolean; aprobada: boolean }[]>`
    select o.estado, o.confirmada_en is not null as confirmada, o.aprobada_en is not null as aprobada
    from ordenes_trabajo o join obras b on b.id = o.obra_id
    where o.id = ${ordenId} and b.pm_id = ${miembroId} and b.estado <> 'entregada'
      and o.estado in ('emitida', 'confirmada')`;
  if (!o) throw new ErrorDeNegocio('orden_no_encontrada');
  return o;
}

/** El sub confirmó por escrito que llega (legacy: pmConfirmarOT). Error: `orden_no_encontrada`, `orden_ya_confirmada`. */
export async function confirmarOrden(
  tx: Tx,
  entrada: { ordenId: string },
  ahora = new Date(),
): Promise<void> {
  const { ordenId } = validarEntrada(z.object({ ordenId: uuid }), entrada);
  const s = await leerSesion(tx, ahora);
  const o = await ordenViva(tx, ordenId, s.miembroId);
  if (o.confirmada || o.estado !== 'emitida') throw new ErrorDeNegocio('orden_ya_confirmada');
  await tx`update ordenes_trabajo set estado = 'confirmada', confirmada_en = ${ahora} where id = ${ordenId}`;
}

/**
 * El PM recibe el trabajo del sub (legacy: pmAprobarOT): la orden queda aprobada a su nombre y el sub puede cobrar.
 * Error: `orden_no_encontrada`.
 */
export async function aprobarOrden(tx: Tx, entrada: { ordenId: string }, ahora = new Date()): Promise<void> {
  const { ordenId } = validarEntrada(z.object({ ordenId: uuid }), entrada);
  const s = await leerSesion(tx, ahora);
  await ordenViva(tx, ordenId, s.miembroId);
  await tx`
    update ordenes_trabajo set estado = 'aprobada', aprobada_en = ${ahora}, aprobada_por = ${s.miembroId}
    where id = ${ordenId}`;
}
