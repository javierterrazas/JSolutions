// Guardar el presupuesto por etapa (legacy: admin/servidor.js duGuardarPresupuesto). Nada se borra: una etapa que
// ya no viene queda en $0 (D-035), y cada monto que cambia deja su rastro en correcciones. El estado de la obra
// sigue al presupuesto: completo → lista para arranque; incompleto → sin presupuesto.
import {
  claveEtapa,
  type EspacioEtapas,
  ErrorDeNegocio,
  normalizarPresupuesto,
  presupuestoCompleto,
} from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import { uuid, validarEntrada } from './entrada';
import { exigirDueno, leerSesion } from './sesion';

const EntradaPresupuesto = z.object({
  obraId: uuid,
  lineas: z.array(z.object({ espacioId: uuid, etapaId: uuid.nullable(), monto: z.number() })),
  motivo: z.string().default('Presupuesto actualizado'),
});
export type EntradaPresupuesto = z.input<typeof EntradaPresupuesto>;

export interface ResultadoPresupuesto {
  readonly completo: boolean;
  /** Los espacios que todavía no tienen ninguna etapa con monto. */
  readonly faltan: readonly string[];
  readonly total: number;
}

/** Los espacios de una obra con sus partidas activas y sus etapas, en orden. */
export async function espaciosConEtapas(tx: Tx, obraId: string): Promise<EspacioEtapas[]> {
  const filas = await tx<
    {
      id: string;
      generales: boolean;
      tipo: string;
      pies2: string;
      partida: string | null;
      etapa: string | null;
    }[]
  >`
    select e.id, t.es_generales as generales, e.tipo_espacio_id as tipo,
           coalesce(e.pies2_verificados, e.pies2_cotizados) as pies2, p.id as partida, p.etapa_id as etapa
    from espacios e
    join tipos_espacio t on t.id = e.tipo_espacio_id
    left join partidas_obra p on p.espacio_id = e.id and p.estado = 'activa'
    where e.obra_id = ${obraId}
    order by e.orden, p.orden, p.nombre_es`;
  const out = new Map<string, EspacioEtapas & { partidas: { id: string; etapaId: string | null }[] }>();
  for (const f of filas) {
    let e = out.get(f.id);
    if (!e) {
      e = { id: f.id, generales: f.generales, tipoEspacioId: f.tipo, pies2: Number(f.pies2), partidas: [] };
      out.set(f.id, e);
    }
    if (f.partida) e.partidas.push({ id: f.partida, etapaId: f.etapa });
  }
  return [...out.values()];
}

export async function guardarPresupuesto(
  tx: Tx,
  entrada: EntradaPresupuesto,
  ahora = new Date(),
): Promise<ResultadoPresupuesto> {
  const e = validarEntrada(EntradaPresupuesto, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const [obra] = await tx<{ estado: string }[]>`select estado from obras where id = ${e.obraId}`;
  if (!obra) throw new ErrorDeNegocio('obra_no_encontrada');
  const [cerrada] = await tx`select 1 from obras_cerradas where obra_id = ${e.obraId}`;
  if (cerrada || obra.estado === 'entregada') throw new ErrorDeNegocio('obra_cerrada');

  const espacios = await espaciosConEtapas(tx, e.obraId);
  const nuevas = normalizarPresupuesto(espacios, e.lineas);
  const actuales = await tx<{ id: string; espacio_id: string; etapa_id: string | null; monto: string }[]>`
    select id, espacio_id, etapa_id, monto from presupuesto_etapas where obra_id = ${e.obraId}`;
  const porClave = new Map(actuales.map((a) => [claveEtapa(a.espacio_id, a.etapa_id), a]));
  const vistas = new Set<string>();

  const rastro = async (registroId: string, antes: number, despues: number) => {
    await tx`insert into correcciones (empresa_id, tabla, registro_id, accion, campo, antes, despues, motivo)
             values (${s.empresaId}, 'presupuesto_etapas', ${registroId}, 'editar', 'monto', ${String(antes)},
                     ${String(despues)}, ${e.motivo})`;
  };
  for (const l of nuevas) {
    const k = claveEtapa(l.espacioId, l.etapaId);
    vistas.add(k);
    const actual = porClave.get(k);
    if (!actual) {
      await tx`insert into presupuesto_etapas (empresa_id, obra_id, espacio_id, etapa_id, monto)
               values (${s.empresaId}, ${e.obraId}, ${l.espacioId}, ${l.etapaId}, ${l.monto})`;
    } else if (Number(actual.monto) !== l.monto) {
      await tx`update presupuesto_etapas set monto = ${l.monto} where id = ${actual.id}`;
      await rastro(actual.id, Number(actual.monto), l.monto);
    }
  }
  // lo que ya no viene queda en cero, con su rastro
  for (const a of actuales) {
    if (vistas.has(claveEtapa(a.espacio_id, a.etapa_id)) || Number(a.monto) === 0) continue;
    await tx`update presupuesto_etapas set monto = 0 where id = ${a.id}`;
    await rastro(a.id, Number(a.monto), 0);
  }

  const c = presupuestoCompleto(espacios, nuevas);
  if (c.completo && obra.estado === 'sin_presupuesto') {
    await tx`update obras set estado = 'lista_para_arranque' where id = ${e.obraId}`;
  } else if (!c.completo && obra.estado === 'lista_para_arranque') {
    await tx`update obras set estado = 'sin_presupuesto' where id = ${e.obraId}`;
  }
  return { completo: c.completo, faltan: c.faltan, total: nuevas.reduce((a, l) => a + l.monto, 0) };
}
