// Guardar el presupuesto por etapa (legacy: admin/servidor.js duGuardarPresupuesto). Nada se borra: una etapa que
// ya no viene queda en $0 (D-035), y cada monto que cambia deja su rastro en correcciones. El estado de la obra
// sigue al presupuesto: completo → lista para arranque; incompleto → sin presupuesto.
//
// Desde D-084, de cada etapa llega su costo y su margen, y el precio (monto) lo calcula el servidor; el contrato
// puede venir también (la suma de los precios, o redondeado por el dueño). Una línea con `monto` y sin costo es un
// precio, como antes.
import {
  claveEtapa,
  type EspacioEtapas,
  ErrorDeNegocio,
  normalizarPresupuesto,
  precioConMargen,
  presupuestoCompleto,
} from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import { motivo, uuid, validarEntrada } from './entrada';
import { exigirDueno, leerSesion } from './sesion';

const margen = z.number().min(0).max(0.99);
const EntradaPresupuesto = z.object({
  obraId: uuid,
  lineas: z.array(
    z.object({
      espacioId: uuid,
      etapaId: uuid.nullable(),
      /** Lo que se espera gastar en la etapa (D-084). */
      costo: z.number().nullish(),
      /** El margen de la etapa sobre su precio; sin él, el de la obra. */
      margen: margen.nullish(),
      /** El precio, sin costo (como antes de D-084). */
      monto: z.number().nullish(),
    }),
  ),
  /** El margen que se busca en la obra. */
  margenObjetivo: margen.nullish(),
  /** El contrato con el cliente; sin él, no se toca. */
  contrato: z.number().min(0).nullish(),
  motivo: motivo.default('Presupuesto actualizado'),
});
export type EntradaPresupuesto = z.input<typeof EntradaPresupuesto>;

export interface ResultadoPresupuesto {
  readonly completo: boolean;
  /** Los espacios que todavía no tienen ninguna etapa con monto. */
  readonly faltan: readonly string[];
  /** La suma de los precios. */
  readonly total: number;
  /** La suma de los costos que llegaron. */
  readonly costo: number;
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

  const [fin] = await tx<{ margen: string | null; contrato: string | null; empresa: string }[]>`
    select f.margen_objetivo as margen, f.contrato_original as contrato, c.margen_presupuesto as empresa
    from configuracion c left join obras_finanzas f on f.obra_id = ${e.obraId}`;
  const margenObra = e.margenObjetivo ?? Number(fin?.margen ?? fin?.empresa ?? 0.35);

  // el precio de cada línea: con costo, el que deja su margen; sin costo, el monto que trae
  const costoDe = new Map<string, number>();
  const conPrecio = e.lineas.map((l) => {
    if (l.costo === null || l.costo === undefined) return { ...l, monto: l.monto ?? 0 };
    if (l.costo < 0) throw new ErrorDeNegocio('monto_negativo', { espacio: l.espacioId, etapa: l.etapaId });
    const k = claveEtapa(l.espacioId, l.etapaId);
    costoDe.set(k, (costoDe.get(k) ?? 0) + l.costo);
    return { ...l, monto: l.costo ? precioConMargen(l.costo, l.margen ?? margenObra) : 0 };
  });
  const espacios = await espaciosConEtapas(tx, e.obraId);
  const nuevas = normalizarPresupuesto(espacios, conPrecio);
  const actuales = await tx<
    { id: string; espacio_id: string; etapa_id: string | null; monto: string; costo: string | null }[]
  >`
    select id, espacio_id, etapa_id, monto, costo from presupuesto_etapas where obra_id = ${e.obraId}`;
  const porClave = new Map(actuales.map((a) => [claveEtapa(a.espacio_id, a.etapa_id), a]));
  const vistas = new Set<string>();

  const texto = (x: number | null) => (x === null ? null : String(x));
  const rastro = async (
    tabla: string,
    registroId: string,
    campo: string,
    antes: number | null,
    despues: number,
  ) => {
    await tx`insert into correcciones (empresa_id, tabla, registro_id, accion, campo, antes, despues, motivo)
             values (${s.empresaId}, ${tabla}, ${registroId}, 'editar', ${campo}, ${texto(antes)},
                     ${texto(despues)}, ${e.motivo})`;
  };
  for (const l of nuevas) {
    const k = claveEtapa(l.espacioId, l.etapaId);
    vistas.add(k);
    const actual = porClave.get(k);
    const antesCosto = actual?.costo === null || actual?.costo === undefined ? null : Number(actual.costo);
    // sin costo en la entrada (un precio, como antes), el costo que tenía se queda
    const costo = costoDe.has(k) ? costoDe.get(k)! : antesCosto;
    if (!actual) {
      await tx`insert into presupuesto_etapas (empresa_id, obra_id, espacio_id, etapa_id, monto, costo)
               values (${s.empresaId}, ${e.obraId}, ${l.espacioId}, ${l.etapaId}, ${l.monto}, ${costo})`;
      continue;
    }
    if (Number(actual.monto) === l.monto && antesCosto === costo) continue;
    await tx`update presupuesto_etapas set monto = ${l.monto}, costo = ${costo} where id = ${actual.id}`;
    if (Number(actual.monto) !== l.monto)
      await rastro('presupuesto_etapas', actual.id, 'monto', Number(actual.monto), l.monto);
    if (antesCosto !== costo && costo !== null)
      await rastro('presupuesto_etapas', actual.id, 'costo', antesCosto, costo);
  }
  // lo que ya no viene queda en cero, con su rastro
  for (const a of actuales) {
    if (vistas.has(claveEtapa(a.espacio_id, a.etapa_id)) || (!Number(a.monto) && !Number(a.costo))) continue;
    await tx`update presupuesto_etapas set monto = 0, costo = ${a.costo === null ? null : 0} where id = ${a.id}`;
    if (Number(a.monto)) await rastro('presupuesto_etapas', a.id, 'monto', Number(a.monto), 0);
    if (Number(a.costo)) await rastro('presupuesto_etapas', a.id, 'costo', Number(a.costo), 0);
  }

  // el margen de la obra y su contrato, si vienen y cambiaron
  if (
    fin &&
    e.margenObjetivo !== undefined &&
    e.margenObjetivo !== null &&
    Number(fin.margen) !== e.margenObjetivo
  )
    await tx`update obras_finanzas set margen_objetivo = ${e.margenObjetivo} where obra_id = ${e.obraId}`;
  if (
    fin &&
    fin.contrato !== null &&
    e.contrato !== undefined &&
    e.contrato !== null &&
    Number(fin.contrato) !== e.contrato
  ) {
    await tx`update obras_finanzas set contrato_original = ${e.contrato} where obra_id = ${e.obraId}`;
    await rastro('obras_finanzas', e.obraId, 'contrato_original', Number(fin.contrato), e.contrato);
  }

  const c = presupuestoCompleto(espacios, nuevas);
  if (c.completo && obra.estado === 'sin_presupuesto') {
    await tx`update obras set estado = 'lista_para_arranque' where id = ${e.obraId}`;
  } else if (!c.completo && obra.estado === 'lista_para_arranque') {
    await tx`update obras set estado = 'sin_presupuesto' where id = ${e.obraId}`;
  }
  return {
    completo: c.completo,
    faltan: c.faltan,
    total: nuevas.reduce((a, l) => a + l.monto, 0),
    costo: [...costoDe.values()].reduce((a, x) => a + x, 0),
  };
}
