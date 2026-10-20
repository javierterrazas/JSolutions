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
    /**
     * Lo que ya lleva ese día en OTRAS obras (horas, o días si cobra por día), aunque sean de otro PM: para que el PM
     * sepa cuánto le puede poner sin pasar de 16 horas o de un día (D-093).
     */
    yaLleva: number;
    /** El último día que trabajó en esta obra, en sus últimos 10 cierres (D-104); null si no ha trabajado aquí. */
    reciente: Dia | null;
  }[];
  /**
   * La cuadrilla del último cierre con trabajo de esta obra antes de ese día (D-104), para "Igual que el último
   * cierre": cuánto puso a cada trabajador activo (horas, o días si cobra por día). Null si todavía no hay.
   */
  readonly ultimoCierre: {
    readonly dia: Dia;
    readonly cuadrilla: readonly { trabajadorId: string; cantidad: number }[];
  } | null;
  /** Las órdenes de trabajo cuyo sub se espera ese día y todavía no se reporta si llegó. */
  readonly subs: readonly {
    ordenId: string;
    folio: string;
    sub: string;
    alcance: string;
    partida: Nombre | null;
    /** Cuándo empieza la orden; sin señal, el teléfono ofrece solo las que ya empezaron (D-047). */
    inicio: Dia | null;
  }[];
  readonly motivos: readonly string[];
}

/**
 * Lo que necesita la pantalla de cierre de una obra del PM; null si la obra no es suya o no la ve. Con `corrige`
 * (el cierre que se va a corregir, D-044), lo que ese cierre registró se ofrece otra vez: sus partidas terminadas y
 * los subs que reportó. Con `subsHasta`, también los subs que empiezan después del día, hasta esa fecha: la copia
 * para trabajar sin señal (D-047).
 */
export async function datosParaCierre(
  tx: Tx,
  entrada: { obraId: string; dia?: string | null; corrige?: string | null; subsHasta?: string | null },
  ahora = new Date(),
): Promise<DatosCierre | null> {
  const e = validarEntrada(
    z.object({
      obraId: uuid,
      dia: esquemaDia.nullish(),
      corrige: uuid.nullish(),
      subsHasta: esquemaDia.nullish(),
    }),
    entrada,
  );
  const corrige = e.corrige ?? null;
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
    select partida_obra_id as partida, estado from avance where obra_id = ${obra.id} and estado_registro = 'vigente'
      and bitacora_id is distinct from ${corrige}`;
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
  // lo que cada uno ya lleva ese día en otras obras de la empresa (la base suma todas, aunque no sean de este PM)
  const yaLleva = new Map<string, number>();
  for (const r of await tx<{ trabajador_id: string; obra_id: string; cantidad: string }[]>`
    select trabajador_id, obra_id, cantidad from public.cuadrilla_del_dia(${elDia})`) {
    if (r.obra_id !== obra.id)
      yaLleva.set(r.trabajador_id, (yaLleva.get(r.trabajador_id) ?? 0) + Number(r.cantidad));
  }
  // la cuadrilla de esta obra (D-104): quiénes trabajaron en sus últimos 10 cierres con cuadrilla antes de ese día, y
  // cuánto, sumando lo repartido entre las partidas de cada cierre (D-077)
  const deLaObra = await tx<{ bitacora: string; dia: Dia; trabajador: string; cantidad: string }[]>`
    with ultimos as (
      select b.id, b.dia from bitacora b
      where b.obra_id = ${obra.id} and b.estado = 'vigente' and b.dia < ${elDia} and b.id is distinct from ${corrige}
        and exists (select 1 from mano_obra m where m.bitacora_id = b.id and m.estado = 'vigente')
      order by b.dia desc
      limit 10)
    select u.id as bitacora, to_char(u.dia, 'YYYY-MM-DD') as dia, m.trabajador_id as trabajador,
           sum(m.cantidad)::text as cantidad
    from ultimos u join mano_obra m on m.bitacora_id = u.id and m.estado = 'vigente'
    group by u.id, u.dia, m.trabajador_id
    order by u.dia desc`;
  const activos = new Set(trabajadores.map((t) => t.id));
  const reciente = new Map<string, Dia>();
  for (const r of deLaObra) if (!reciente.has(r.trabajador)) reciente.set(r.trabajador, r.dia);
  const ultimo = deLaObra[0];
  const ultimoCierre = ultimo
    ? {
        dia: ultimo.dia,
        cuadrilla: deLaObra
          .filter((r) => r.bitacora === ultimo.bitacora && activos.has(r.trabajador))
          .map((r) => ({ trabajadorId: r.trabajador, cantidad: Number(r.cantidad) })),
      }
    : null;
  // los subs que se esperan ese día: su orden ya empezó, sigue viva y no se ha reportado si llegó
  const subs = await tx<
    {
      id: string;
      folio: string;
      sub: string;
      alcance: string | null;
      partida: string | null;
      inicio: Dia | null;
    }[]
  >`
    select o.id, o.folio, coalesce(s.nombre, '') as sub, o.alcance, o.partida_obra_id as partida,
           to_char(o.inicio_programado, 'YYYY-MM-DD') as inicio
    from ordenes_trabajo o left join subcontratistas_pm s on s.id = o.subcontratista_id
    where o.obra_id = ${obra.id}
      and ((o.estado in ('emitida', 'confirmada') and o.se_presento is null
            and o.inicio_programado is not null and o.inicio_programado <= ${e.subsHasta ?? elDia})
           or o.id in (select orden_trabajo_id from bitacora_subs where bitacora_id = ${corrige}))
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
      yaLleva: yaLleva.get(t.id) ?? 0,
      reciente: reciente.get(t.id) ?? null,
    })),
    ultimoCierre: ultimoCierre?.cuadrilla.length ? ultimoCierre : null,
    subs: subs.map((x) => ({
      ordenId: x.id,
      folio: x.folio,
      sub: x.sub,
      alcance: x.alcance ?? '',
      partida: x.partida ? (nombrePartida.get(x.partida) ?? null) : null,
      inicio: x.inicio,
    })),
    motivos: MOTIVOS_SIN_TRABAJO,
  };
}
