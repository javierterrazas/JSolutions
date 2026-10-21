// La bitácora de una obra para el PM (D-105): sus días cerrados, del más nuevo al más viejo, con lo que se capturó
// (partidas trabajadas y terminadas, cuadrilla y sus horas, subs que llegaron, notas y fotos), sin dinero. Así el PM
// vuelve a ver lo que cerró sin pedírselo al dueño, y corrige lo que todavía puede (48 horas, D-044).
import { type Dia, HORAS_PARA_CORREGIR_PM } from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import type { Nombre } from './consultas-obra';
import { uuid, validarEntrada } from './entrada';
import { leerSesion } from './sesion';

/** Cuántos días cerrados por página. */
export const DIAS_DE_BITACORA = 15;

export interface DiaDeLaBitacora {
  readonly dia: Dia;
  readonly folio: string;
  readonly sinTrabajo: boolean;
  readonly motivo: string | null;
  readonly tardio: boolean;
  readonly incidencia: string | null;
  readonly partidas: readonly { espacio: string; partida: Nombre; terminada: boolean }[];
  /** Horas, o días si cobra por día. */
  readonly cuadrilla: readonly { nombre: string; tipoPago: 'hora' | 'dia'; cantidad: number }[];
  readonly subs: readonly { sub: string; llego: boolean }[];
  readonly fotos: readonly string[];
  /** Lo cerró este PM y no han pasado 48 horas: todavía lo puede corregir. */
  readonly corregible: boolean;
}

export interface BitacoraDeObra {
  readonly obra: { id: string; folio: string; cliente: string };
  readonly dias: readonly DiaDeLaBitacora[];
  readonly hayMas: boolean;
}

/** Los días cerrados de una obra que el miembro ve (el PM, las suyas), por páginas; null si no la ve. */
export async function bitacoraDeObra(
  tx: Tx,
  entrada: { obraId: string; pagina?: number },
  ahora = new Date(),
): Promise<BitacoraDeObra | null> {
  const e = validarEntrada(
    z.object({ obraId: uuid, pagina: z.number().int().min(0).max(1000).default(0) }),
    entrada,
  );
  const s = await leerSesion(tx, ahora);
  const [obra] = await tx<BitacoraDeObra['obra'][]>`
    select id, folio, cliente from obras where id = ${e.obraId}`;
  if (!obra) return null;

  const cierres = await tx<
    {
      id: string;
      folio: string;
      dia: Dia;
      sin_trabajo: boolean;
      motivo: string | null;
      tardio: boolean;
      incidencia: string | null;
      creado_por: string | null;
      creado_en: Date;
    }[]
  >`
    select id, folio, to_char(dia, 'YYYY-MM-DD') as dia, sin_trabajo, motivo_sin_trabajo as motivo, tardio,
           incidencia, creado_por, creado_en
    from bitacora where obra_id = ${obra.id} and estado = 'vigente'
    order by dia desc
    limit ${DIAS_DE_BITACORA + 1} offset ${e.pagina * DIAS_DE_BITACORA}`;
  const pagina = cierres.slice(0, DIAS_DE_BITACORA);
  const ids = pagina.map((b) => b.id);
  if (!ids.length) return { obra, dias: [], hayMas: false };

  const partidas = await tx<
    { bitacora_id: string; espacio: string; es: string; en: string | null; terminada: boolean }[]
  >`
    select bp.bitacora_id, es.nombre as espacio, p.nombre_es as es, p.nombre_en as en,
           exists (select 1 from avance a where a.bitacora_id = bp.bitacora_id and a.partida_obra_id = p.id
                     and a.estado = 'terminada' and a.estado_registro = 'vigente') as terminada
    from bitacora_partidas bp join partidas_obra p on p.id = bp.partida_obra_id
    join espacios es on es.id = p.espacio_id
    where bp.bitacora_id in ${tx(ids)} order by es.orden, p.orden`;
  const cuadrilla = await tx<
    { bitacora_id: string; nombre: string | null; tipo_pago: 'hora' | 'dia' | null; cantidad: string }[]
  >`
    select m.bitacora_id, t.nombre, t.tipo_pago, sum(m.cantidad)::text as cantidad
    from mano_obra m left join trabajadores t on t.id = m.trabajador_id
    where m.bitacora_id in ${tx(ids)} and m.estado = 'vigente'
    group by m.bitacora_id, m.trabajador_id, t.nombre, t.tipo_pago
    order by t.nombre`;
  const subs = await tx<{ bitacora_id: string; sub: string; llego: boolean }[]>`
    select bitacora_id, sub, llego from bitacora_subs_pm where bitacora_id in ${tx(ids)} order by sub`;
  const fotos = await tx<{ ref_id: string; id: string }[]>`
    select ref_id, id from fotos where ref_tipo = 'bitacora' and ref_id in ${tx(ids)} order by indice`;

  return {
    obra,
    dias: pagina.map((b) => ({
      dia: b.dia,
      folio: b.folio,
      sinTrabajo: b.sin_trabajo,
      motivo: b.motivo,
      tardio: b.tardio,
      incidencia: b.incidencia,
      partidas: partidas
        .filter((p) => p.bitacora_id === b.id)
        .map((p) => ({ espacio: p.espacio, partida: { es: p.es, en: p.en }, terminada: p.terminada })),
      cuadrilla: cuadrilla
        .filter((c) => c.bitacora_id === b.id)
        .map((c) => ({
          nombre: c.nombre ?? '—',
          tipoPago: c.tipo_pago ?? 'hora',
          cantidad: Number(c.cantidad),
        })),
      subs: subs.filter((x) => x.bitacora_id === b.id).map((x) => ({ sub: x.sub, llego: x.llego })),
      fotos: fotos.filter((f) => f.ref_id === b.id).map((f) => f.id),
      corregible:
        b.creado_por === s.miembroId &&
        s.ahora.getTime() - b.creado_en.getTime() <= HORAS_PARA_CORREGIR_PM * 3600 * 1000,
    })),
    hayMas: cierres.length > DIAS_DE_BITACORA,
  };
}
