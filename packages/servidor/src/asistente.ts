// El asistente del dueño (D-114): su asistente de IA (Claude, por MCP) consulta los datos de la empresa para
// analizarlos. Solo lectura y con la identidad del dueño: ve lo mismo que él en la app (RLS). Aquí van las llaves con
// que se conecta (el dueño las crea y las quita en Mi empresa; la base solo guarda su huella), el registro de lo que
// consulta, y las dos consultas pensadas para analizar: cada obra en un renglón y cada etapa de cada obra.
import { randomBytes } from 'node:crypto';
import { type Dia, diasEntre, ErrorDeNegocio } from '@ijm/core';
import postgres from 'postgres';
import { z } from 'zod';
import type { Tx } from './conexion';
import type { Nombre } from './consultas-obra';
import { uuid, validarEntrada } from './entrada';
import { numerosDeLasObras } from './seguimiento';
import { exigirDueno, exigirModulo, leerSesion } from './sesion';

// Los rechazos de las funciones de la base que son de negocio (SQLSTATE P0001 con el código como mensaje).
const DE_LA_BASE = new Set([
  'solo_el_dueno',
  'modulo_no_incluido',
  'demasiadas_llaves',
  'llave_invalida',
  'demasiadas_consultas',
]);

async function enLaBase<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof postgres.PostgresError && e.code === 'P0001' && DE_LA_BASE.has(e.message))
      throw new ErrorDeNegocio(e.message);
    throw e;
  }
}

/** Una llave nueva: se ve una sola vez, al crearla. */
export const nuevaLlaveAsistente = (): string => `jsa_${randomBytes(24).toString('base64url')}`;

export interface LlaveDelAsistente {
  readonly id: string;
  readonly nombre: string;
  /** El principio de la llave, para reconocerla. */
  readonly inicio: string;
  readonly creada: Date;
  readonly ultimoUso: Date | null;
  readonly quitada: Date | null;
  readonly consultas: number;
}

export interface ConsultaDelAsistente {
  readonly llave: string;
  readonly herramienta: string;
  readonly argumentos: Readonly<Record<string, unknown>>;
  readonly ok: boolean;
  readonly en: Date;
}

/** Las llaves de la empresa (las quitadas al final) y las últimas consultas. Solo el dueño. */
export async function llavesDelAsistente(
  tx: Tx,
): Promise<{ llaves: LlaveDelAsistente[]; consultas: ConsultaDelAsistente[] }> {
  const llaves = await enLaBase(
    () => tx<LlaveDelAsistente[]>`
      select id, nombre, inicio, creada_en as creada, ultimo_uso as "ultimoUso", quitada_en as quitada, consultas
      from public.llaves_asistente_de_la_empresa()`,
  );
  const consultas = await enLaBase(
    () => tx<ConsultaDelAsistente[]>`
      select llave, herramienta, argumentos, ok, en from public.consultas_asistente_de_la_empresa(30)`,
  );
  return { llaves: [...llaves], consultas: [...consultas] };
}

/**
 * Una llave nueva para conectar un asistente. Devuelve la llave: es la única vez que se ve. Solo el dueño, con el
 * módulo. Errores: `solo_el_dueno`, `modulo_no_incluido`, `demasiadas_llaves` (10 vigentes).
 */
export async function crearLlaveAsistente(
  tx: Tx,
  entrada: { nombre: string },
): Promise<{ id: string; llave: string }> {
  const { nombre } = validarEntrada(z.object({ nombre: z.string().trim().min(1).max(60) }), entrada);
  const llave = nuevaLlaveAsistente();
  const [r] = await enLaBase(
    () => tx<{ id: string }[]>`select public.crear_llave_asistente(${nombre}, ${llave}) as id`,
  );
  return { id: r!.id, llave };
}

/** Quitar una llave: deja de servir al instante. Solo el dueño. Errores: `solo_el_dueno`, `llave_invalida`. */
export async function quitarLlaveAsistente(tx: Tx, entrada: { llaveId: string }): Promise<void> {
  const { llaveId } = validarEntrada(z.object({ llaveId: uuid }), entrada);
  await enLaBase(() => tx`select public.quitar_llave_asistente(${llaveId})`);
}

export interface QuienConsulta {
  readonly userId: string;
  readonly llaveId: string;
  readonly empresaId: string;
  readonly idioma: 'es' | 'en';
}

/**
 * A nombre de quién consulta una llave; null si no sirve (no existe, se quitó, quien la creó ya no es el dueño o la
 * empresa ya no tiene el módulo). Corre sin sesión (`sinUsuario`): la llave es la prueba. Error: `demasiadas_consultas`.
 */
export async function quienConsultaConLlave(tx: Tx, llave: string): Promise<QuienConsulta | null> {
  if (!/^jsa_[\w-]{32}$/.test(llave)) return null;
  const [r] = await enLaBase(
    () => tx<{ user_id: string; llave_id: string; empresa_id: string; idioma: string }[]>`
      select user_id, llave_id, empresa_id, idioma from public.usuario_de_llave_asistente(${llave})`,
  );
  return r
    ? {
        userId: r.user_id,
        llaveId: r.llave_id,
        empresaId: r.empresa_id,
        idioma: r.idioma === 'en' ? 'en' : 'es',
      }
    : null;
}

/** Anotar una consulta del asistente, aunque haya fallado. Sin sesión (`sinUsuario`). */
export async function anotarConsultaAsistente(
  tx: Tx,
  c: { llaveId: string; herramienta: string; argumentos: unknown; ok: boolean; milisegundos: number },
): Promise<void> {
  await tx`
    select public.anotar_consulta_asistente(${c.llaveId}, ${c.herramienta},
                                            ${tx.json((c.argumentos ?? {}) as postgres.JSONValue)}, ${c.ok},
                                            ${Math.round(c.milisegundos)})`;
}

export interface ObraParaAnalizar {
  readonly folio: string;
  readonly cliente: string;
  readonly estado: string;
  readonly pm: string | null;
  /** El día que se dio de alta: el día de la venta. */
  readonly alta: Dia;
  readonly inicio: Dia;
  readonly entregaOriginal: Dia;
  readonly entregaComprometida: Dia;
  readonly entregaPrevista: Dia | null;
  readonly entregada: Dia | null;
  /** Días tarde contra la comprometida (la real si ya se entregó; si no, la prevista). Negativo: antes. */
  readonly atraso: number;
  readonly duracionDias: number | null;
  readonly tipo: string;
  readonly pies2: number;
  readonly avance: number;
  readonly contrato: number | null;
  readonly ordenesCambio: { readonly n: number; readonly monto: number };
  readonly contratoFinal: number | null;
  readonly cobrado: number;
  readonly porCobrar: number | null;
  readonly costoPresupuestado: number;
  readonly gastado: number;
  readonly material: number;
  readonly cuadrilla: number;
  readonly subcontratos: number;
  readonly margenEsperado: number | null;
  readonly margenProyectado: number | null;
  /** El margen real al cerrarla; null si no está cerrada. */
  readonly margenReal: number | null;
  readonly retrabajos: { readonly n: number; readonly costo: number };
  readonly garantias: { readonly n: number; readonly costo: number };
}

/**
 * Cada obra de la empresa en un renglón, de la más vieja a la más nueva, para cruzarlas (ventas por mes, margen por
 * tipo o por PM, atrasos). Solo el dueño o el administrador, con el módulo de dinero.
 */
export async function obrasParaAnalizar(tx: Tx, ahora = new Date()): Promise<ObraParaAnalizar[]> {
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  exigirModulo(s, 'dinero');
  const filas = await tx<
    {
      id: string;
      folio: string;
      cliente: string;
      estado: string;
      pm: string | null;
      alta: Dia;
      inicio: Dia;
      original: Dia;
      entregada: Dia | null;
      tipo: string | null;
      pies2: string;
      contrato: string | null;
      oc_n: number;
      oc_monto: string;
      cobrado: string;
      dias: number | null;
      margen: string | null;
      retrabajos: number;
      costo_retrabajos: string;
      garantias: number;
      costo_garantias: string;
    }[]
  >`
    select o.id, o.folio, o.cliente, o.estado::text, m.nombre as pm,
           to_char(o.creado_en at time zone ${s.zona}, 'YYYY-MM-DD') as alta,
           to_char(o.fecha_inicio, 'YYYY-MM-DD') as inicio, to_char(o.fecha_fin_estimada, 'YYYY-MM-DD') as original,
           case when o.estado = 'entregada' then to_char(coalesce(
             (select max(e.fecha_entrega) from entregas e where e.obra_id = o.id), o.fecha_fin_real), 'YYYY-MM-DD')
           end as entregada,
           (select string_agg(distinct t.nombre_es, ' + ' order by t.nombre_es)
            from espacios es join tipos_espacio t on t.id = es.tipo_espacio_id
            where es.obra_id = o.id and not t.es_generales) as tipo,
           (select coalesce(sum(coalesce(es.pies2_verificados, es.pies2_cotizados)), 0)
            from espacios es join tipos_espacio t on t.id = es.tipo_espacio_id
            where es.obra_id = o.id and not t.es_generales) as pies2,
           f.contrato_original as contrato,
           (select count(*)::int from ordenes_cambio oc
            where oc.obra_id = o.id and oc.estado in ('autorizada', 'facturada')) as oc_n,
           (select coalesce(sum(mo.precio_cliente), 0)
            from ordenes_cambio oc join ordenes_cambio_montos mo on mo.orden_cambio_id = oc.id
            where oc.obra_id = o.id and oc.estado in ('autorizada', 'facturada')) as oc_monto,
           (select coalesce(sum(c.monto), 0) from cobros c where c.obra_id = o.id and c.estado = 'vigente') as cobrado,
           ce.dias_ciclo as dias, ce.margen_bruto as margen,
           (select count(*)::int from no_calidad n where n.obra_id = o.id and n.tipo <> 'garantia') as retrabajos,
           (select coalesce(sum(n.costo), 0) from no_calidad n where n.obra_id = o.id and n.tipo <> 'garantia')
             as costo_retrabajos,
           (select count(*)::int from no_calidad n where n.obra_id = o.id and n.tipo = 'garantia') as garantias,
           (select coalesce(sum(n.costo), 0) from no_calidad n where n.obra_id = o.id and n.tipo = 'garantia')
             as costo_garantias
    from obras o
    join miembros m on m.id = o.pm_id
    left join obras_finanzas f on f.obra_id = o.id
    left join obras_cerradas ce on ce.obra_id = o.id
    order by o.creado_en`;
  const numeros = new Map((await numerosDeLasObras(tx, ahora)).map((n) => [n.id, n]));
  return filas.map((f): ObraParaAnalizar => {
    const n = numeros.get(f.id)!;
    const p = n.presupuesto;
    const contrato = f.contrato === null ? null : Number(f.contrato);
    const contratoFinal = contrato === null ? null : contrato + Number(f.oc_monto);
    const cobrado = Number(f.cobrado);
    const suma = (k: 'material' | 'cuadrilla' | 'sub') => p.porEtapa.reduce((a, x) => a + x[k], 0);
    return {
      folio: f.folio,
      cliente: f.cliente,
      estado: f.estado,
      pm: f.pm,
      alta: f.alta,
      inicio: f.inicio,
      entregaOriginal: f.original,
      entregaComprometida: n.entregaComprometida,
      entregaPrevista: n.entregaPrevista,
      entregada: f.entregada,
      atraso: f.entregada ? diasEntre(n.entregaComprometida, f.entregada) : n.atraso,
      duracionDias: f.dias,
      tipo: f.tipo ?? '',
      pies2: Number(f.pies2),
      avance: n.avance,
      contrato,
      ordenesCambio: { n: f.oc_n, monto: Number(f.oc_monto) },
      contratoFinal,
      cobrado,
      porCobrar: contratoFinal === null ? null : contratoFinal - cobrado,
      costoPresupuestado: p.total,
      gastado: p.gastado,
      material: suma('material'),
      cuadrilla: suma('cuadrilla'),
      subcontratos: suma('sub'),
      margenEsperado: p.margenEsperado,
      margenProyectado: p.margenProyectado,
      margenReal: f.margen === null ? null : Number(f.margen),
      retrabajos: { n: f.retrabajos, costo: Number(f.costo_retrabajos) },
      garantias: { n: f.garantias, costo: Number(f.costo_garantias) },
    };
  });
}

export interface EtapaParaAnalizar {
  readonly folio: string;
  readonly estado: string;
  readonly tipoEspacio: Nombre;
  readonly espacio: string;
  readonly pies2: number;
  /** Null: "Otras partidas". */
  readonly etapa: Nombre | null;
  /** El costo que se presupuestó (D-084) y lo que se le cobra al cliente. */
  readonly presupuestado: number;
  readonly precio: number;
  readonly material: number;
  readonly cuadrilla: number;
  readonly subcontratos: number;
  readonly gastado: number;
  /** Gastado menos presupuestado (positivo: se pasó). */
  readonly diferencia: number;
  /** La diferencia como fracción del presupuestado; null sin presupuesto. */
  readonly desvio: number | null;
}

/**
 * Cada etapa de cada espacio de cada obra: presupuestado contra gastado, con su desglose. Para ver en qué etapa se
 * pasa la empresa seguido o qué etapa cobra barata. Con `estado`, solo las obras cerradas o las que van en curso; con
 * `folio`, solo esa obra. Solo el dueño o el administrador, con el módulo de dinero.
 */
export async function etapasParaAnalizar(
  tx: Tx,
  entrada: { estado?: 'todas' | 'cerradas' | 'en_curso'; folio?: string | null } = {},
  ahora = new Date(),
): Promise<EtapaParaAnalizar[]> {
  const e = validarEntrada(
    z.object({
      estado: z.enum(['todas', 'cerradas', 'en_curso']).default('todas'),
      folio: z.string().trim().max(40).nullish(),
    }),
    entrada,
  );
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  exigirModulo(s, 'dinero');
  const obras = new Map(
    (
      await tx<{ id: string; folio: string; estado: string }[]>`
        select id, folio, estado::text from obras`
    ).map((o) => [o.id, o]),
  );
  const espacios = new Map(
    (
      await tx<{ id: string; es: string; en: string | null; pies2: string }[]>`
        select es.id, t.nombre_es as es, t.nombre_en as en,
               coalesce(es.pies2_verificados, es.pies2_cotizados) as pies2
        from espacios es join tipos_espacio t on t.id = es.tipo_espacio_id`
    ).map((x) => [x.id, x]),
  );
  return (await numerosDeLasObras(tx, ahora)).flatMap((n) => {
    const o = obras.get(n.id)!;
    if (e.folio && o.folio.toLowerCase() !== e.folio.toLowerCase()) return [];
    if (e.estado === 'cerradas' && o.estado !== 'entregada') return [];
    if (e.estado === 'en_curso' && o.estado === 'entregada') return [];
    return n.presupuesto.porEtapa
      .filter((x) => x.presupuesto || x.total)
      .map((x): EtapaParaAnalizar => {
        const es = espacios.get(x.espacioId);
        return {
          folio: o.folio,
          estado: o.estado,
          tipoEspacio: { es: es?.es ?? '', en: es?.en ?? null },
          espacio: x.espacio,
          pies2: Number(es?.pies2 ?? 0),
          etapa: x.etapa,
          presupuestado: x.presupuesto,
          precio: x.precio,
          material: x.material,
          cuadrilla: x.cuadrilla,
          subcontratos: x.sub,
          gastado: x.total,
          diferencia: x.total - x.presupuesto,
          desvio: x.desvio,
        };
      });
  });
}
