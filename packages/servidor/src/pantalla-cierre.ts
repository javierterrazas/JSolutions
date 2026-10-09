// Lo que lee la pantalla de cerrar el día (fase 2, paso 4; legacy: el formulario de cierre de PM.html con los datos
// de construirDatos_). Solo lee, con la identidad del PM; las reglas del cierre las aplica cerrarDia al guardar.
import { type Dia, diasSinCierre, estadoDePartida, MOTIVOS_SIN_TRABAJO } from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import type { Nombre } from './consultas-obra';
import { dia as esquemaDia, uuid, validarEntrada } from './entrada';
import { leerSesion } from './sesion';

export interface PartidaParaCierre {
  readonly id: string;
  readonly nombre: Nombre;
  readonly estado: 'sin_iniciar' | 'en_progreso';
  /** La clave de su punto de control (PC2…), si tiene. */
  readonly hito: string | null;
  /** No se puede terminar todavía: su punto de control no tiene una inspección aprobada en este espacio. */
  readonly faltaInspeccion: boolean;
}

export interface DatosCierre {
  readonly obra: { id: string; folio: string; cliente: string; estado: string };
  /** El día que se cierra: hoy, o el olvidado que se pidió. */
  readonly dia: Dia;
  readonly tardio: boolean;
  /** Ese día ya tiene cierre (no se cierra dos veces, D-022). */
  readonly yaCerrado: boolean;
  /** Los días que todavía puede cerrar tarde. */
  readonly diasSinCierre: readonly Dia[];
  /** Las partidas que no se han terminado, por espacio; las que van en curso, sugeridas. */
  readonly espacios: readonly { id: string; nombre: string; partidas: readonly PartidaParaCierre[] }[];
  readonly trabajadores: readonly {
    id: string;
    nombre: string;
    puesto: string | null;
    tipoPago: 'hora' | 'dia';
  }[];
  /** Las órdenes de trabajo cuyo sub se espera ese día y todavía no se reporta si llegó. */
  readonly subs: readonly {
    ordenId: string;
    folio: string;
    sub: string;
    alcance: string;
    partida: Nombre | null;
  }[];
  readonly motivos: readonly string[];
}

/** Lo que necesita la pantalla de cierre de una obra del PM; null si la obra no es suya o no la ve. */
export async function datosParaCierre(
  tx: Tx,
  entrada: { obraId: string; dia?: string | null },
  ahora = new Date(),
): Promise<DatosCierre | null> {
  const e = validarEntrada(z.object({ obraId: uuid, dia: esquemaDia.nullish() }), entrada);
  const s = await leerSesion(tx, ahora);
  const [obra] = await tx<{ id: string; folio: string; cliente: string; estado: string }[]>`
    select id, folio, cliente, estado from obras where id = ${e.obraId} and pm_id = ${s.miembroId}`;
  if (!obra) return null;

  const cierres = await tx<{ dia: Dia; sin_trabajo: boolean }[]>`
    select dia, sin_trabajo from bitacora where obra_id = ${obra.id} and estado = 'vigente'`;
  const olvidados = diasSinCierre(
    cierres.map((c) => ({ dia: c.dia, conTrabajo: !c.sin_trabajo })),
    obra.estado === 'en_obra',
    s.hoy,
    s.calendario,
  );
  const elDia = e.dia ?? s.hoy;

  const espacios = await tx<{ id: string; nombre: string }[]>`
    select id, nombre from espacios where obra_id = ${obra.id} order by orden`;
  const partidas = await tx<
    { id: string; espacio_id: string; es: string; en: string | null; hito_id: string | null }[]
  >`
    select id, espacio_id, nombre_es as es, nombre_en as en, hito_id
    from partidas_obra where obra_id = ${obra.id} and estado = 'activa' order by orden, nombre_es`;
  const avance = await tx<{ partida: string; estado: 'en_progreso' | 'terminada' }[]>`
    select partida_obra_id as partida, estado from avance where obra_id = ${obra.id} and estado_registro = 'vigente'`;
  const inspecciones = await tx<{ espacio_id: string; hito_id: string; resultado: string }[]>`
    select espacio_id, hito_id, resultado from inspecciones where obra_id = ${obra.id} order by realizada_en`;
  const ultima = new Map(inspecciones.map((i) => [`${i.espacio_id}|${i.hito_id}`, i.resultado]));
  const claves = new Map(
    (await tx<{ id: string; clave: string }[]>`select id, clave from hitos_calidad`).map((h) => [
      h.id,
      h.clave,
    ]),
  );

  const lista = espacios
    .map((esp) => ({
      id: esp.id,
      nombre: esp.nombre,
      partidas: partidas
        .filter((p) => p.espacio_id === esp.id)
        .map((p) => ({ p, estado: estadoDePartida(avance.filter((a) => a.partida === p.id)) }))
        .filter((x) => x.estado !== 'terminada')
        .map(({ p, estado }): PartidaParaCierre => ({
          id: p.id,
          nombre: { es: p.es, en: p.en },
          estado: estado as PartidaParaCierre['estado'],
          hito: p.hito_id ? (claves.get(p.hito_id) ?? null) : null,
          faltaInspeccion: !!p.hito_id && ultima.get(`${p.espacio_id}|${p.hito_id}`) !== 'aprobado',
        })),
    }))
    .filter((esp) => esp.partidas.length);

  const trabajadores = await tx<
    { id: string; nombre: string; puesto: string | null; tipo_pago: 'hora' | 'dia' }[]
  >`
    select id, nombre, puesto, tipo_pago from trabajadores where activo order by nombre`;
  // los subs que se esperan ese día: su orden ya empezó, sigue viva y no se ha reportado si llegó
  const subs = await tx<
    { id: string; folio: string; sub: string; alcance: string | null; partida: string | null }[]
  >`
    select o.id, o.folio, coalesce(s.nombre, '') as sub, o.alcance, o.partida_obra_id as partida
    from ordenes_trabajo o left join subcontratistas_pm s on s.id = o.subcontratista_id
    where o.obra_id = ${obra.id} and o.estado in ('emitida', 'confirmada') and o.se_presento is null
      and o.inicio_programado is not null and o.inicio_programado <= ${elDia}
    order by o.inicio_programado, o.folio`;
  const nombrePartida = new Map(partidas.map((p) => [p.id, { es: p.es, en: p.en }]));

  return {
    obra,
    dia: elDia,
    tardio: elDia !== s.hoy,
    yaCerrado: cierres.some((c) => c.dia === elDia),
    diasSinCierre: olvidados,
    espacios: lista,
    trabajadores: trabajadores.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      puesto: t.puesto,
      tipoPago: t.tipo_pago,
    })),
    subs: subs.map((x) => ({
      ordenId: x.id,
      folio: x.folio,
      sub: x.sub,
      alcance: x.alcance ?? '',
      partida: x.partida ? (nombrePartida.get(x.partida) ?? null) : null,
    })),
    motivos: MOTIVOS_SIN_TRABAJO,
  };
}
