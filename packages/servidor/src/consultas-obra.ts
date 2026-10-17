// Lo que leen las pantallas del dueño para dar de alta una obra y capturar su presupuesto (D-039). Solo leen, con
// la identidad del dueño: RLS decide qué ve (los montos son de la muralla financiera, D-002).
import { claveEtapa, etapasDeEspacio } from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import { uuid, validarEntrada } from './entrada';
import { espaciosConEtapas } from './presupuesto';
import { exigirDueno, leerSesion } from './sesion';

export interface Nombre {
  readonly es: string;
  readonly en: string | null;
}

export interface DatosObraNueva {
  /** Los tipos de espacio que se capturan (sin Generales de obra: toda obra lo tiene). */
  readonly tipos: readonly { id: string; nombre: Nombre; partidas: number }[];
  readonly pms: readonly { id: string; nombre: string }[];
}

export async function datosParaObraNueva(tx: Tx, ahora = new Date()): Promise<DatosObraNueva> {
  exigirDueno(await leerSesion(tx, ahora));
  const tipos = await tx<{ id: string; es: string; en: string | null; partidas: number }[]>`
    select t.id, t.nombre_es as es, t.nombre_en as en,
           (select count(*)::int from plantillas_partida p where p.tipo_espacio_id = t.id and p.activa) as partidas
    from tipos_espacio t where t.activo and not t.es_generales order by t.orden, t.nombre_es`;
  const pms = await tx<{ id: string; nombre: string }[]>`
    select id, nombre from miembros where rol = 'pm' and activo order by nombre`;
  return {
    tipos: tipos.map((t) => ({ id: t.id, nombre: { es: t.es, en: t.en }, partidas: t.partidas })),
    pms,
  };
}

export interface ObraDeLaLista {
  readonly id: string;
  readonly folio: string;
  readonly cliente: string;
  readonly direccion: string;
  readonly estado: 'sin_presupuesto' | 'lista_para_arranque' | 'en_obra' | 'entregada';
  readonly pm: string;
  readonly inicio: string;
}

/** Las obras de la empresa, las más recientes primero. */
export async function obrasDeLaEmpresa(tx: Tx, ahora = new Date()): Promise<ObraDeLaLista[]> {
  exigirDueno(await leerSesion(tx, ahora));
  return tx<ObraDeLaLista[]>`
    select o.id, o.folio, o.cliente, o.direccion, o.estado, m.nombre as pm, o.fecha_inicio::text as inicio
    from obras o join miembros m on m.id = o.pm_id
    order by o.creado_en desc`;
}

export interface PresupuestoParaCapturar {
  readonly obra: Omit<ObraDeLaLista, 'pm' | 'inicio'>;
  /**
   * Cada espacio con las etapas de sus partidas: su precio (`monto`, 0 si no tiene) y su costo (D-084; null si no lo
   * tiene).
   */
  readonly espacios: readonly {
    id: string;
    nombre: string;
    generales: boolean;
    /** Sus medidas vigentes (las verificadas, o las cotizadas): con ellas sale el costo por unidad (D-086). */
    pies2: number;
    piesLineales: number;
    etapas: readonly {
      etapaId: string | null;
      nombre: Nombre | null;
      /** Cómo se cotiza la etapa; "Otras partidas", por pie². */
      unidad: 'pie2' | 'pie_lineal';
      partidas: number;
      monto: number;
      costo: number | null;
    }[];
  }[];
  readonly total: number;
  /** El margen que se busca en la obra; si no tiene, el de la empresa. */
  readonly margenObjetivo: number;
  /** El contrato con el cliente; null si no tiene. */
  readonly contrato: number | null;
}

/** Lo que se captura en el presupuesto por etapa de una obra; null si el dueño no la ve. */
export async function presupuestoParaCapturar(
  tx: Tx,
  entrada: { obraId: string },
  ahora = new Date(),
): Promise<PresupuestoParaCapturar | null> {
  exigirDueno(await leerSesion(tx, ahora));
  const { obraId } = validarEntrada(z.object({ obraId: uuid }), entrada);
  const [obra] = await tx<PresupuestoParaCapturar['obra'][]>`
    select id, folio, cliente, direccion, estado from obras where id = ${obraId}`;
  if (!obra) return null;
  const espacios = await espaciosConEtapas(tx, obraId);
  const nombresEspacio = new Map(
    (
      await tx<{ id: string; nombre: string }[]>`select id, nombre from espacios where obra_id = ${obraId}`
    ).map((e) => [e.id, e.nombre]),
  );
  const etapas = new Map(
    (
      await tx<
        { id: string; es: string; en: string | null; unidad: 'pie2' | 'pie_lineal' }[]
      >`select id, nombre_es as es, nombre_en as en, unidad from etapas`
    ).map((e) => [e.id, { nombre: { es: e.es, en: e.en }, unidad: e.unidad }]),
  );
  const lineales = new Map(
    (
      await tx<{ id: string; lineales: string }[]>`
        select id, coalesce(pies_lineales_verificados, pies_lineales_cotizados) as lineales
        from espacios where obra_id = ${obraId}`
    ).map((e) => [e.id, Number(e.lineales)]),
  );
  const montos = new Map(
    (
      await tx<{ espacio_id: string; etapa_id: string | null; monto: string; costo: string | null }[]>`
        select espacio_id, etapa_id, monto, costo from presupuesto_etapas where obra_id = ${obraId}`
    ).map((m) => [
      claveEtapa(m.espacio_id, m.etapa_id),
      { monto: Number(m.monto), costo: m.costo === null ? null : Number(m.costo) },
    ]),
  );
  const [f] = await tx<{ margen: string | null; contrato: string | null; empresa: string }[]>`
    select f.margen_objetivo as margen, f.contrato_original as contrato, c.margen_presupuesto as empresa
    from configuracion c left join obras_finanzas f on f.obra_id = ${obraId}`;
  const lista = espacios.map((e) => ({
    id: e.id,
    nombre: nombresEspacio.get(e.id) ?? '',
    generales: e.generales,
    pies2: e.pies2,
    piesLineales: lineales.get(e.id) ?? 0,
    etapas: etapasDeEspacio(e).map((x) => ({
      etapaId: x.etapaId,
      nombre: x.etapaId ? (etapas.get(x.etapaId)?.nombre ?? null) : null,
      unidad: (x.etapaId ? etapas.get(x.etapaId)?.unidad : null) ?? 'pie2',
      partidas: x.partidas.length,
      monto: montos.get(claveEtapa(e.id, x.etapaId))?.monto ?? 0,
      costo: montos.get(claveEtapa(e.id, x.etapaId))?.costo ?? null,
    })),
  }));
  const total = lista.reduce((a, e) => a + e.etapas.reduce((b, x) => b + x.monto, 0), 0);
  return {
    obra,
    espacios: lista,
    total,
    margenObjetivo: Number(f?.margen ?? f?.empresa ?? 0.35),
    contrato: f?.contrato === null || f?.contrato === undefined ? null : Number(f.contrato),
  };
}
