// Cerrar el día (legacy: pm/servidor.js pmCerrarDia). Un solo paso: en qué partidas se trabajó, cuáles quedaron
// terminadas, quién de la cuadrilla estuvo, si llegó el sub y cuántas fotos se suben (ahora o después). Escribe
// bitácora, partidas, subs, avance y cuadrilla, y la obra arranca con su primer día de trabajo. Todo o nada.
import {
  type Dia,
  diaDeCaptura,
  ErrorDeNegocio,
  exigirInspecciones,
  HORAS_PARA_CORREGIR_PM,
  MOTIVOS_SIN_TRABAJO,
  validarCierreDia,
  validarCierreTardioPM,
  validarCuadrilla,
} from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import { dia, uuid, validarEntrada } from './entrada';
import { anularCierre } from './correcciones';
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

/** Para corregir un cierre (corregirCierre): el que se anuló, su día y las fotos que ya tenía. */
interface Correccion {
  readonly corrigeA: string;
  readonly dia: Dia;
  readonly tardio: boolean;
  readonly fotosPrevias: number;
}

export async function cerrarDia(
  tx: Tx,
  entrada: EntradaCierre,
  ahora = new Date(),
  correccion?: Correccion,
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
  if (correccion) {
    // el día del cierre que se corrige: sus reglas (48 h, solo el suyo) ya las revisó anularCierre
    elDia = correccion.dia;
    if (cerrados.has(elDia)) throw new ErrorDeNegocio('dia_ya_cerrado', { dia: elDia });
  } else if (e.tardio) {
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
    fotos: correccion?.fotosPrevias ?? 0,
    fotosPorSubir: e.fotosPorSubir,
    partidas: e.sinTrabajo ? [] : e.partidas,
    ordenesReportadas: e.subs.map((x) => x.ordenTrabajoId),
    ordenesDeLaObra: new Set(ordenes.map((o) => o.id)),
  });
  const tardio = correccion ? correccion.tardio : !!e.tardio;
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
                          clave_envio, corrige_a)
    values (${s.empresaId}, ${e.obraId}, ${elDia}, ${e.sinTrabajo}, ${e.sinTrabajo ? e.motivo! : null},
            ${e.incidencia ?? null}, ${tardio}, ${fotosComprometidas}, ${e.claveEnvio ?? null},
            ${correccion?.corrigeA ?? null})
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
    tardio,
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

const EntradaCorreccion = EntradaCierre.omit({ obraId: true, tardio: true, capturado: true }).extend({
  bitacoraId: uuid,
  motivo: z.string(),
});
export type EntradaCorreccionCierre = z.input<typeof EntradaCorreccion>;

/** Las fotos de un cierre: las suyas y las de los cierres que corrige (corrige_a), que se quedan donde se subieron. */
export async function fotosDelCierre(tx: Tx, bitacoraId: string): Promise<number> {
  const [f] = await tx<{ n: number }[]>`
    with recursive cadena as (
      select id, corrige_a from bitacora where id = ${bitacoraId}
      union all
      select b.id, b.corrige_a from bitacora b join cadena c on b.id = c.corrige_a
    )
    select count(*)::int as n from fotos where ref_tipo = 'bitacora' and ref_id in (select id from cadena)`;
  return f!.n;
}

/**
 * Corrige un cierre del PM (D-044): lo anula con su motivo (anularCierre: dentro de 48 h y solo el suyo) y lo vuelve
 * a cerrar el mismo día con lo corregido, todo en una transacción. El cierre nuevo dice a cuál corrige: las fotos que
 * ya se subieron cuentan para él sin moverse, y las nuevas se le suben con sus números. Nada se borra: el cierre
 * anterior queda anulado con su rastro.
 */
export async function corregirCierre(
  tx: Tx,
  entrada: EntradaCorreccionCierre,
  ahora = new Date(),
): Promise<ResultadoCierre> {
  const { bitacoraId, motivo, ...cierre } = validarEntrada(EntradaCorreccion, entrada);
  const [b] = await tx<{ obra_id: string; dia: Dia; tardio: boolean }[]>`
    select obra_id, dia, tardio from bitacora where id = ${bitacoraId} and estado = 'vigente'`;
  if (!b) throw new ErrorDeNegocio('registro_no_encontrado');
  const fotos = await fotosDelCierre(tx, bitacoraId);
  await anularCierre(tx, { bitacoraId, motivo }, ahora);
  return cerrarDia(tx, { ...cierre, obraId: b.obra_id }, ahora, {
    corrigeA: bitacoraId,
    dia: b.dia,
    tardio: b.tardio,
    fotosPrevias: fotos,
  });
}

export interface CierreParaCorregir {
  readonly bitacoraId: string;
  readonly folio: string;
  /** Si el PM todavía lo puede corregir: es suyo y no han pasado 48 horas. */
  readonly corregible: boolean;
  readonly sinTrabajo: boolean;
  readonly motivo: string | null;
  readonly incidencia: string | null;
  readonly partidas: readonly string[];
  readonly terminadas: readonly string[];
  readonly cuadrilla: readonly { trabajadorId: string; cantidad: number }[];
  readonly subs: readonly { ordenTrabajoId: string; llego: boolean }[];
  readonly fotos: number;
}

/** El cierre vigente de una obra en un día, con lo que se capturó, para corregirlo; null si ese día no se cerró. */
export async function cierreParaCorregir(
  tx: Tx,
  entrada: { obraId: string; dia: string },
  ahora = new Date(),
): Promise<CierreParaCorregir | null> {
  const e = validarEntrada(z.object({ obraId: uuid, dia }), entrada);
  const s = await leerSesion(tx, ahora);
  const [b] = await tx<
    {
      id: string;
      folio: string;
      sin_trabajo: boolean;
      motivo: string | null;
      incidencia: string | null;
      creado_por: string;
      creado_en: Date;
    }[]
  >`
    select id, folio, sin_trabajo, motivo_sin_trabajo as motivo, incidencia, creado_por, creado_en
    from bitacora where obra_id = ${e.obraId} and dia = ${e.dia} and estado = 'vigente'`;
  if (!b) return null;
  const partidas = await tx<{ id: string }[]>`
    select partida_obra_id as id from bitacora_partidas where bitacora_id = ${b.id}`;
  const terminadas = await tx<{ id: string }[]>`
    select partida_obra_id as id from avance where bitacora_id = ${b.id} and estado = 'terminada'
      and estado_registro = 'vigente'`;
  const cuadrilla = await tx<{ trabajador: string; cantidad: string }[]>`
    select trabajador_id as trabajador, cantidad from mano_obra where bitacora_id = ${b.id} and estado = 'vigente'`;
  const subs = await tx<{ orden: string; llego: boolean }[]>`
    select orden_trabajo_id as orden, llego from bitacora_subs where bitacora_id = ${b.id}`;
  const fotos = await fotosDelCierre(tx, b.id);
  return {
    bitacoraId: b.id,
    folio: b.folio,
    corregible:
      b.creado_por === s.miembroId &&
      s.ahora.getTime() - b.creado_en.getTime() <= HORAS_PARA_CORREGIR_PM * 3600 * 1000,
    sinTrabajo: b.sin_trabajo,
    motivo: b.motivo,
    incidencia: b.incidencia,
    partidas: partidas.map((p) => p.id),
    terminadas: terminadas.map((p) => p.id),
    cuadrilla: cuadrilla.map((c) => ({ trabajadorId: c.trabajador, cantidad: Number(c.cantidad) })),
    subs: subs.map((x) => ({ ordenTrabajoId: x.orden, llego: x.llego })),
    fotos,
  };
}
