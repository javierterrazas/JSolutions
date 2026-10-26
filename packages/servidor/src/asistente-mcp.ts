// La conexión MCP del asistente (D-114): las herramientas que un asistente de IA puede usar para consultar la empresa,
// todas de solo lectura y con las funciones que ya usa la app (mismas reglas y la identidad del dueño), y el protocolo
// (JSON-RPC 2.0 sobre HTTP, sin estado: cada mensaje se contesta solo). La capa web pone la llave y la transacción.
import { esErrorDeNegocio, type Modulo } from '@ijm/core';
import { z } from 'zod';
import { etapasParaAnalizar, obrasParaAnalizar } from './asistente';
import type { Tx } from './conexion';
import { dia, validarEntrada } from './entrada';
import { equipo } from './acceso';
import { avisosAbiertos } from './avisos';
import { semanaDeLaCuadrilla } from './cuadrilla';
import { desempenoDeManagers } from './desempeno';
import { analisisDeObraCerrada, historicoDeObras } from './historico';
import { indicadoresDeLaEmpresa } from './indicadores';
import { pendientesDePosventa } from './posventa';
import { seguimientoDeObra } from './seguimiento';
import { leerSesion } from './sesion';
import { subcontratistas } from './subcontratistas';

type Esquema = { type: 'object'; properties: Record<string, unknown>; required?: string[] };

interface Herramienta {
  readonly nombre: string;
  readonly titulo: string;
  readonly descripcion: string;
  readonly entrada: Esquema;
  /** Los módulos que necesita: sin ellos, el asistente ni la ve. */
  readonly modulos: readonly Modulo[];
  readonly correr: (tx: Tx, args: Record<string, unknown>, ahora: Date) => Promise<unknown>;
}

const sinArgumentos: Esquema = { type: 'object', properties: {} };
const porFolio: Esquema = {
  type: 'object',
  properties: { folio: { type: 'string', description: 'El folio de la obra, como OB-001.' } },
  required: ['folio'],
};

class ObraNoEncontrada extends Error {}

async function obraDeFolio(tx: Tx, args: Record<string, unknown>): Promise<string> {
  const { folio } = validarEntrada(z.object({ folio: z.string().trim().min(1).max(40) }), args);
  const [o] = await tx<{ id: string }[]>`select id from obras where lower(folio) = lower(${folio})`;
  if (!o) throw new ObraNoEncontrada(folio);
  return o.id;
}

const HERRAMIENTAS: readonly Herramienta[] = [
  {
    nombre: 'empresa',
    titulo: 'La empresa',
    descripcion:
      'La empresa: su nombre, la fecha de hoy en su zona horaria, sus módulos y su gente (dueño, administradores y ' +
      'PMs). Úsala primero para saber de qué fecha partir.',
    entrada: sinArgumentos,
    modulos: [],
    correr: async (tx, _args, ahora) => {
      const s = await leerSesion(tx, ahora);
      const [e] = await tx<{ nombre: string }[]>`select nombre from empresa_actual_datos`;
      return {
        empresa: e?.nombre,
        hoy: s.hoy,
        zonaHoraria: s.zona,
        modulos: s.modulos,
        gente: (await equipo(tx, ahora)).map((m) => ({ nombre: m.nombre, rol: m.rol, activo: m.activo })),
      };
    },
  },
  {
    nombre: 'obras',
    titulo: 'Obras para analizar',
    descripcion:
      'Todas las obras, una por renglón, de la más vieja a la más nueva: alta (el día de la venta), inicio, ' +
      'entregas (original, comprometida con las órdenes de cambio, prevista y real), atraso en días, duración, tipo ' +
      'de trabajo, pies², PM, contrato, órdenes de cambio, contrato final, cobrado y por cobrar, costo presupuestado, ' +
      'gastado (material, cuadrilla, subcontratos), margen esperado, proyectado y real, retrabajos y garantías. ' +
      'Sirve para ventas por mes, margen por tipo de obra o por PM, atrasos, cobranza.',
    entrada: {
      type: 'object',
      properties: {
        estado: {
          type: 'string',
          enum: ['todas', 'en_curso', 'entregadas'],
          description: 'Cuáles obras (todas si no se dice).',
        },
      },
    },
    modulos: ['dinero'],
    correr: async (tx, args, ahora) => {
      const { estado } = validarEntrada(
        z.object({ estado: z.enum(['todas', 'en_curso', 'entregadas']).default('todas') }),
        args,
      );
      return (await obrasParaAnalizar(tx, ahora)).filter(
        (o) =>
          estado === 'todas' ||
          (estado === 'entregadas' ? o.estado === 'entregada' : o.estado !== 'entregada'),
      );
    },
  },
  {
    nombre: 'etapas_de_obras',
    titulo: 'Etapas de las obras',
    descripcion:
      'Cada etapa de cada espacio de cada obra: costo presupuestado contra gastado (material, cuadrilla, ' +
      'subcontratos), lo que se le cobra al cliente, la diferencia y el desvío. Sirve para ver en qué etapa se pasa ' +
      'del presupuesto seguido, qué etapa se cobra barata o cuánto cuesta una etapa por pie².',
    entrada: {
      type: 'object',
      properties: {
        estado: {
          type: 'string',
          enum: ['todas', 'cerradas', 'en_curso'],
          description: 'De qué obras (todas si no se dice).',
        },
        folio: { type: 'string', description: 'Solo las de esta obra.' },
      },
    },
    modulos: ['dinero'],
    correr: (tx, args, ahora) => etapasParaAnalizar(tx, args, ahora),
  },
  {
    nombre: 'seguimiento_de_obra',
    titulo: 'Seguimiento de una obra',
    descripcion:
      'Cómo va una obra: avance, en qué va cada espacio, plazo, presupuesto contra gastado por etapa, horas de la ' +
      'cuadrilla y el día a día que capturó el PM (las últimas dos semanas, o todos los días).',
    entrada: {
      type: 'object',
      properties: {
        folio: { type: 'string', description: 'El folio de la obra, como OB-001.' },
        todos_los_dias: {
          type: 'boolean',
          description: 'Todo el día a día, no solo las últimas dos semanas.',
        },
      },
      required: ['folio'],
    },
    modulos: ['dinero'],
    correr: async (tx, args, ahora) => {
      const obraId = await obraDeFolio(tx, args);
      const r = await seguimientoDeObra(tx, { obraId, todos: args.todos_los_dias === true }, ahora);
      if (!r) return null;
      // el teléfono y la dirección del cliente no hacen falta para analizar
      const { telefono: _t, direccion: _d, ...obra } = r.obra;
      return { ...r, obra };
    },
  },
  {
    nombre: 'analisis_de_obra_cerrada',
    titulo: 'Análisis de una obra cerrada',
    descripcion:
      'Dónde se fue el margen de una obra ya cerrada: presupuesto contra real en total, por rubro y por etapa, ' +
      'órdenes de cambio, retrabajos y garantías, días planeados contra reales y ganancia por día.',
    entrada: porFolio,
    modulos: ['historico'],
    correr: async (tx, args, ahora) =>
      analisisDeObraCerrada(tx, { obraId: await obraDeFolio(tx, args) }, ahora),
  },
  {
    nombre: 'historico',
    titulo: 'Histórico de obras cerradas',
    descripcion:
      'El resumen de las obras cerradas: promedios por mes y por tipo de obra, tendencia, lo que cuesta cada etapa ' +
      'según el tamaño (con la unidad que más explica el precio) y las garantías.',
    entrada: sinArgumentos,
    modulos: ['historico'],
    correr: async (tx, _args, ahora) => {
      const { obras: _o, ...resto } = await historicoDeObras(tx, ahora);
      return resto;
    },
  },
  {
    nombre: 'indicadores',
    titulo: 'Indicadores',
    descripcion:
      'Los indicadores de la empresa hoy, cada uno con su meta y su semáforo, y las obras detrás de los seis del ' +
      'lunes (cierres que faltan, avisos tarde, órdenes de cambio tardadas, gastos sin recibo, saldo con subs, ' +
      'costo de retrabajos).',
    entrada: sinArgumentos,
    modulos: ['indicadores'],
    correr: (tx, _args, ahora) => indicadoresDeLaEmpresa(tx, ahora),
  },
  {
    nombre: 'desempeno_de_managers',
    titulo: 'Desempeño de los managers',
    descripcion:
      'El desempeño de cada PM y el de la empresa en un periodo: disciplina (cierres a tiempo, recibos), plazos ' +
      '(atraso, plan semanal), dinero (presupuestos en rojo) y calidad (inspecciones, punch list, retrabajos).',
    entrada: {
      type: 'object',
      properties: {
        dias: { type: 'integer', enum: [30, 90, 365], description: 'El periodo (90 si no se dice).' },
      },
    },
    modulos: ['desempeno'],
    correr: (tx, args, ahora) => desempenoDeManagers(tx, args, ahora),
  },
  {
    nombre: 'horas_de_la_cuadrilla',
    titulo: 'Horas de la cuadrilla',
    descripcion:
      'Las horas (o días) de cada trabajador en una semana de lunes a domingo, en qué obras y qué días, y su costo.',
    entrada: {
      type: 'object',
      properties: {
        semana: {
          type: 'string',
          description: 'Un día cualquiera de la semana (AAAA-MM-DD); la de hoy si no se dice.',
        },
      },
    },
    modulos: ['nomina'],
    correr: (tx, args, ahora) =>
      semanaDeLaCuadrilla(tx, validarEntrada(z.object({ semana: dia.nullish() }), args), ahora),
  },
  {
    nombre: 'pendientes',
    titulo: 'Pendientes',
    descripcion:
      'Lo que está pendiente hoy: avisos de los PMs sin contestar (cuánto llevan y si detienen la obra), reclamos ' +
      'de garantía abiertos y reseñas por pedir, y subcontratistas con papeles vencidos o por vencer.',
    entrada: sinArgumentos,
    modulos: [],
    correr: async (tx, _args, ahora) => {
      const s = await leerSesion(tx, ahora);
      return {
        avisos: (await avisosAbiertos(tx, ahora)).map(({ fotos: _f, ...a }) => a),
        ...(s.modulos.includes('posventa') ? { posventa: await pendientesDePosventa(tx, ahora) } : {}),
        ...(s.modulos.includes('subcontratistas')
          ? {
              papelesDeSubcontratistas: (await subcontratistas(tx, ahora)).subcontratistas
                .filter((x) => x.activo && x.avisos.length)
                .map((x) => ({ nombre: x.nombre, oficio: x.oficio.nombre, avisos: x.avisos })),
            }
          : {}),
      };
    },
  },
];

/** Lo que se le pasa al asistente: los nombres en su idioma, sin decimales de más, las fechas como texto. */
export function paraElAsistente(valor: unknown, idioma: 'es' | 'en'): unknown {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return Number.isInteger(valor) ? valor : Math.round(valor * 10_000) / 10_000;
  if (valor instanceof Date) return valor.toISOString();
  if (valor instanceof Map) return paraElAsistente(Object.fromEntries(valor), idioma);
  if (Array.isArray(valor)) return valor.map((x) => paraElAsistente(x, idioma));
  if (typeof valor === 'object') {
    const o = valor as Record<string, unknown>;
    const claves = Object.keys(o);
    // un nombre del catálogo en dos idiomas
    if (claves.length === 2 && 'es' in o && 'en' in o && typeof o.es === 'string')
      return idioma === 'en' && typeof o.en === 'string' ? o.en : o.es;
    return Object.fromEntries(
      claves.filter((k) => o[k] !== undefined).map((k) => [k, paraElAsistente(o[k], idioma)]),
    );
  }
  return valor;
}

/** Las herramientas que la empresa tiene, en la forma de MCP. */
export async function herramientasDelAsistente(tx: Tx, ahora = new Date()) {
  const s = await leerSesion(tx, ahora);
  return HERRAMIENTAS.filter((h) => h.modulos.every((m) => s.modulos.includes(m))).map((h) => ({
    name: h.nombre,
    title: h.titulo,
    description: h.descripcion,
    inputSchema: h.entrada,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }));
}

/** Lo que contesta una herramienta: el texto (JSON) y si fue un error. Null si la herramienta no existe. */
export async function correrHerramienta(
  tx: Tx,
  nombre: string,
  args: Record<string, unknown>,
  idioma: 'es' | 'en',
  ahora = new Date(),
): Promise<{ texto: string; error: boolean } | null> {
  const s = await leerSesion(tx, ahora);
  const h = HERRAMIENTAS.find((x) => x.nombre === nombre && x.modulos.every((m) => s.modulos.includes(m)));
  if (!h) return null;
  try {
    const r = await h.correr(tx, args, ahora);
    return {
      texto: r === null ? 'No hay datos para eso.' : JSON.stringify(paraElAsistente(r, idioma)),
      error: false,
    };
  } catch (e) {
    if (e instanceof ObraNoEncontrada)
      return { texto: `No hay una obra con el folio ${e.message}.`, error: true };
    if (esErrorDeNegocio(e))
      return {
        texto:
          e.codigo === 'datos_invalidos'
            ? `Los argumentos no son válidos: ${JSON.stringify(e.datos?.problemas ?? [])}`
            : `No se pudo: ${e.codigo}`,
        error: true,
      };
    throw e;
  }
}

export const INSTRUCCIONES_DEL_ASISTENTE =
  'Datos de una empresa de remodelación en J Solutions, de solo lectura. Montos en dólares. Márgenes, desvíos y ' +
  'avances son fracciones (0.35 = 35%). Fechas AAAA-MM-DD. En las obras, "alta" es el día de la venta. Empieza por ' +
  'la herramienta "empresa" para saber la fecha de hoy. Para analizar entre obras usa "obras" y "etapas_de_obras". ' +
  'Con pocas obras cerradas, las conclusiones son débiles: dilo. Muestra los números en que te basas.';

const VERSIONES = ['2025-06-18', '2025-03-26', '2024-11-05'];

/** Lo que el protocolo necesita de la capa web: las herramientas y correr una, ya con la llave y la transacción. */
export interface ContextoMcp {
  readonly listar: () => Promise<unknown[]>;
  readonly llamar: (
    nombre: string,
    args: Record<string, unknown>,
  ) => Promise<{ texto: string; error: boolean } | null>;
}

type Mensaje = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };

const respuesta = (id: unknown, result: unknown) => ({ jsonrpc: '2.0', id, result });
const falla = (id: unknown, code: number, message: string) => ({
  jsonrpc: '2.0',
  id,
  error: { code, message },
});

async function atenderUno(m: Mensaje, ctx: ContextoMcp): Promise<object | null> {
  if (!m || typeof m !== 'object' || m.jsonrpc !== '2.0') return falla(null, -32600, 'Invalid Request');
  // una respuesta o una notificación (sin id) no se contestan
  if (typeof m.method !== 'string' || !('id' in m)) return null;
  const id = m.id;
  const p = (m.params && typeof m.params === 'object' ? m.params : {}) as Record<string, unknown>;
  switch (m.method) {
    case 'initialize':
      return respuesta(id, {
        protocolVersion: VERSIONES.includes(p.protocolVersion as string) ? p.protocolVersion : VERSIONES[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'j-solutions', title: 'J Solutions', version: '1.0.0' },
        instructions: INSTRUCCIONES_DEL_ASISTENTE,
      });
    case 'ping':
      return respuesta(id, {});
    case 'tools/list':
      return respuesta(id, { tools: await ctx.listar() });
    case 'tools/call': {
      const args = (p.arguments && typeof p.arguments === 'object' ? p.arguments : {}) as Record<
        string,
        unknown
      >;
      const r = typeof p.name === 'string' ? await ctx.llamar(p.name, args) : null;
      if (!r) return falla(id, -32602, `Unknown tool: ${String(p.name)}`);
      return respuesta(id, { content: [{ type: 'text', text: r.texto }], isError: r.error });
    }
    default:
      return falla(id, -32601, `Method not found: ${m.method}`);
  }
}

/** Contesta un mensaje (o un lote) de JSON-RPC. Null: no hay nada que contestar (solo notificaciones). */
export async function atenderMcp(cuerpo: unknown, ctx: ContextoMcp): Promise<object | object[] | null> {
  if (Array.isArray(cuerpo)) {
    const r: object[] = [];
    for (const m of cuerpo) {
      const x = await atenderUno(m as Mensaje, ctx);
      if (x) r.push(x);
    }
    return r.length ? r : null;
  }
  return atenderUno(cuerpo as Mensaje, ctx);
}
