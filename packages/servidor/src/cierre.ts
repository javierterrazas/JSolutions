// Cerrar el día (legacy: pm/servidor.js pmCerrarDia). Un solo paso: en qué partidas se trabajó, cuáles quedaron
// terminadas, quién de la cuadrilla estuvo, si llegó el sub y cuántas fotos se suben (ahora o después). Escribe
// bitácora, partidas, subs, avance y cuadrilla, y la obra arranca con su primer día de trabajo. Todo o nada.
import {
  type Dia,
  diaDeCaptura,
  ErrorDeNegocio,
  exigirInspecciones,
  MOTIVOS_SIN_TRABAJO,
  validarCierreDia,
  validarCierreTardioPM,
  validarCuadrilla,
} from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import { dia, uuid, validarEntrada } from './entrada';
import { leerSesion } from './sesion';

const EntradaCierre = z.object({
  obraId: uuid,
  /** El día olvidado que el PM cierra tarde (solo los últimos 2 laborables). */
  tardio: dia.nullish(),
  /** Cuándo se capturó en el teléfono (sin señal se envía después): ISO 8601. */
  capturado: z.string().nullish(),
  sinTrabajo: z.boolean().default(false),
  motivo: z.enum(MOTIVOS_SIN_TRABAJO).nullish(),
  incidencia: z.string().nullish(),
  partidas: z.array(uuid).default([]),
  terminadas: z.array(uuid).default([]),
  cuadrilla: z
    .array(z.object({ trabajadorId: uuid, cantidad: z.number().positive(), partidaId: uuid.nullish() }))
    .default([]),
  subs: z.array(z.object({ ordenTrabajoId: uuid, llego: z.boolean() })).default([]),
  fotosPorSubir: z.number().int().nonnegative().default(0),
  /** La clave que le puso el teléfono al capturarlo: un reintento con la misma clave no lo duplica (D-042). */
  claveEnvio: uuid.nullish(),
});
export type EntradaCierre = z.input<typeof EntradaCierre>;

export interface ResultadoCierre {
  readonly bitacoraId: string;
  readonly folio: string;
  readonly dia: Dia;
  readonly tardio: boolean;
  readonly fotosComprometidas: number;
  /** Horas (o días) de cuadrilla registradas. */
  readonly cuadrilla: number;
}

export async function cerrarDia(
  tx: Tx,
  entrada: EntradaCierre,
  ahora = new Date(),
): Promise<ResultadoCierre> {
  const e = validarEntrada(EntradaCierre, entrada);
  const s = await leerSesion(tx, ahora);
  if (s.rol !== 'pm') throw new ErrorDeNegocio('solo_pm');
  const [obra] = await tx<{ estado: string }[]>`select estado from obras where id = ${e.obraId}`;
  if (!obra) throw new ErrorDeNegocio('obra_no_encontrada');

  // un reintento del mismo cierre: el servidor ya lo guardó y la respuesta no llegó al teléfono (D-042)
  if (e.claveEnvio) {
    const [ya] = await tx<
      { id: string; folio: string; dia: Dia; tardio: boolean; fotos: number; cuadrilla: string }[]
    >`
      select b.id, b.folio, b.dia, b.tardio, b.fotos_comprometidas as fotos,
             coalesce((select sum(m.cantidad) from mano_obra m
                       where m.bitacora_id = b.id and m.estado = 'vigente'), 0) as cuadrilla
      from bitacora b where b.obra_id = ${e.obraId} and b.clave_envio = ${e.claveEnvio}`;
    if (ya)
      return {
        bitacoraId: ya.id,
        folio: ya.folio,
        dia: ya.dia,
        tardio: ya.tardio,
        fotosComprometidas: ya.fotos,
        cuadrilla: Number(ya.cuadrilla),
      };
  }

  // el día: el olvidado (con su ventana), o el de la captura
  const cerrados = new Set(
    (
      await tx<{ dia: Dia }[]>`select dia from bitacora where obra_id = ${e.obraId} and estado = 'vigente'`
    ).map((b) => b.dia),
  );
  let elDia: Dia;
  if (e.tardio) {
    validarCierreTardioPM(e.tardio, s.hoy, cerrados, s.calendario);
    elDia = e.tardio;
  } else {
    elDia = diaDeCaptura(e.capturado, s.ahora, s.zona);
    // un solo cierre por obra y día (D-022): el legacy dejaba cerrar dos veces el mismo día
    if (cerrados.has(elDia)) throw new ErrorDeNegocio('dia_ya_cerrado', { dia: elDia });
  }

  const partidas = await tx<{ id: string; espacio_id: string; hito_id: string | null }[]>`
    select id, espacio_id, hito_id from partidas_obra where obra_id = ${e.obraId} and estado = 'activa'`;
  const partida = new Map(partidas.map((p) => [p.id, p]));
  const ajena = [
    ...e.partidas,
    ...e.terminadas,
    ...e.cuadrilla.flatMap((c) => (c.partidaId ? [c.partidaId] : [])),
  ].find((id) => !partida.has(id));
  if (ajena) throw new ErrorDeNegocio('partida_de_otra_obra', { partida: ajena });
  if (e.terminadas.some((t) => !e.partidas.includes(t))) throw new ErrorDeNegocio('terminada_sin_trabajar');

  const ordenes = await tx<{ id: string }[]>`select id from ordenes_trabajo where obra_id = ${e.obraId}`;
  const { fotosComprometidas } = validarCierreDia({
    sinTrabajo: e.sinTrabajo,
    motivo: e.motivo ?? null,
    obraSinPresupuesto: obra.estado === 'sin_presupuesto',
    fotos: 0,
    fotosPorSubir: e.fotosPorSubir,
    partidas: e.sinTrabajo ? [] : e.partidas,
    ordenesReportadas: e.subs.map((x) => x.ordenTrabajoId),
    ordenesDeLaObra: new Set(ordenes.map((o) => o.id)),
  });
  const partidasDelDia = e.sinTrabajo ? [] : e.partidas;
  const terminadas = e.sinTrabajo ? [] : e.terminadas;
  const cuadrilla = e.sinTrabajo ? [] : e.cuadrilla;

  const inspecciones = await tx<
    { espacio_id: string; hito_id: string; resultado: 'aprobado' | 'con_defectos'; en: string }[]
  >`
    select espacio_id, hito_id, resultado, realizada_en::text as en from inspecciones where obra_id = ${e.obraId}`;
  exigirInspecciones(
    terminadas.map((t) => ({
      partidaId: t,
      espacioId: partida.get(t)!.espacio_id,
      hitoId: partida.get(t)!.hito_id,
    })),
    inspecciones.map((i) => ({
      espacioId: i.espacio_id,
      hitoId: i.hito_id,
      resultado: i.resultado,
      realizadaEn: i.en,
    })),
  );

  const trabajadores = await tx<
    { id: string; tipo_pago: 'hora' | 'dia' }[]
  >`select id, tipo_pago from trabajadores`;
  const delDia = await tx<{ id: string; trabajador_id: string; obra_id: string; cantidad: string }[]>`
    select * from public.cuadrilla_del_dia(${elDia})`;
  validarCuadrilla(
    cuadrilla.map((c) => ({ trabajadorId: c.trabajadorId, cantidad: c.cantidad })),
    elDia,
    trabajadores.map((t) => ({ id: t.id, tipoPago: t.tipo_pago })),
    delDia.map((r) => ({
      id: r.id,
      trabajadorId: r.trabajador_id,
      obraId: r.obra_id,
      dia: elDia,
      cantidad: Number(r.cantidad),
    })),
  );

  // ---------------------------------------------------------------- escribir
  const [bit] = await tx<{ id: string; folio: string }[]>`
    insert into bitacora (empresa_id, obra_id, dia, sin_trabajo, motivo_sin_trabajo, incidencia, tardio, fotos_comprometidas,
                          clave_envio)
    values (${s.empresaId}, ${e.obraId}, ${elDia}, ${e.sinTrabajo}, ${e.sinTrabajo ? e.motivo! : null},
            ${e.incidencia ?? null}, ${!!e.tardio}, ${fotosComprometidas}, ${e.claveEnvio ?? null})
    returning id, folio`;
  const bitacoraId = bit!.id;
  if (partidasDelDia.length) {
    await tx`insert into bitacora_partidas ${tx(
      partidasDelDia.map((p) => ({
        empresa_id: s.empresaId,
        obra_id: e.obraId,
        bitacora_id: bitacoraId,
        partida_obra_id: p,
      })),
    )}`;
  }

  // los subs programados: si llegaron (alimenta la tasa de presentación); una orden emitida que llega se confirma
  if (e.subs.length) {
    await tx`insert into bitacora_subs ${tx(
      e.subs.map((x) => ({
        empresa_id: s.empresaId,
        obra_id: e.obraId,
        bitacora_id: bitacoraId,
        orden_trabajo_id: x.ordenTrabajoId,
        llego: x.llego,
      })),
    )}`;
    for (const x of e.subs) {
      await tx`update ordenes_trabajo
               set se_presento = ${x.llego},
                   estado = case when ${x.llego} and estado = 'emitida' then 'confirmada'::estado_orden_trabajo else estado end
               where id = ${x.ordenTrabajoId}`;
    }
  }

  // avance: en progreso, o terminada si se marcó; sin repetir el mismo estado de la misma partida
  const previo = new Set(
    (
      await tx<{ partida: string; estado: string }[]>`
        select partida_obra_id as partida, estado from avance where obra_id = ${e.obraId} and estado_registro = 'vigente'`
    ).map((a) => `${a.partida}|${a.estado}`),
  );
  const avance = partidasDelDia
    .map((p) => ({ p, estado: terminadas.includes(p) ? 'terminada' : 'en_progreso' }))
    .filter((a) => !previo.has(`${a.p}|${a.estado}`));
  if (avance.length) {
    await tx`insert into avance ${tx(
      avance.map((a) => ({
        empresa_id: s.empresaId,
        obra_id: e.obraId,
        partida_obra_id: a.p,
        bitacora_id: bitacoraId,
        estado: a.estado,
        dia: elDia,
      })),
    )}`;
  }

  // cuadrilla: un renglón por trabajador; sin partida, la primera del día
  const filas = cuadrilla.map((c) => {
    const p = c.partidaId ?? partidasDelDia[0];
    if (!p) throw new ErrorDeNegocio('cuadrilla_sin_partida');
    return {
      empresa_id: s.empresaId,
      obra_id: e.obraId,
      espacio_id: partida.get(p)!.espacio_id,
      partida_obra_id: p,
      trabajador_id: c.trabajadorId,
      cantidad: c.cantidad,
      dia: elDia,
      bitacora_id: bitacoraId,
    };
  });
  if (filas.length) await tx`insert into mano_obra ${tx(filas)}`;

  // la obra arranca con su primer día de trabajo
  if (!e.sinTrabajo && obra.estado === 'lista_para_arranque') {
    await tx`update obras set estado = 'en_obra' where id = ${e.obraId}`;
  }
  return {
    bitacoraId,
    folio: bit!.folio,
    dia: elDia,
    tardio: !!e.tardio,
    fotosComprometidas,
    cuadrilla: filas.reduce((a, f) => a + f.cantidad, 0),
  };
}

/** El cierre que el teléfono mandó con esa clave, si ya llegó (D-042): sus fotos se suben a él. */
export async function cierreDeClave(tx: Tx, claveEnvio: string): Promise<string | null> {
  const clave = validarEntrada(uuid, claveEnvio);
  const [b] = await tx<{ id: string }[]>`select id from bitacora where clave_envio = ${clave}`;
  return b?.id ?? null;
}
