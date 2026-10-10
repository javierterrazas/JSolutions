// El catálogo del dueño (legacy: admin/servidor.js duCrearTipo, duClonarSecuencia, duGuardarPartida): los tipos de
// obra con sus partidas, y las etapas del presupuesto. Cada espacio copia las partidas de su tipo al crearse
// (copiarPartidas), así que cambiar el catálogo solo afecta a los espacios nuevos. Nada se borra: un tipo o una
// partida se dan de baja, y la auditoría guarda cada cambio.
import { ErrorDeNegocio, partidasDeTipoNuevo, type Responsable } from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import type { Nombre } from './consultas-obra';
import { uuid, validarEntrada } from './entrada';
import { exigirDueno, leerSesion } from './sesion';

const nombreEn = z.string().nullish();
/** Lo opcional en inglés: vacío es null (D-015). */
const enIngles = (n: string | null | undefined) => n?.trim() || null;

// ------------------------------------------------------------------ lo que leen las pantallas

export interface TipoDeLaLista {
  readonly id: string;
  readonly nombre: Nombre;
  readonly generales: boolean;
  readonly activo: boolean;
  readonly partidas: number;
}

export interface CatalogoDeTipos {
  /** Generales de obra primero, después los activos en su orden y al final los dados de baja. */
  readonly tipos: readonly TipoDeLaLista[];
  readonly etapas: readonly { id: string; nombre: Nombre }[];
}

export async function catalogoDeTipos(tx: Tx, ahora = new Date()): Promise<CatalogoDeTipos> {
  exigirDueno(await leerSesion(tx, ahora));
  const tipos = await tx<
    { id: string; es: string; en: string | null; generales: boolean; activo: boolean; partidas: number }[]
  >`
    select t.id, t.nombre_es as es, t.nombre_en as en, t.es_generales as generales, t.activo,
           (select count(*)::int from plantillas_partida p where p.tipo_espacio_id = t.id and p.activa) as partidas
    from tipos_espacio t
    order by t.es_generales desc, t.activo desc, t.orden, t.nombre_es`;
  const etapas = await tx<{ id: string; es: string; en: string | null }[]>`
    select id, nombre_es as es, nombre_en as en from etapas where activa order by orden, nombre_es`;
  return {
    tipos: tipos.map((t) => ({
      id: t.id,
      nombre: { es: t.es, en: t.en },
      generales: t.generales,
      activo: t.activo,
      partidas: t.partidas,
    })),
    etapas: etapas.map((e) => ({ id: e.id, nombre: { es: e.es, en: e.en } })),
  };
}

export interface PartidaDelCatalogo {
  readonly id: string;
  readonly orden: number;
  readonly nombre: Nombre;
  readonly peso: number;
  readonly dias: number;
  readonly responsable: Responsable;
  readonly oficioId: string | null;
  readonly paralelo: boolean;
  readonly espera: number;
  readonly etapaId: string | null;
  readonly hitoId: string | null;
  readonly activa: boolean;
}

export interface TipoParaEditar {
  readonly tipo: Omit<TipoDeLaLista, 'partidas'>;
  /** Las activas en su orden; las dadas de baja al final. */
  readonly partidas: readonly PartidaDelCatalogo[];
  readonly etapas: readonly { id: string; nombre: Nombre }[];
  readonly hitos: readonly { id: string; clave: string; nombre: Nombre }[];
  readonly oficios: readonly { id: string; nombre: Nombre }[];
}

/** Un tipo de obra con sus partidas y lo que se elige en cada una; null si no existe. */
export async function tipoParaEditar(
  tx: Tx,
  entrada: { tipoId: string },
  ahora = new Date(),
): Promise<TipoParaEditar | null> {
  exigirDueno(await leerSesion(tx, ahora));
  const { tipoId } = validarEntrada(z.object({ tipoId: uuid }), entrada);
  const [t] = await tx<{ id: string; es: string; en: string | null; generales: boolean; activo: boolean }[]>`
    select id, nombre_es as es, nombre_en as en, es_generales as generales, activo
    from tipos_espacio where id = ${tipoId}`;
  if (!t) return null;
  const partidas = await tx<
    {
      id: string;
      orden: number;
      es: string;
      en: string | null;
      peso: string;
      dias: number;
      responsable: Responsable;
      oficio_id: string | null;
      paralelo: boolean;
      espera: number;
      etapa_id: string | null;
      hito_id: string | null;
      activa: boolean;
    }[]
  >`
    select id, orden, nombre_es as es, nombre_en as en, peso, dias, responsable, oficio_id, paralelo, espera,
           etapa_id, hito_id, activa
    from plantillas_partida where tipo_espacio_id = ${tipoId}
    order by activa desc, orden, nombre_es`;
  const etapas = await tx<{ id: string; es: string; en: string | null }[]>`
    select id, nombre_es as es, nombre_en as en from etapas where activa order by orden, nombre_es`;
  const hitos = await tx<{ id: string; clave: string; es: string; en: string | null }[]>`
    select id, clave, nombre_es as es, nombre_en as en from hitos_calidad where activo order by orden, clave`;
  const oficios = await tx<{ id: string; es: string; en: string | null }[]>`
    select id, nombre_es as es, nombre_en as en from oficios where activo order by nombre_es`;
  return {
    tipo: { id: t.id, nombre: { es: t.es, en: t.en }, generales: t.generales, activo: t.activo },
    partidas: partidas.map((p) => ({
      id: p.id,
      orden: p.orden,
      nombre: { es: p.es, en: p.en },
      peso: Number(p.peso),
      dias: p.dias,
      responsable: p.responsable,
      oficioId: p.oficio_id,
      paralelo: p.paralelo,
      espera: p.espera,
      etapaId: p.etapa_id,
      hitoId: p.hito_id,
      activa: p.activa,
    })),
    etapas: etapas.map((e) => ({ id: e.id, nombre: { es: e.es, en: e.en } })),
    hitos: hitos.map((h) => ({ id: h.id, clave: h.clave, nombre: { es: h.es, en: h.en } })),
    oficios: oficios.map((o) => ({ id: o.id, nombre: { es: o.es, en: o.en } })),
  };
}

// ------------------------------------------------------------------ tipos de obra

/** El nombre de un tipo: obligatorio y sin repetir, tampoco con uno dado de baja. Errores: `tipo_sin_nombre`, `tipo_repetido`. */
async function nombreDeTipo(tx: Tx, nombre: string | null | undefined, salvo: string | null = null) {
  const n = nombre?.trim() ?? '';
  if (!n) throw new ErrorDeNegocio('tipo_sin_nombre');
  const [otro] = await tx`
    select 1 from tipos_espacio where lower(nombre_es) = lower(${n}) and id is distinct from ${salvo}`;
  if (otro) throw new ErrorDeNegocio('tipo_repetido');
  return n;
}

async function insertarTipo(tx: Tx, empresaId: string, nombre: string, en: string | null) {
  const [t] = await tx<{ id: string }[]>`
    insert into tipos_espacio (empresa_id, nombre_es, nombre_en, orden)
    values (${empresaId}, ${nombre}, ${en},
            (select coalesce(max(orden), 0) + 1 from tipos_espacio))
    returning id`;
  return t!.id;
}

const EntradaTipoNuevo = z.object({
  nombre: z.string().nullish(),
  nombreEn,
  partidas: z.array(z.string()).default([]),
  tamano: z.number().positive().max(9999).nullish(),
});

/**
 * Un tipo de obra nuevo que empieza en blanco (legacy: duCrearTipo): las partidas llegan una por renglón y el tamaño
 * se reparte parejo como peso. Solo el dueño o el administrador.
 */
export async function crearTipoObra(
  tx: Tx,
  entrada: z.input<typeof EntradaTipoNuevo>,
  ahora = new Date(),
): Promise<{ tipoId: string }> {
  const e = validarEntrada(EntradaTipoNuevo, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const nombre = await nombreDeTipo(tx, e.nombre);
  const partidas = partidasDeTipoNuevo(e.partidas, e.tamano);
  const tipoId = await insertarTipo(tx, s.empresaId, nombre, enIngles(e.nombreEn));
  await tx`insert into plantillas_partida ${tx(
    partidas.map((p) => ({
      empresa_id: s.empresaId,
      tipo_espacio_id: tipoId,
      orden: p.orden,
      nombre_es: p.nombre,
      peso: p.peso,
      dias: p.dias,
      responsable: p.responsable,
    })),
  )}`;
  return { tipoId };
}

const EntradaCopiarTipo = z.object({ desdeId: uuid, nombre: z.string().nullish(), nombreEn });

/** Un tipo de obra nuevo con las partidas activas de otro, para editarlas (legacy: duClonarSecuencia). */
export async function copiarTipoObra(
  tx: Tx,
  entrada: z.input<typeof EntradaCopiarTipo>,
  ahora = new Date(),
): Promise<{ tipoId: string }> {
  const e = validarEntrada(EntradaCopiarTipo, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const nombre = await nombreDeTipo(tx, e.nombre);
  const origen = await tx`
    select orden, nombre_es, nombre_en, hito_id, peso, dias, responsable, oficio_id, paralelo, espera, etapa_id
    from plantillas_partida where tipo_espacio_id = ${e.desdeId} and activa order by orden, nombre_es`;
  if (!origen.length) throw new ErrorDeNegocio('tipo_sin_partidas');
  const tipoId = await insertarTipo(tx, s.empresaId, nombre, enIngles(e.nombreEn));
  await tx`insert into plantillas_partida ${tx(
    origen.map((p) => ({ ...p, empresa_id: s.empresaId, tipo_espacio_id: tipoId })),
  )}`;
  return { tipoId };
}

const EntradaEditarTipo = z.object({ tipoId: uuid, nombre: z.string().nullish(), nombreEn });

/** Cambia el nombre de un tipo. Los espacios que ya existen conservan el suyo. */
export async function renombrarTipoObra(
  tx: Tx,
  entrada: z.input<typeof EntradaEditarTipo>,
  ahora = new Date(),
): Promise<void> {
  const e = validarEntrada(EntradaEditarTipo, entrada);
  exigirDueno(await leerSesion(tx, ahora));
  const nombre = await nombreDeTipo(tx, e.nombre, e.tipoId);
  const r = await tx`
    update tipos_espacio set nombre_es = ${nombre}, nombre_en = ${enIngles(e.nombreEn)} where id = ${e.tipoId}`;
  if (!r.count) throw new ErrorDeNegocio('tipo_espacio_inexistente', { tipo: e.tipoId });
}

/**
 * Da de baja un tipo o lo reactiva. Uno dado de baja ya no se ofrece en una obra nueva; las obras que lo usan no
 * cambian. Generales de obra no se da de baja: toda obra lo tiene. Error: `tipo_generales`.
 */
export async function cambiarActivoTipo(
  tx: Tx,
  entrada: { tipoId: string; activo: boolean },
  ahora = new Date(),
): Promise<void> {
  const e = validarEntrada(z.object({ tipoId: uuid, activo: z.boolean() }), entrada);
  exigirDueno(await leerSesion(tx, ahora));
  const [t] = await tx<{ generales: boolean }[]>`
    select es_generales as generales from tipos_espacio where id = ${e.tipoId}`;
  if (!t) throw new ErrorDeNegocio('tipo_espacio_inexistente', { tipo: e.tipoId });
  if (t.generales) throw new ErrorDeNegocio('tipo_generales');
  await tx`update tipos_espacio set activo = ${e.activo} where id = ${e.tipoId}`;
}

// ------------------------------------------------------------------ partidas

const EntradaPartida = z.object({
  partidaId: uuid.nullish(),
  tipoId: uuid,
  nombre: z.string().nullish(),
  nombreEn,
  orden: z.number().int().min(0).max(9999).nullish(),
  peso: z.number().positive().max(9999).nullish(),
  dias: z.number().int().min(1).max(365).nullish(),
  responsable: z.enum(['cuadrilla', 'pm', 'subcontratista']).default('cuadrilla'),
  oficioId: uuid.nullish(),
  paralelo: z.boolean().default(false),
  espera: z.number().int().min(0).max(365).nullish(),
  etapaId: uuid.nullish(),
  hitoId: uuid.nullish(),
});
export type EntradaPartidaCatalogo = z.input<typeof EntradaPartida>;

/** Que la partida no repita el nombre de otra activa de su tipo. Error: `partida_repetida`. */
async function sinRepetir(tx: Tx, tipoId: string, nombre: string, salvo: string | null) {
  const [otra] = await tx`
    select 1 from plantillas_partida
    where tipo_espacio_id = ${tipoId} and activa and lower(nombre_es) = lower(${nombre})
      and id is distinct from ${salvo}`;
  if (otra) throw new ErrorDeNegocio('partida_repetida', { partida: nombre });
}

/**
 * Agrega una partida a un tipo, o la edita (legacy: duGuardarPartida). Sin orden, va al final. Quien la hace un
 * subcontratista necesita su oficio. Errores: `partida_sin_nombre`, `partida_repetida`, `falta_oficio`,
 * `etapa_inexistente`, `hito_inexistente`, `oficio_inexistente`.
 */
export async function guardarPartidaCatalogo(
  tx: Tx,
  entrada: EntradaPartidaCatalogo,
  ahora = new Date(),
): Promise<{ partidaId: string }> {
  const e = validarEntrada(EntradaPartida, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const [tipo] = await tx`select 1 from tipos_espacio where id = ${e.tipoId}`;
  if (!tipo) throw new ErrorDeNegocio('tipo_espacio_inexistente', { tipo: e.tipoId });
  const nombre = e.nombre?.trim() ?? '';
  if (!nombre) throw new ErrorDeNegocio('partida_sin_nombre');
  const oficioId = e.responsable === 'subcontratista' ? (e.oficioId ?? null) : null;
  if (e.responsable === 'subcontratista' && !oficioId) throw new ErrorDeNegocio('falta_oficio');
  if (e.etapaId && !(await tx`select 1 from etapas where id = ${e.etapaId} and activa`).length)
    throw new ErrorDeNegocio('etapa_inexistente');
  if (e.hitoId && !(await tx`select 1 from hitos_calidad where id = ${e.hitoId} and activo`).length)
    throw new ErrorDeNegocio('hito_inexistente', { hito: e.hitoId });
  if (oficioId && !(await tx`select 1 from oficios where id = ${oficioId} and activo`).length)
    throw new ErrorDeNegocio('oficio_inexistente');

  const valores = {
    nombre_es: nombre,
    nombre_en: enIngles(e.nombreEn),
    peso: e.peso ?? 1,
    dias: e.dias ?? 1,
    responsable: e.responsable,
    oficio_id: oficioId,
    paralelo: e.paralelo,
    espera: e.espera ?? 0,
    etapa_id: e.etapaId ?? null,
    hito_id: e.hitoId ?? null,
  };
  if (e.partidaId) {
    const [actual] = await tx<{ activa: boolean; orden: number }[]>`
      select activa, orden from plantillas_partida where id = ${e.partidaId} and tipo_espacio_id = ${e.tipoId}`;
    if (!actual) throw new ErrorDeNegocio('partida_inexistente');
    if (actual.activa) await sinRepetir(tx, e.tipoId, nombre, e.partidaId);
    await tx`update plantillas_partida set ${tx({ ...valores, orden: e.orden ?? actual.orden })}
             where id = ${e.partidaId}`;
    return { partidaId: e.partidaId };
  }
  await sinRepetir(tx, e.tipoId, nombre, null);
  const [ultimo] = await tx<{ orden: number }[]>`
    select coalesce(max(orden), 0) + 1 as orden from plantillas_partida where tipo_espacio_id = ${e.tipoId}`;
  const [p] = await tx<{ id: string }[]>`
    insert into plantillas_partida ${tx({
      ...valores,
      empresa_id: s.empresaId,
      tipo_espacio_id: e.tipoId,
      orden: e.orden ?? ultimo!.orden,
    })}
    returning id`;
  return { partidaId: p!.id };
}

/**
 * Da de baja una partida del catálogo o la reactiva. Las obras que ya la copiaron no cambian. Reactivarla no puede
 * repetir el nombre de otra activa: `partida_repetida`.
 */
export async function cambiarActivaPartida(
  tx: Tx,
  entrada: { partidaId: string; activa: boolean },
  ahora = new Date(),
): Promise<void> {
  const e = validarEntrada(z.object({ partidaId: uuid, activa: z.boolean() }), entrada);
  exigirDueno(await leerSesion(tx, ahora));
  const [p] = await tx<{ tipo: string; nombre: string }[]>`
    select tipo_espacio_id as tipo, nombre_es as nombre from plantillas_partida where id = ${e.partidaId}`;
  if (!p) throw new ErrorDeNegocio('partida_inexistente');
  if (e.activa) await sinRepetir(tx, p.tipo, p.nombre, e.partidaId);
  await tx`update plantillas_partida set activa = ${e.activa} where id = ${e.partidaId}`;
}

// ------------------------------------------------------------------ etapas

const EntradaEtapa = z.object({ nombre: z.string().nullish(), nombreEn });

/**
 * Una etapa nueva del presupuesto: un tipo de trabajo (Pintura). Va al final. Errores: `etapa_sin_nombre`,
 * `etapa_repetida` (tampoco con una dada de baja).
 */
export async function crearEtapa(
  tx: Tx,
  entrada: z.input<typeof EntradaEtapa>,
  ahora = new Date(),
): Promise<{ etapaId: string }> {
  const e = validarEntrada(EntradaEtapa, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const nombre = e.nombre?.trim() ?? '';
  if (!nombre) throw new ErrorDeNegocio('etapa_sin_nombre');
  if ((await tx`select 1 from etapas where lower(nombre_es) = lower(${nombre})`).length)
    throw new ErrorDeNegocio('etapa_repetida');
  const [et] = await tx<{ id: string }[]>`
    insert into etapas (empresa_id, nombre_es, nombre_en, orden)
    values (${s.empresaId}, ${nombre}, ${enIngles(e.nombreEn)},
            (select coalesce(max(orden), 0) + 1 from etapas))
    returning id`;
  return { etapaId: et!.id };
}
